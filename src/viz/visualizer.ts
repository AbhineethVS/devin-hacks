import type { SoundEvent, Step } from "../engine/types";

export interface Visualizer {
  onStep(step: Step): void;
  resize(): void;
  dispose(): void;
}

// Canvas 2D visualizer (Card 4). Layers, back to front: fading trails, depth rings, a waveform
// ribbon from the analyser, and one burst per sound event. Kicks shake, the drone tints red.

const COLORS: Record<string, string> = {
  kick: "#ff4d8d",
  snare: "#ffffff",
  hat: "#9ad7ff",
  openhat: "#9ad7ff",
  rim: "#f9d56e",
  lead: "#ff7ab0",
  bell: "#7aa2ff",
  bass: "#ffb86b",
  pad: "#b18cff",
  drone: "#ff5a5a",
  crash: "#ffffff",
};

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" → MIDI 69. Returns 60 for anything unparseable. */
export function noteToMidi(note: string | undefined): number {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note ?? "");
  if (!m) return 60;
  const base = NOTE_INDEX[m[1] as string] ?? 0;
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

type Kind = "ring" | "spark" | "note" | "flash" | "glow";
interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number; // 1 → 0
  decay: number; // per second
  color: string;
}

export function createVisualizer(canvas: HTMLCanvasElement, analyser: AnalyserNode): Visualizer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  const g = ctx; // non-null alias for closures
  const wave = new Float32Array(analyser.fftSize);
  const particles: Particle[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let shake = 0;
  let depth = 0;
  let drone = 0; // 0..1, eases toward the target
  let droneTarget = 0;
  let lane = 0;
  let raf = 0;
  let last = performance.now();
  let disposed = false;

  function resize(): void {
    dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function add(p: Omit<Particle, "life">): void {
    particles.push({ ...p, life: 1 });
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function burst(ev: SoundEvent): void {
    const color = COLORS[ev.voice] ?? "#ffffff";
    const v = ev.velocity ?? 1;
    switch (ev.voice) {
      case "kick":
        add({ kind: "ring", x: w / 2, y: h * 0.62, vx: 0, vy: 0, r: 30, decay: 1.8, color });
        shake = Math.max(shake, 7 * v);
        break;
      case "snare":
        add({ kind: "flash", x: 0, y: 0, vx: 0, vy: 0, r: 0, decay: 6, color });
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          add({
            kind: "spark",
            x: w / 2,
            y: h * 0.62,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            r: 2,
            decay: 2.6,
            color,
          });
        }
        break;
      case "hat":
      case "openhat":
      case "rim":
        for (let i = 0; i < (ev.voice === "rim" ? 2 : 4); i++) {
          add({
            kind: "spark",
            x: w * (0.15 + Math.random() * 0.7),
            y: h * (0.12 + Math.random() * 0.25),
            vx: (Math.random() - 0.5) * 60,
            vy: -30 - Math.random() * 40,
            r: ev.voice === "rim" ? 2.5 : 1.6,
            decay: ev.voice === "openhat" ? 1.2 : 3,
            color,
          });
        }
        break;
      case "lead":
      case "bell":
      case "bass": {
        const midi = noteToMidi(ev.note);
        const y = h * (0.9 - Math.min(1, Math.max(0, (midi - 28) / 60)) * 0.8);
        lane = (lane + 1) % 9;
        add({
          kind: "note",
          x: w * (0.12 + lane * 0.095),
          y,
          vx: 0,
          vy: -24,
          r: ev.voice === "bass" ? 14 : ev.voice === "bell" ? 9 : 7,
          decay: ev.voice === "bass" ? 1.4 : 1.1,
          color,
        });
        break;
      }
      case "pad":
        add({
          kind: "glow",
          x: w / 2,
          y: h / 2,
          vx: 0,
          vy: 0,
          r: Math.max(w, h) * 0.45,
          decay: 0.6,
          color,
        });
        break;
      case "drone":
        droneTarget = 1;
        break;
      case "crash":
        add({ kind: "flash", x: 0, y: 0, vx: 0, vy: 0, r: 0, decay: 1.5, color });
        shake = 14;
        break;
    }
  }

  function drawWave(): void {
    analyser.getFloatTimeDomainData(wave);
    const mid = h * 0.62;
    const amp = h * 0.22;
    g.save();
    g.lineWidth = 2.5;
    g.strokeStyle =
      drone > 0.05 ? `rgba(255, 90, 90, ${0.6 + drone * 0.4})` : "rgba(255, 77, 141, 0.85)";
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 14;
    g.beginPath();
    const n = wave.length;
    for (let i = 0; i < n; i += 4) {
      const x = (i / (n - 1)) * w;
      const wob = drone > 0.05 ? Math.sin(i * 0.05 + performance.now() * 0.01) * 6 * drone : 0;
      const y = mid + (wave[i] ?? 0) * amp + wob;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
  }

  function drawDepth(): void {
    for (let i = 1; i <= Math.min(depth, 8); i++) {
      g.strokeStyle = `rgba(122, 162, 255, ${0.28 - i * 0.025})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(w / 2, h * 0.62, 40 + i * 26, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    drone += (droneTarget - drone) * Math.min(1, dt * 3);

    g.save();
    // Trails: paint the background at partial alpha instead of clearing.
    g.fillStyle = drone > 0.05 ? `rgba(40, 6, 10, ${0.25})` : "rgba(11, 13, 18, 0.28)";
    g.fillRect(0, 0, w, h);
    if (shake > 0.2) {
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= Math.pow(0.0005, dt);
    }
    drawDepth();
    drawWave();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i] as Particle;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.globalAlpha = p.life;
      g.fillStyle = p.color;
      g.strokeStyle = p.color;
      switch (p.kind) {
        case "ring":
          g.lineWidth = 4 * p.life;
          g.beginPath();
          g.arc(p.x, p.y, p.r + (1 - p.life) * Math.min(w, h) * 0.45, 0, Math.PI * 2);
          g.stroke();
          break;
        case "flash":
          g.globalAlpha = p.life * 0.12;
          g.fillRect(-20, -20, w + 40, h + 40);
          break;
        case "glow": {
          const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, "transparent");
          g.globalAlpha = p.life * 0.18;
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          break;
        }
        default:
          g.shadowColor = p.color;
          g.shadowBlur = p.kind === "note" ? 18 : 8;
          g.beginPath();
          g.arc(p.x, p.y, p.r * (p.kind === "note" ? 0.6 + p.life * 0.6 : 1), 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
      }
    }
    g.globalAlpha = 1;
    g.restore();
  }

  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    onStep(step: Step): void {
      depth = step.meta?.depth ?? 0;
      if (!step.events.some((e) => e.voice === "drone")) droneTarget = 0;
      for (const ev of step.events) burst(ev);
    },
    resize,
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      particles.length = 0;
    },
  };
}

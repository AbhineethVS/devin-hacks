// Decorative "agent" cursors that roam the page while a redesign is generated.
// Exposes window.RemodelCursors = { start(), stop(), flourish() }.

(() => {
  const AGENTS = [
    { name: "Ammu", job: "layout", color: "#ff4d8d" },
    { name: "Kuttan", job: "typography", color: "#2f6bff" },
    { name: "Chinnu", job: "colour", color: "#00b86b" },
  ];
  const ACTIONS = {
    layout: ["regridding", "moving to cards", "rebuilding the hero", "killing the sidebar"],
    typography: ["picking a typeface", "setting the scale", "fixing line length", "kerning the headline"],
    colour: ["sampling the palette", "adding contrast", "tuning the accents", "painting the cards"],
  };

  let host = null;
  let timers = [];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function targets() {
    const els = [...document.querySelectorAll("h1, h2, h3, p, img, table, li a, .titleline, figure")];
    return els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 40 && r.height > 12 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
  }

  function build() {
    host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .agent { position: absolute; left: 0; top: 0; transition: transform 0.9s cubic-bezier(.2,.8,.2,1), opacity .4s; will-change: transform; }
        .agent svg { width: 22px; height: 22px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
        .tag { position: absolute; left: 16px; top: 18px; white-space: nowrap; font: 600 12px/1 system-ui, sans-serif;
               color: #fff; padding: 5px 8px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
        .box { position: absolute; border: 2px dashed; border-radius: 4px; transition: all .6s cubic-bezier(.2,.8,.2,1), opacity .4s; opacity: 0; }
        .pulse { position: absolute; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; animation: p .6s ease-out forwards; }
        @keyframes p { from { transform: scale(.2); opacity: .7 } to { transform: scale(1.8); opacity: 0 } }
      </style>`;
    AGENTS.forEach((a, i) => {
      const box = document.createElement("div");
      box.className = "box";
      box.style.borderColor = a.color;
      const el = document.createElement("div");
      el.className = "agent";
      el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2l17 9-7.5 2L9 21z" fill="${a.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>
                      <div class="tag" style="background:${a.color}">${a.name} · ${a.job}</div>`;
      el.style.transform = `translate(${innerWidth / 2 + (i - 1) * 60}px, ${innerHeight + 40}px)`;
      shadow.append(box, el);
      a.el = el;
      a.box = box;
      a.tag = el.querySelector(".tag");
    });
    document.documentElement.append(host);
  }

  function step(agent) {
    const t = pick(targets());
    if (t) {
      const r = t.getBoundingClientRect();
      const x = r.left + Math.min(r.width - 10, 20 + Math.random() * Math.max(10, r.width - 40));
      const y = r.top + Math.min(r.height - 6, 10 + Math.random() * Math.max(6, r.height - 20));
      agent.el.style.transform = `translate(${x}px, ${y}px)`;
      Object.assign(agent.box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px`, opacity: 1 });
      agent.tag.textContent = `${agent.name} · ${pick(ACTIONS[agent.job])}`;
      setTimeout(() => {
        const p = document.createElement("div");
        p.className = "pulse";
        Object.assign(p.style, { left: `${x}px`, top: `${y}px`, background: agent.color });
        host?.shadowRoot.append(p);
        setTimeout(() => p.remove(), 700);
      }, 900);
    }
    timers.push(setTimeout(() => step(agent), 1300 + Math.random() * 1200));
  }

  window.RemodelCursors = {
    start() {
      if (host) return;
      build();
      AGENTS.forEach((a, i) => timers.push(setTimeout(() => step(a), 150 + i * 350)));
    },
    // Agents converge on the centre, then leave.
    flourish() {
      if (!host) return Promise.resolve();
      timers.forEach(clearTimeout);
      timers = [];
      AGENTS.forEach((a, i) => {
        a.box.style.opacity = 0;
        a.tag.textContent = `${a.name} · done ✓`;
        a.el.style.transform = `translate(${innerWidth / 2 + (i - 1) * 90}px, ${innerHeight / 2}px)`;
      });
      return new Promise((resolve) =>
        setTimeout(() => {
          AGENTS.forEach((a, i) => (a.el.style.transform = `translate(${innerWidth / 2 + (i - 1) * 400}px, ${-80}px)`));
          setTimeout(() => this.stop(), 900);
          resolve();
        }, 1000)
      );
    },
    stop() {
      timers.forEach(clearTimeout);
      timers = [];
      host?.remove();
      host = null;
    },
  };
})();

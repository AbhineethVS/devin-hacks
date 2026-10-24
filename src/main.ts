import "./styles.css";
import {
  AudioWaveform,
  CodeXml,
  createIcons,
  Download,
  Drum,
  Gauge,
  Link,
  ListMusic,
  Play,
  Share2,
  Sparkles,
  Square,
  Zap,
} from "lucide";
import { buildFileSong } from "./engine/fileSong";
import { createPlayer, loadTone, startAudio } from "./engine/scheduler";
import { tokenize, tokenizeWithInfo } from "./engine/tokenize";
import type { Language, Song } from "./engine/types";
import { getAnalyser } from "./packs/default";
import { getPack, PACKS } from "./packs";
import { PRESETS } from "./presets";
import { runTrace } from "./tracer/runTrace";
import { buildRunSong } from "./tracer/runSong";
import { createEditor } from "./ui/editor";
import { createVisualizer, type Visualizer } from "./viz/visualizer";

// Main app (Card 5): editor + transport + visualizer wired to the engine and the tracer.

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

createIcons({
  icons: {
    AudioWaveform,
    CodeXml,
    Download,
    Drum,
    Gauge,
    Link,
    ListMusic,
    Play,
    Share2,
    Sparkles,
    Square,
    Zap,
  },
});

const RUNNABLE: ReadonlySet<Language> = new Set(["js", "ts", "c", "cpp", "java"]);
const LANGS: { id: Language; name: string }[] = [
  { id: "js", name: "JavaScript" },
  { id: "ts", name: "TypeScript" },
  { id: "c", name: "C" },
  { id: "cpp", name: "C++" },
  { id: "java", name: "Java" },
  { id: "python", name: "Python" },
  { id: "go", name: "Go" },
  { id: "rust", name: "Rust" },
  { id: "asm", name: "Assembly" },
  { id: "unknown", name: "Other" },
];

const app = document.querySelector<HTMLDivElement>(".app");
const status = $<HTMLDivElement>("status");
const playFileBtn = $<HTMLButtonElement>("play-file");
const runBtn = $<HTMLButtonElement>("run");
const stopBtn = $<HTMLButtonElement>("stop");
const presetSelect = $<HTMLSelectElement>("preset");
const langSelect = $<HTMLSelectElement>("lang");
const bpm = $<HTMLInputElement>("bpm");
const bpmValue = $<HTMLOutputElement>("bpm-value");
const backing = $<HTMLInputElement>("backing");
const canvas = $<HTMLCanvasElement>("viz");
const vizEmpty = document.querySelector<HTMLDivElement>(".viz-empty");

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle("is-error", isError);
}

// ---------- editor + presets + language ----------
const first = PRESETS[0];
let lang: Language = first?.lang ?? "js";
const editor = createEditor($("editor"), first?.code ?? "", lang);

for (const p of PRESETS) presetSelect.add(new Option(p.name, p.id));
for (const l of LANGS) langSelect.add(new Option(l.name, l.id));
langSelect.value = lang;

function setLanguage(next: Language): void {
  lang = next;
  langSelect.value = next;
  editor.setLanguage(next);
  const runnable = RUNNABLE.has(next);
  runBtn.disabled = !runnable;
  runBtn.title = runnable
    ? "Run the program and hear what it does (R)"
    : "Run supports JavaScript and C-like code. Use Play file.";
}
setLanguage(lang);

presetSelect.addEventListener("change", () => {
  const preset = PRESETS.find((p) => p.id === presetSelect.value);
  if (!preset) return;
  stop();
  editor.setCode(preset.code, preset.lang);
  setLanguage(preset.lang);
  setStatus(`Loaded ${preset.name}. Press Play file or Run.`);
});
langSelect.addEventListener("change", () => setLanguage(langSelect.value as Language));

// ---------- packs ----------
let packId = PACKS[0]?.id ?? "default";
const packsBox = $<HTMLDivElement>("packs");
const CHIPS: { id: string; name: string }[] = [
  { id: "default", name: "Default" },
  { id: "lofi", name: "Lo-fi" },
  { id: "techno", name: "Techno" },
  { id: "8bit", name: "8-bit" },
];
for (const c of CHIPS) {
  const ready = PACKS.some((p) => p.id === c.id);
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.textContent = c.name;
  chip.setAttribute("role", "radio");
  chip.setAttribute("aria-checked", String(c.id === packId));
  chip.disabled = !ready;
  chip.title = ready ? `${c.name} sound pack` : "Coming soon";
  chip.addEventListener("click", () => {
    packId = c.id as typeof packId;
    for (const el of packsBox.querySelectorAll(".chip"))
      el.setAttribute("aria-checked", String(el === chip));
  });
  packsBox.append(chip);
}

// ---------- player + visualizer ----------
const player = createPlayer();
let viz: Visualizer | null = null;
let mode: Song["mode"] | null = null;

function setMode(next: Song["mode"] | null): void {
  mode = next;
  playFileBtn.classList.toggle("is-active", next === "file");
  runBtn.classList.toggle("is-active", next === "run");
  app?.classList.toggle("is-playing", next !== null);
  if (next !== null) app?.classList.remove("is-drone");
}

player.onStep((step) => {
  editor.highlight(step.highlight);
  viz?.onStep(step);
  if (step.message) {
    setStatus(step.message, true);
    if (step.events.some((e) => e.voice === "drone")) app?.classList.add("is-drone");
  }
});

let lastInfo = "";
player.onEnd(() => {
  const endedOnProblem = status.classList.contains("is-error");
  setMode(null);
  if (!endedOnProblem) {
    editor.highlight(null);
    setStatus(`Finished. ${lastInfo}`);
  }
});

function stop(): void {
  const wasActive = mode !== null || app?.classList.contains("is-drone") === true;
  player.stop(); // also releases a still-ringing drone after the song has ended
  setMode(null);
  editor.highlight(null);
  app?.classList.remove("is-drone");
  if (wasActive) setStatus("Stopped.");
}

async function prepareAudio(): Promise<void> {
  await startAudio(); // must run inside the click/keydown handler (browser autoplay rules)
  player.setBacking(backing.checked);
  if (!viz) {
    viz = createVisualizer(canvas, getAnalyser());
    vizEmpty?.classList.add("is-hidden");
  }
}

async function playFile(): Promise<void> {
  const code = editor.getCode();
  if (!code.trim()) return setStatus("Nothing to play: the editor is empty.", true);
  try {
    await prepareAudio();
    player.stop();
    const info = tokenizeWithInfo(code, lang);
    const pack = getPack(packId);
    const song = buildFileSong(info.lines, pack, Number(bpm.value));
    if (song.steps.length === 0) return setStatus("Nothing to play: no tokens found.", true);
    lastInfo = song.info;
    setMode("file");
    player.play(song, pack);
    const notes = [`Play file · ${song.steps.length} steps`];
    if (info.overLineLimit) notes.push("first 400 lines");
    if (info.truncatedLines.length) notes.push(`${info.truncatedLines.length} long lines trimmed`);
    setStatus(notes.join(" · "));
  } catch (err) {
    setMode(null);
    setStatus(`Couldn't play: ${err instanceof Error ? err.message : String(err)}`, true);
    console.error(err);
  }
}

async function run(): Promise<void> {
  if (!RUNNABLE.has(lang))
    return setStatus("Run supports JavaScript and C-like code. Use Play file.", true);
  const code = editor.getCode();
  if (!code.trim()) return setStatus("Nothing to run: the editor is empty.", true);
  try {
    await prepareAudio();
    player.stop();
    setStatus("Running your code…");
    const trace = await runTrace(code, lang);
    const pack = getPack(packId);
    const song = buildRunSong(trace, tokenize(code, lang), pack, Number(bpm.value));
    if (song.steps.length === 0) return setStatus("The program ran but did nothing audible.", true);
    lastInfo = song.info;
    setMode("run");
    player.play(song, pack);
    const ms = Math.round(trace.durationMs);
    setStatus(ms >= 1 ? `${song.info} · traced in ${ms} ms` : song.info);
  } catch (err) {
    setMode(null);
    setStatus(`Couldn't run: ${err instanceof Error ? err.message : String(err)}`, true);
    console.error(err);
  }
}

playFileBtn.addEventListener("click", () => void playFile());
runBtn.addEventListener("click", () => void run());
stopBtn.addEventListener("click", stop);
for (const b of [playFileBtn, runBtn]) b.addEventListener("pointerenter", () => void loadTone());

bpm.addEventListener("input", () => {
  bpmValue.value = bpm.value;
  player.setBpm(Number(bpm.value));
});
backing.addEventListener("change", () => player.setBacking(backing.checked));

// ---------- keyboard: Space play/stop, F play file, R run, Esc stop ----------
window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement | null;
  const typing = target?.closest(".cm-editor, input, select, textarea") !== null;
  if (e.key === "Escape") return stop();
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === " ") {
    e.preventDefault();
    if (mode) stop();
    else void playFile();
  } else if (key === "f") void playFile();
  else if (key === "r") void run();
});

setStatus("Ready. Press Play file (F) or Run (R). Space plays/stops.");

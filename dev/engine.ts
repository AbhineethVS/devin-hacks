// Temporary dev page for Cards 1–2: Play file and Run with the Default pack. Not in the prod build.
import { buildFileSong } from "../src/engine/fileSong";
import { createPlayer, startAudio } from "../src/engine/scheduler";
import { tokenize, tokenizeWithInfo } from "../src/engine/tokenize";
import type { Language } from "../src/engine/types";
import { defaultPack } from "../src/packs/default";
import { PRESETS } from "../src/presets";
import { runTrace } from "../src/tracer/runTrace";
import { buildRunSong } from "../src/tracer/runSong";

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const code = $<HTMLTextAreaElement>("code");
const lang = $<HTMLSelectElement>("lang");
const bpm = $<HTMLInputElement>("bpm");
const backing = $<HTMLInputElement>("backing");
const status = $<HTMLDivElement>("status");

const LANGS: Language[] = [
  "js",
  "ts",
  "c",
  "cpp",
  "java",
  "python",
  "go",
  "rust",
  "asm",
  "unknown",
];
for (const l of LANGS) lang.add(new Option(l, l));
const presetSelect = $<HTMLSelectElement>("preset");
for (const p of PRESETS) presetSelect.add(new Option(p.name, p.id));
function loadPreset(id: string): void {
  const preset = PRESETS.find((p) => p.id === id);
  code.value = preset?.code ?? "";
  lang.value = preset?.lang ?? "js";
}
loadPreset("bubble-sort");
presetSelect.value = "bubble-sort";
presetSelect.addEventListener("change", () => loadPreset(presetSelect.value));

const player = createPlayer();
let lines: string[] = [];

player.onStep((step, index) => {
  const text = lines[step.highlight.line - 1]?.trim() ?? "";
  const voices = step.events.map((e) => (e.note ? `${e.voice}:${e.note}` : e.voice)).join(" ");
  const depth = step.meta?.depth ? `  depth ${step.meta.depth}` : "";
  const message = step.message ? `  ${step.message}` : "";
  status.textContent = `step ${index}  line ${step.highlight.line}${depth}  ${voices || "·"}  | ${text}${message}`;
});
player.onEnd(() => {
  status.textContent = "Finished";
});

$("play").addEventListener("click", async () => {
  try {
    await startAudio(); // user gesture → resume the AudioContext
    player.setBacking(backing.checked);
    lines = code.value.split(/\r?\n/);
    const info = tokenizeWithInfo(code.value, lang.value as Language);
    const song = buildFileSong(info.lines, defaultPack, Number(bpm.value) || defaultPack.bpm);
    player.play(song, defaultPack);
    const notes = [song.info];
    if (info.truncatedLines.length) notes.push(`truncated lines: ${info.truncatedLines.join(",")}`);
    if (info.overLineLimit) notes.push("over the 400-line limit");
    status.textContent = notes.join(" · ");
  } catch (err) {
    status.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  }
});
$("run").addEventListener("click", async () => {
  try {
    await startAudio();
    player.setBacking(backing.checked);
    lines = code.value.split(/\r?\n/);
    const l = lang.value as Language;
    status.textContent = "Running…";
    const trace = await runTrace(code.value, l);
    const song = buildRunSong(
      trace,
      tokenize(code.value, l),
      defaultPack,
      Number(bpm.value) || 112,
    );
    player.play(song, defaultPack);
    const extra = trace.error ? ` · error: ${trace.error}` : trace.infinite ? " · infinite" : "";
    status.textContent = `${trace.items.length} trace items in ${Math.round(trace.durationMs)} ms${extra}`;
  } catch (err) {
    status.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  }
});
$("stop").addEventListener("click", () => {
  player.stop();
  status.textContent = "Stopped";
});
bpm.addEventListener("input", () => {
  const v = Number(bpm.value);
  if (v >= 20 && v <= 400) player.setBpm(v);
});
backing.addEventListener("change", () => player.setBacking(backing.checked));

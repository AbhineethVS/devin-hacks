import "./styles.css";
import {
  AudioWaveform,
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
import { PRESETS } from "./presets";
import { createEditor } from "./ui/editor";

// Placeholder shell (Card 0). Card 3 builds the real UI; Card 5 wires the engine and tracer.

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

createIcons({
  icons: {
    AudioWaveform,
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

const status = $<HTMLDivElement>("status");
function setStatus(text: string): void {
  status.textContent = text;
}

const firstPreset = PRESETS[0];
const editor = createEditor($("editor"), firstPreset?.code ?? "");

const presetSelect = $<HTMLSelectElement>("preset");
for (const p of PRESETS) presetSelect.add(new Option(p.name, p.id));
presetSelect.addEventListener("change", () => {
  const preset = PRESETS.find((p) => p.id === presetSelect.value);
  if (preset) editor.setCode(preset.code, preset.lang);
});

const packs = $<HTMLDivElement>("packs");
for (const [name, ready] of [
  ["Default", true],
  ["Lo-fi", false],
  ["Techno", false],
  ["8-bit", false],
] as const) {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.textContent = name;
  chip.setAttribute("role", "radio");
  chip.setAttribute("aria-checked", String(ready));
  chip.disabled = !ready;
  if (!ready) chip.title = "Arrives with Card 6";
  packs.append(chip);
}

const bpm = $<HTMLInputElement>("bpm");
const bpmValue = $<HTMLOutputElement>("bpm-value");
bpm.addEventListener("input", () => {
  bpmValue.value = bpm.value;
});

$("play-file").addEventListener("click", () => setStatus("Play file arrives with Card 1."));
$("run").addEventListener("click", () => setStatus("Run arrives with Card 2."));
$("stop").addEventListener("click", () => setStatus("Ready"));

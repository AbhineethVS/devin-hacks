// Shared data shapes from CONTRACTS.md. Every module imports its types from here.

// §1 Tokens
export type TokenKind = "kw" | "type" | "id" | "num" | "str" | "op" | "punct" | "comment";
/** `line` is 1-based (matches CodeMirror and the tracer); `col` is 0-based; `index` = position within its line. */
export interface Token {
  text: string;
  kind: TokenKind;
  line: number;
  col: number;
  index: number;
}
export type Language =
  "js" | "ts" | "c" | "cpp" | "java" | "python" | "go" | "rust" | "asm" | "unknown";

// §2 Sound events
export type Voice =
  | "kick"
  | "snare"
  | "hat"
  | "openhat"
  | "rim"
  | "lead"
  | "bell"
  | "bass"
  | "pad"
  | "drone"
  | "crash";
export const VOICES: readonly Voice[] = [
  "kick",
  "snare",
  "hat",
  "openhat",
  "rim",
  "lead",
  "bell",
  "bass",
  "pad",
  "drone",
  "crash",
];
export interface SoundEvent {
  voice: Voice;
  /** e.g. "A4" */
  note?: string;
  /** 0..1 */
  velocity?: number;
  /** Tone notation, e.g. "16n" */
  duration?: string;
}
export interface Step {
  events: SoundEvent[];
  /** What the editor lights up. `line` is 1-based; `token` is the token index within the line. */
  highlight: { line: number; token?: number };
  /** Shown in the status bar (e.g. "Infinite loop"). */
  message?: string;
  /** Recursion depth and current function (Run mode). */
  meta?: { depth?: number; fn?: string };
}
export interface Song {
  steps: Step[];
  subdivision: "16n" | "8n";
  bpm: number;
  mode: "file" | "run";
  info: string;
}

// §5 Tracer
export interface TraceItem {
  /** 1-based source line. */
  line: number;
  values: number[];
  depth: number;
  fn?: string;
  kind?: "call" | "return" | "stmt";
}
export interface TraceResult {
  items: TraceItem[];
  error?: string;
  infinite: boolean;
  durationMs: number;
}
export interface TraceOptions {
  /** Step cap, default 1500. */
  cap?: number;
  /** Worker timeout, default 1500 ms. */
  timeoutMs?: number;
}

// §6 Sound packs
export type PackId = "default" | "lofi" | "techno" | "8bit" | "orchestral";
export interface Instrument {
  trigger(note: string | undefined, duration: string, time: number, velocity: number): void;
  dispose(): void;
}
export type Instruments = Record<Voice, Instrument>;
export interface SoundPack {
  id: PackId;
  name: string;
  /** Pitch classes, e.g. ["A","C","D","E","G"]. */
  scale: string[];
  rootOctave: number;
  /** Suggested BPM. */
  bpm: number;
  backing: { kickEvery: number; hatOffset: number } | null;
  /** Tone nodes per Voice, routed through one limiter. */
  createInstruments(): Instruments;
}

// §7 Scheduler
export interface Player {
  play(song: Song, pack: SoundPack): void;
  stop(): void;
  /** UI and visualizer subscribe; called via Tone.Draw. */
  onStep(cb: (step: Step, index: number) => void): void;
  onEnd(cb: () => void): void;
  setBpm(bpm: number): void;
}

// §8 Editor
export interface EditorApi {
  getCode(): string;
  setCode(code: string, lang?: Language): void;
  highlight(h: Step["highlight"] | null): void;
  onChange(cb: (code: string) => void): void;
  setLanguage(lang: Language): void;
}

// §10 AI endpoints
export interface TraceSummary {
  steps: number;
  infinite: boolean;
  error?: string;
  hotLines: { line: number; count: number }[];
  maxDepth: number;
}

// §11 Share
export interface ShareState {
  code: string;
  lang: Language;
  pack: PackId;
  bpm: number;
  mode: Song["mode"];
}

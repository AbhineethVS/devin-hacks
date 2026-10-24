# CONTRACTS.md: interfaces and data shapes

Single source of truth. All modules communicate only through these shapes.

**Conventions (added in Card 0):**
- All the types below are declared once in `src/engine/types.ts`. The files named in each section export the functions and re-export the types they use.
- Line numbers (`Token.line`, `Step.highlight.line`, `TraceItem.line`) are **1-based**, matching CodeMirror. `Token.col` is 0-based.
- Factories: `createPlayer(): Player` (`scheduler.ts`), `createEditor(parent, initialCode?): EditorApi` (`ui/editor.ts`).
- Stubs that aren't built yet throw `Not implemented: <name> (Card N)`. Search for `STUB (Card` to find them.

## 1. Tokens (`src/engine/tokenize.ts`)
```ts
type TokenKind = "kw" | "type" | "id" | "num" | "str" | "op" | "punct" | "comment";
interface Token { text: string; kind: TokenKind; line: number; col: number; index: number } // index = position within its line
type Language = "js" | "ts" | "c" | "cpp" | "java" | "python" | "go" | "rust" | "asm" | "unknown";
function tokenize(source: string, lang: Language): Token[][];   // one array per source line
function detectLanguage(filename: string, source: string): Language;
```
- Whitespace is dropped. Comments are kept as `comment` (they become rests or pads, never notes).
- Keyword and type sets per language live in `src/engine/languages.ts`.

## 2. Sound events (`src/engine/types.ts`)
```ts
type Voice = "kick" | "snare" | "hat" | "openhat" | "rim" | "lead" | "bell" | "bass" | "pad" | "drone" | "crash";
interface SoundEvent { voice: Voice; note?: string /* e.g. "A4" */; velocity?: number /* 0..1 */; duration?: string /* Tone notation */ }
interface Step {
  events: SoundEvent[];
  highlight: { line: number; token?: number };   // what the editor lights up
  message?: string;                              // shown in the status bar (e.g. "Infinite loop")
  meta?: { depth?: number; fn?: string };        // recursion depth, current function (Run mode)
}
interface Song { steps: Step[]; subdivision: "16n" | "8n"; bpm: number; mode: "file" | "run"; info: string }
```

## 3. Mapping (`src/engine/mapping.ts`)
```ts
function soundForToken(tok: Token, depth: number, pack: SoundPack): SoundEvent[];  // same mapping in both modes
function noteFromDegree(degree: number, octave: number, pack: SoundPack): string;  // always in-scale
function stableHash(s: string): number;                                            // deterministic
```
The mapping table is in `docs/SOUND_DESIGN.md`. Change it there first.

## 4. Play-file song (`src/engine/fileSong.ts`)
```ts
function buildFileSong(lines: Token[][], pack: SoundPack, bpm: number): Song;
```
One token = one 16th step. Each line is padded to a whole beat (a multiple of 4 steps). Comment-only lines become a 4-step rest with a `pad` chord. Empty lines are skipped.

## 5. Tracer (`src/tracer/`)
```ts
interface TraceItem { line: number; values: number[]; depth: number; fn?: string; kind?: "call" | "return" | "stmt" }
interface TraceResult { items: TraceItem[]; error?: string; infinite: boolean; durationMs: number }
function runTrace(source: string, lang: Language, opts?: { cap?: number /* default 1500 */; timeoutMs?: number /* default 1500 */ }): Promise<TraceResult>; // runs in a Web Worker
function buildRunSong(trace: TraceResult, lines: Token[][], pack: SoundPack, bpm: number): Song;
```
- Run supports JS/TS, plus a C-like subset (`int/float/double/char/long/bool` → `let`, `printf` → no-op).
- Other languages: Play file only (the UI says so).
- An infinite loop gives `infinite: true`. The Song then plays ~48 steps, then a `drone` step with the message "Infinite loop: the program never ends."
- Runtime error: a `crash` step with the message "Crashed: <error>".

## 6. Sound packs (`src/packs/`)
```ts
interface SoundPack {
  id: "default" | "lofi" | "techno" | "8bit" | "orchestral";
  name: string;
  scale: string[];          // pitch classes, e.g. ["A","C","D","E","G"]
  rootOctave: number;
  bpm: number;              // suggested
  backing: { kickEvery: number; hatOffset: number } | null;
  createInstruments(): Instruments;  // Tone nodes per Voice, routed through one limiter
}
type Instruments = Record<Voice, { trigger(note: string | undefined, duration: string, time: number, velocity: number): void; dispose(): void }>;
```

## 7. Scheduler (`src/engine/scheduler.ts`)
```ts
interface Player {
  play(song: Song, pack: SoundPack): void;
  stop(): void;
  onStep(cb: (step: Step, index: number) => void): void;   // UI and visualizer subscribe; called via Tone.Draw
  onEnd(cb: () => void): void;
  setBpm(bpm: number): void;
}
```

## 8. Editor API (`src/ui/editor.ts`)
```ts
interface EditorApi { getCode(): string; setCode(code: string, lang?: Language): void; highlight(h: Step["highlight"] | null): void; onChange(cb: (code: string) => void): void; setLanguage(lang: Language): void }
```

## 9. Visualizer (`src/viz/visualizer.ts`)
```ts
function createVisualizer(canvas: HTMLCanvasElement, analyser: AnalyserNode): { onStep(step: Step): void; resize(): void; dispose(): void };
```

## 10. AI endpoints (`api/`)
- `POST /api/generate` `{ prompt: string, lang: "js", previousError?: string, previousCode?: string }` → `{ code: string, title: string, notes: string }`
  - **Validation happens in the browser:** the client runs the code with `runTrace`.
  - If the code errors, loops forever, or produces fewer than 16 steps, the client calls `/api/generate` once more with `previousError` and `previousCode`.
  - **Never execute user or AI code on the server.**
- `POST /api/explain` `{ code: string, traceSummary: TraceSummary, question?: string }` → `{ explanation: string, lines: number[] }`
```ts
interface TraceSummary { steps: number; infinite: boolean; error?: string; hotLines: { line: number; count: number }[]; maxDepth: number }
```

## 11. Share (`src/share/`)
- URL hash: `#c=<lz-string(code)>&l=<lang>&p=<pack>&b=<bpm>&m=<mode>`
- Audio export: `exportAudio(song, pack): Promise<Blob>` (webm/ogg via Tone.Recorder).

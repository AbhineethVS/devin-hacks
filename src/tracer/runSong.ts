import { noteFromDegree, soundForToken, stableHash } from "../engine/mapping";
import type {
  Song,
  SoundEvent,
  SoundPack,
  Step,
  Token,
  TraceItem,
  TraceResult,
} from "../engine/types";

// Trace → song per docs/SOUND_DESIGN.md "Run mode": one executed line = one 16th step.

export const INFINITE_STEPS = 48;
export const INFINITE_MESSAGE = "Infinite loop: the program never ends.";
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%="]);
/** Retrigger the function pad this often while execution stays inside one function. */
const PAD_EVERY = 8;
/** Deep recursion (fib) would otherwise climb several octaves into shrill territory. */
const MAX_DEPTH_BONUS = 5;

/** `x[...] =` somewhere on the line (token texts only, so it works with any tokenizer granularity). */
export function hasArrayWrite(tokens: Token[]): boolean {
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i]?.text !== "[" || tokens[i - 1]?.kind !== "id") continue;
    let depth = 0;
    for (let j = i; j < tokens.length; j++) {
      const t = tokens[j]?.text;
      if (t === "[") depth++;
      else if (t === "]" && --depth === 0) {
        if (ASSIGN_OPS.has(tokens[j + 1]?.text ?? "")) return true;
        break;
      }
    }
  }
  return false;
}

/** Non-negative integer degree for any number: rounds, then wraps into 0..9. */
export function valueDegree(value: number): number {
  return ((Math.round(value) % 10) + 10) % 10;
}

/** Degree 0..6 from a name, matching the identifier rule in the token table. */
function hashDegree(name: string): number {
  return ((stableHash(name) % 7) + 7) % 7;
}

function percussion(tokens: Token[]): SoundEvent[] {
  const events: SoundEvent[] = [];
  const texts = tokens.map((t) => t.text);
  if (texts.includes("{"))
    events.push({ voice: "kick", note: "C1", velocity: 0.9, duration: "16n" });
  else if (texts.includes(";")) events.push({ voice: "hat", velocity: 0.7, duration: "16n" });
  if (hasArrayWrite(tokens)) events.push({ voice: "snare", velocity: 0.8, duration: "16n" });
  return events;
}

/** The bell of the line's first non-type keyword, using the shared token mapping. */
function bell(tokens: Token[], depth: number, pack: SoundPack): SoundEvent[] {
  const kw = tokens.find((t) => t.kind === "kw");
  if (!kw) return [];
  return soundForToken(kw, depth, pack)
    .filter((e) => e.voice === "bell")
    .map((e) => ({ ...e, velocity: 0.6 }));
}

/** Lead from the last numeric value (or the first identifier's hash); deeper calls climb by one degree per level. */
function melody(item: TraceItem, tokens: Token[], pack: SoundPack): SoundEvent[] {
  const octave = item.depth > 1 ? 5 : 4;
  const value = item.values.at(-1);
  let degree: number;
  if (value !== undefined && Number.isFinite(value)) {
    degree = valueDegree(value);
  } else {
    const id = tokens.find((t) => t.kind === "id");
    if (!id) return [];
    degree = hashDegree(id.text);
  }
  return [
    {
      voice: "lead",
      note: noteFromDegree(degree + Math.min(item.depth, MAX_DEPTH_BONUS), octave, pack),
      velocity: 0.8,
      duration: "16n",
    },
  ];
}

function padFor(fn: string, pack: SoundPack): SoundEvent {
  return {
    voice: "pad",
    note: noteFromDegree(hashDegree(fn), 3, pack),
    velocity: 0.35,
    duration: "2n",
  };
}

function describe(trace: TraceResult, shown: number): string {
  const maxDepth = trace.items.reduce((m, i) => Math.max(m, i.depth), 0);
  const parts = [`Run: ${shown} steps`, `max depth ${maxDepth}`];
  if (trace.infinite) parts.push("infinite loop");
  if (trace.error) parts.push("crashed");
  return parts.join(", ");
}

export function buildRunSong(
  trace: TraceResult,
  lines: Token[][],
  pack: SoundPack,
  bpm: number,
): Song {
  const items = trace.infinite ? trace.items.slice(0, INFINITE_STEPS) : trace.items;
  const steps: Step[] = [];
  let lastFn: string | undefined;
  let sincePad = 0;

  for (const item of items) {
    const tokens = lines[item.line - 1] ?? [];
    const events = [
      ...percussion(tokens),
      ...bell(tokens, item.depth, pack),
      ...melody(item, tokens, pack),
    ];
    sincePad++;
    if (item.fn && (item.fn !== lastFn || sincePad >= PAD_EVERY)) {
      events.push(padFor(item.fn, pack));
      sincePad = 0;
    }
    lastFn = item.fn;
    const step: Step = { events, highlight: { line: item.line }, meta: { depth: item.depth } };
    if (item.fn && step.meta) step.meta.fn = item.fn;
    steps.push(step);
  }

  const lastLine = items.at(-1)?.line ?? 1;
  if (trace.infinite) {
    steps.push({
      events: [{ voice: "drone", note: noteFromDegree(0, 1, pack), velocity: 0.8, duration: "2m" }],
      highlight: { line: lastLine },
      message: INFINITE_MESSAGE,
    });
  } else if (trace.error) {
    steps.push({
      events: [
        { voice: "crash", velocity: 0.9, duration: "1m" },
        { voice: "kick", note: "G0", velocity: 1, duration: "8n" },
      ],
      highlight: { line: lastLine },
      message: `Crashed: ${trace.error}`,
    });
  }

  return { steps, subdivision: "16n", bpm, mode: "run", info: describe(trace, steps.length) };
}

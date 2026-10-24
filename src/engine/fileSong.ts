import { noteFromDegree, soundForToken } from "./mapping";
import type { Song, SoundPack, Step, Token } from "./types";

/** Steps per beat on the 16th-note grid. Every line is padded to a whole beat. */
export const STEPS_PER_BEAT = 4;

// Indent unit = the smallest non-zero leading column in the file (2 or 4 spaces, or 1 for a tab),
// so depth means the same thing whatever the indent style. Depth > 1 lifts identifiers an octave.
function indentUnit(lines: Token[][]): number {
  let unit = Infinity;
  for (const line of lines) {
    // Block-comment continuation lines (` * …`) would fake a 1-column indent.
    if (line.every((t) => t.kind === "comment")) continue;
    const col = line[0]?.col ?? 0;
    if (col > 0 && col < unit) unit = col;
  }
  return Number.isFinite(unit) ? Math.min(unit, 8) : 2;
}

function indentDepth(line: Token[], unit: number): number {
  return Math.floor((line[0]?.col ?? 0) / unit);
}

/** A soft minor-ish chord for comment-only lines: degrees 0, 1, 3 at octave 3 (A C E in Default). */
function padChord(pack: SoundPack): Step["events"] {
  return [0, 1, 3].map((d) => ({
    voice: "pad" as const,
    note: noteFromDegree(d, 3, pack),
    velocity: 0.3,
    duration: "4n",
  }));
}

/**
 * Play-file song (CONTRACTS.md §4). One token = one 16th step; each line is padded to a multiple of
 * 4 steps; a comment-only line becomes a 4-step rest with a soft pad chord; empty lines are skipped.
 * Padding steps keep the line's last token highlighted so the editor pill doesn't flicker.
 */
export function buildFileSong(lines: Token[][], pack: SoundPack, bpm: number): Song {
  const steps: Step[] = [];
  let lineCount = 0;
  const unit = indentUnit(lines);

  for (const line of lines) {
    if (line.length === 0) continue;
    const lineNo = line[0]?.line ?? 0;
    lineCount++;

    if (line.every((t) => t.kind === "comment")) {
      steps.push({ events: padChord(pack), highlight: { line: lineNo, token: 0 } });
      for (let i = 1; i < STEPS_PER_BEAT; i++) {
        steps.push({ events: [], highlight: { line: lineNo, token: 0 } });
      }
      continue;
    }

    const depth = indentDepth(line, unit);
    for (const tok of line) {
      steps.push({
        events: soundForToken(tok, depth, pack),
        highlight: { line: tok.line, token: tok.index },
      });
    }
    const last = line[line.length - 1]?.index ?? 0;
    const padding = (STEPS_PER_BEAT - (line.length % STEPS_PER_BEAT)) % STEPS_PER_BEAT;
    for (let i = 0; i < padding; i++) {
      steps.push({ events: [], highlight: { line: lineNo, token: last } });
    }
  }

  return {
    steps,
    subdivision: "16n",
    bpm,
    mode: "file",
    info: `Play file: ${lineCount} lines, ${steps.length} steps`,
  };
}

import type { SoundEvent, SoundPack, Token } from "./types";

// Implements the "Token → sound" table in docs/SOUND_DESIGN.md exactly. Same mapping in both modes.

/** Keyword degrees from docs/SOUND_DESIGN.md. Unknown keywords play degree 0. */
export const KEYWORD_DEGREES: Readonly<Record<string, number>> = {
  for: 0,
  while: 1,
  do: 1,
  if: 2,
  switch: 2,
  else: 3,
  false: 3,
  return: 4,
  case: 4,
  function: 5,
  def: 5,
  fn: 5,
  new: 6,
  break: 7,
  continue: 7,
  true: 8,
  null: 9,
  None: 9,
};

const COMPARISONS = new Set(["<", ">", "<=", ">=", "==", "===", "!=", "!=="]);
const ASSIGNMENTS = new Set(["=", "+=", "-=", "*=", "/="]);

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Deterministic unsigned hash (h * 31 + charCode, seeded with 7). This is the exact formula from
 * the original sound test, so identifiers keep the melody the project was chosen on.
 * Never use Math.random in mapping.
 */
export function stableHash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** scale[d mod n] at octave + floor(d / n). Negative degrees walk down. Always in-scale. */
export function noteFromDegree(degree: number, octave: number, pack: SoundPack): string {
  const n = pack.scale.length;
  if (n === 0) throw new Error(`Pack "${pack.id}" has an empty scale`);
  const d = Number.isFinite(degree) ? Math.round(degree) : 0;
  const pitch = pack.scale[mod(d, n)];
  return `${pitch}${octave + Math.floor(d / n)}`;
}

/** The keyword degree, matching Python's `True`/`False` to `true`/`false`. */
export function keywordDegree(word: string): number {
  return KEYWORD_DEGREES[word] ?? KEYWORD_DEGREES[word.toLowerCase()] ?? 0;
}

/** Parses hex, binary, floats, `1_000` and C suffixes (`10L`, `1.5f`). Unparseable → 0. */
export function numberValue(text: string): number {
  const clean = text.replace(/_/g, "");
  if (/^0[xX]/.test(clean)) return parseInt(clean.slice(2).replace(/[uUlL]+$/, ""), 16) || 0;
  if (/^0[bB]/.test(clean)) return parseInt(clean.slice(2).replace(/[uUlL]+$/, ""), 2) || 0;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

/** Length of a string literal's content, without prefixes and quotes. */
function stringContentLength(text: string): number {
  const m = /^[A-Za-z]{0,2}("""|'''|["'`])/.exec(text);
  const q = m?.[1]?.length ?? 0;
  const prefix = m ? m[0].length - q : 0;
  const body = text.length - prefix - q;
  const closed = q > 0 && text.length - prefix >= 2 * q && text.endsWith(m?.[1] ?? "");
  return Math.max(0, closed ? body - q : body);
}

function punctSound(text: string): SoundEvent[] {
  switch (text) {
    case ";":
      return [{ voice: "snare", duration: "16n" }];
    case "{":
      return [{ voice: "kick", note: "C1", duration: "16n" }];
    case "}":
      return [{ voice: "kick", note: "G0", duration: "16n" }];
    case "(":
    case ")":
      return [{ voice: "hat", duration: "16n" }];
    case "[":
    case "]":
      return [{ voice: "hat", velocity: 0.8, duration: "16n" }];
    case ",":
      return [{ voice: "hat", velocity: 0.5, duration: "16n" }];
    default:
      return [{ voice: "rim", note: "C6", velocity: 0.4, duration: "16n" }];
  }
}

function opSound(text: string): SoundEvent[] {
  if (COMPARISONS.has(text)) return [{ voice: "rim", note: "E6", duration: "16n" }];
  if (ASSIGNMENTS.has(text)) return [{ voice: "hat", velocity: 0.6, duration: "16n" }];
  return [{ voice: "rim", note: "A5", velocity: 0.7, duration: "16n" }];
}

/**
 * Sound events for one token. `depth` is the indent depth (Play file) or recursion depth (Run).
 * Drum notes (kick C1/G0, rim C6/E6/A5) are fixed percussion pitches from the sound design;
 * every melodic note goes through noteFromDegree so it stays in the pack's scale.
 */
export function soundForToken(tok: Token, depth: number, pack: SoundPack): SoundEvent[] {
  switch (tok.kind) {
    case "comment":
      return [];
    case "punct":
      // `:` `?` etc. fall through to "other punctuation" inside punctSound.
      return punctSound(tok.text);
    case "op":
      return opSound(tok.text);
    case "type":
      return [{ voice: "bass", note: noteFromDegree(0, 2, pack), duration: "16n" }];
    case "kw": {
      const d = keywordDegree(tok.text);
      return [
        { voice: "bell", note: noteFromDegree(d, 4, pack), velocity: 0.8, duration: "16n" },
        { voice: "bass", note: noteFromDegree(d, 2, pack), duration: "16n" },
      ];
    }
    case "num": {
      const d = mod(Math.round(numberValue(tok.text)), 10);
      return [{ voice: "bass", note: noteFromDegree(d, 2, pack), duration: "16n" }];
    }
    case "str":
      // Deviation: the doc says degree = length; wrapped mod 10 (like numbers) so a long
      // string can't climb to inaudible octaves (an 80-char string would otherwise be A21).
      return [
        {
          voice: "lead",
          note: noteFromDegree(stringContentLength(tok.text) % 10, 5, pack),
          duration: "16n",
        },
      ];
    case "id": {
      const octave = depth > 1 ? 5 : 4;
      return [
        {
          voice: "lead",
          note: noteFromDegree(stableHash(tok.text) % 7, octave, pack),
          duration: "16n",
        },
      ];
    }
  }
}

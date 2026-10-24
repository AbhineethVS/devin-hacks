import type { Song, SoundPack, Token } from "./types";

// STUB (Card 1): fake song with one silent step per token, so the UI can drive highlighting.
// The real version pads lines to whole beats and adds sounds via soundForToken.
export function buildFileSong(lines: Token[][], _pack: SoundPack, bpm: number): Song {
  const steps = lines.flat().map((tok) => ({
    events: [],
    highlight: { line: tok.line, token: tok.index },
  }));
  return { steps, subdivision: "16n", bpm, mode: "file", info: "stub song (Card 1)" };
}

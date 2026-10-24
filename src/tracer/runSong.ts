import { notImplemented } from "../notImplemented";
import type { Song, SoundPack, Token, TraceResult } from "../engine/types";

// STUB (Card 2): trace → song per docs/SOUND_DESIGN.md "Run mode".
export function buildRunSong(
  _trace: TraceResult,
  _lines: Token[][],
  _pack: SoundPack,
  _bpm: number,
): Song {
  return notImplemented("buildRunSong", "Card 2");
}

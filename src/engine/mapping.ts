import { notImplemented } from "../notImplemented";
import type { SoundEvent, SoundPack, Token } from "./types";

// STUB (Card 1): implement exactly per docs/SOUND_DESIGN.md. Same mapping in both modes.
export function soundForToken(_tok: Token, _depth: number, _pack: SoundPack): SoundEvent[] {
  return notImplemented("soundForToken", "Card 1");
}

// STUB (Card 1): scale[d mod n] at octave + floor(d / n). Always in-scale.
export function noteFromDegree(_degree: number, _octave: number, _pack: SoundPack): string {
  return notImplemented("noteFromDegree", "Card 1");
}

// STUB (Card 1): deterministic string hash (no Math.random).
export function stableHash(_s: string): number {
  return notImplemented("stableHash", "Card 1");
}

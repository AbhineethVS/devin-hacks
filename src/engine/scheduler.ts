import { notImplemented } from "../notImplemented";
import type { Player } from "./types";

// STUB (Card 1): Tone transport scheduler per skills/tone-scheduling.
export function createPlayer(): Player {
  return {
    play: () => notImplemented("Player.play", "Card 1"),
    stop: () => {},
    onStep: () => {},
    onEnd: () => {},
    setBpm: () => {},
  };
}

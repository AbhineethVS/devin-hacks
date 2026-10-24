import { notImplemented } from "../notImplemented";
import type { SoundPack } from "../engine/types";

// Pack data from docs/SOUND_DESIGN.md. STUB (Card 1): createInstruments and the shared analyser.
export const defaultPack: SoundPack = {
  id: "default",
  name: "Default",
  scale: ["A", "C", "D", "E", "G"],
  rootOctave: 4,
  bpm: 112,
  backing: { kickEvery: 8, hatOffset: 2 },
  createInstruments: () => notImplemented("defaultPack.createInstruments", "Card 1"),
};

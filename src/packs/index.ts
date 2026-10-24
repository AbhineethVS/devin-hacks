import type { PackId, SoundPack } from "../engine/types";
import { defaultPack } from "./default";

// Card 6 adds Lo-fi, Techno and 8-bit here.
export const PACKS: readonly SoundPack[] = [defaultPack];

export function getPack(id: PackId): SoundPack {
  return PACKS.find((p) => p.id === id) ?? defaultPack;
}

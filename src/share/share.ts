import { notImplemented } from "../notImplemented";
import type { ShareState } from "../engine/types";

// STUB (Card 10): `#c=<lz-string(code)>&l=<lang>&p=<pack>&b=<bpm>&m=<mode>` (CONTRACTS.md §11).
export function encodeShareHash(_state: ShareState): string {
  return notImplemented("encodeShareHash", "Card 10");
}

// STUB (Card 10): returns null when the hash has no share state.
export function decodeShareHash(_hash: string): ShareState | null {
  return notImplemented("decodeShareHash", "Card 10");
}

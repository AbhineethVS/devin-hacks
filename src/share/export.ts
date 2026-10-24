import type { Song, SoundPack } from "../engine/types";

// STUB (Card 10): record the song via Tone.Recorder → webm/ogg Blob (skills/audio-export).
export async function exportAudio(_song: Song, _pack: SoundPack): Promise<Blob> {
  throw new Error("Not implemented: exportAudio (Card 10)");
}

import type * as ToneNS from "tone";

// Tone is loaded lazily: importing "tone" creates an AudioContext, which browsers only allow after a
// user gesture (and which unit tests in Node don't need). Call startAudio() from a click handler.

export type ToneModule = typeof ToneNS;

let tone: ToneModule | null = null;
let loading: Promise<ToneModule> | null = null;

/** Loads Tone.js without starting audio (e.g. to warm the chunk on hover). Safe to call repeatedly. */
export function loadTone(): Promise<ToneModule> {
  loading ??= import("tone").then((mod) => {
    tone = mod;
    return mod;
  });
  return loading;
}

/** Call from a click/keydown handler before the first play: loads Tone and resumes the AudioContext. */
export async function startAudio(): Promise<void> {
  const T = await loadTone();
  await T.start();
}

/** True once startAudio() (or loadTone()) has finished loading Tone. */
export function isAudioLoaded(): boolean {
  return tone !== null;
}

/** The loaded Tone module. Throws a clear error if startAudio() hasn't run yet. */
export function getTone(): ToneModule {
  if (!tone) {
    throw new Error("Audio not started: call startAudio() from a click handler before playing.");
  }
  return tone;
}

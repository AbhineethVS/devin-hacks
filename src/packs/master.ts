import type * as ToneNS from "tone";
import { getTone } from "../engine/audio";

// The shared master chain every pack routes into: one Limiter(-2) → speakers, with a waveform
// analyser tapped after the limiter for the visualizer. Created once, lazily, after startAudio().

interface Master {
  limiter: ToneNS.Limiter;
  analyser: ToneNS.Analyser;
}

let master: Master | null = null;

function getMaster(): Master {
  if (master) return master;
  const T = getTone();
  const limiter = new T.Limiter(-2).toDestination();
  const analyser = new T.Analyser("waveform", 1024);
  limiter.connect(analyser);
  master = { limiter, analyser };
  return master;
}

/** The node every pack instrument connects to (the master limiter). */
export function getMasterInput(): ToneNS.Limiter {
  return getMaster().limiter;
}

/** The shared Tone.Analyser("waveform", 1024) after the limiter. */
export function getToneAnalyser(): ToneNS.Analyser {
  return getMaster().analyser;
}

/**
 * The analyser's underlying AnalyserNode, for createVisualizer(canvas, analyser).
 * Requires startAudio() first. Tone doesn't expose the node publicly, so we read its internal
 * `_analysers[0]` (Tone 15.1); if that ever changes we fail loudly here instead of drawing nothing.
 */
export function getAnalyser(): AnalyserNode {
  const inner = (getToneAnalyser() as unknown as { _analysers?: AnalyserNode[] })._analysers?.[0];
  if (!inner) throw new Error("Tone.Analyser internals changed: no underlying AnalyserNode found");
  return inner;
}

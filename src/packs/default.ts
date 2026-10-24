import type * as ToneNS from "tone";
import { getTone } from "../engine/audio";
import type { Instrument, Instruments, SoundPack } from "../engine/types";
import { getMasterInput } from "./master";

export { getAnalyser } from "./master";

// Default pack per docs/SOUND_DESIGN.md: triangle lead, FM bell, saw bass, reverb 0.22 on the
// lead/bell/pad sends, everything through the shared Limiter(-2). Mix levels from "Mixing";
// pad, drone, crash, openhat aren't in the doc's list, so they get conservative levels.

/** Instrument plus an optional release (cut sustained notes on stop); the scheduler duck-types it. */
type PackInstrument = Instrument & { release?: () => void };

const VOLUMES = {
  kick: -4,
  snare: -10,
  hat: -12,
  openhat: -14,
  rim: -20,
  lead: -8,
  bell: -10,
  bass: -10,
  pad: -16,
  drone: -10,
  crash: -14,
} as const;

function createDefaultInstruments(): Instruments {
  const T = getTone();
  const out = getMasterInput();
  // Shared reverb bus for lead/bell/pad (wet 0.22). Freed once every voice has been disposed.
  const reverb = new T.Reverb({ decay: 2.2, wet: 0.22 }).connect(out);
  const voices = 11;
  let alive = voices;
  const freeShared = (): void => {
    alive--;
    if (alive === 0) reverb.dispose();
  };

  function make(
    nodes: ToneNS.ToneAudioNode[],
    trigger: Instrument["trigger"],
    release?: () => void,
  ): PackInstrument {
    let disposed = false;
    return {
      trigger,
      release,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const n of nodes) n.dispose();
        freeShared();
      },
    };
  }

  const lead = new T.PolySynth(T.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.4 },
    volume: VOLUMES.lead,
  }).connect(reverb);

  const bell = new T.PolySynth(T.FMSynth, {
    harmonicity: 3,
    modulationIndex: 8,
    envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.6 },
    volume: VOLUMES.bell,
  }).connect(reverb);

  const bass = new T.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 2, type: "lowpass" },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, baseFrequency: 120, octaves: 2.5 },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.2 },
    volume: VOLUMES.bass,
  }).connect(out);

  const kick = new T.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    volume: VOLUMES.kick,
  }).connect(out);

  // Drums use the filtered-noise recipe from the original sound test: `;` `(` `)` `,` `=` are the
  // most common tokens, so soft high-passed noise keeps them crisp instead of harsh or metallic.
  const snareFilter = new T.Filter(1800, "highpass").connect(out);
  const snare = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: VOLUMES.snare,
  }).connect(snareFilter);

  const hatFilter = new T.Filter(7000, "highpass").connect(out);
  const hat = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: VOLUMES.hat,
  }).connect(hatFilter);

  const openhatFilter = new T.Filter(6000, "highpass").connect(out);
  const openhat = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    volume: VOLUMES.openhat,
  }).connect(openhatFilter);

  const rimFilter = new T.Filter(2500, "bandpass").connect(out);
  const rim = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: VOLUMES.rim,
  }).connect(rimFilter);

  const padFilter = new T.Filter(1400, "lowpass").connect(reverb);
  const pad = new T.PolySynth(T.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
    envelope: { attack: 0.25, decay: 0.3, sustain: 0.6, release: 1.2 },
    volume: VOLUMES.pad,
  }).connect(padFilter);

  // Infinite-loop drone: distorted FM on A1 (the note is fixed by the sound design).
  const droneDist = new T.Distortion(0.6).connect(out);
  const drone = new T.FMSynth({
    harmonicity: 1.01,
    modulationIndex: 20,
    envelope: { attack: 0.5, decay: 0, sustain: 1, release: 1 },
    volume: VOLUMES.drone,
  }).connect(droneDist);

  const crash = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 1.4, release: 0.6 },
    harmonicity: 5.1,
    modulationIndex: 40,
    resonance: 5000,
    octaves: 2,
    volume: VOLUMES.crash,
  }).connect(out);

  return {
    lead: make(
      [lead],
      (note, dur, time, vel) => lead.triggerAttackRelease(note ?? "A4", dur, time, vel),
      () => lead.releaseAll(),
    ),
    bell: make(
      [bell],
      (note, dur, time, vel) => bell.triggerAttackRelease(note ?? "A4", dur, time, vel),
      () => bell.releaseAll(),
    ),
    pad: make(
      [pad, padFilter],
      (note, dur, time, vel) => pad.triggerAttackRelease(note ?? "A3", dur, time, vel),
      () => pad.releaseAll(),
    ),
    bass: make([bass], (note, dur, time, vel) =>
      bass.triggerAttackRelease(note ?? "A2", dur, time, vel),
    ),
    kick: make([kick], (note, dur, time, vel) =>
      kick.triggerAttackRelease(note ?? "C1", dur, time, vel),
    ),
    snare: make([snare, snareFilter], (_note, dur, time, vel) =>
      snare.triggerAttackRelease(dur, time, vel),
    ),
    // Hats are short ticks whatever the step length, so they never smear into each other.
    hat: make([hat, hatFilter], (_note, _dur, time, vel) =>
      hat.triggerAttackRelease("32n", time, vel),
    ),
    openhat: make([openhat, openhatFilter], (_note, dur, time, vel) =>
      openhat.triggerAttackRelease(dur, time, vel),
    ),
    rim: make([rim, rimFilter], (note, _dur, time, vel) =>
      rim.triggerAttackRelease(note ?? "C6", "32n", time, vel),
    ),
    drone: make(
      [drone, droneDist],
      (_note, dur, time, vel) => drone.triggerAttackRelease("A1", dur, time, vel),
      () => {
        // Cancel the scheduled attack/2-bar release, then fade out now.
        const now = T.now();
        drone.envelope.cancel(now);
        drone.modulationEnvelope.cancel(now);
        drone.triggerRelease(now);
      },
    ),
    crash: make([crash], (_note, dur, time, vel) =>
      crash.triggerAttackRelease(300, dur, time, vel),
    ),
  };
}

// Pack data from docs/SOUND_DESIGN.md. Tone nodes are only created when createInstruments() runs
// (after startAudio()), never at import time.
export const defaultPack: SoundPack = {
  id: "default",
  name: "Default",
  scale: ["A", "C", "D", "E", "G"],
  rootOctave: 4,
  bpm: 112,
  backing: { kickEvery: 8, hatOffset: 2 },
  createInstruments: createDefaultInstruments,
};

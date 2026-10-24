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

const HAT_HZ = 250;

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
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.4 },
    volume: VOLUMES.lead,
  }).connect(reverb);

  const bell = new T.PolySynth(T.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 12,
    envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
    volume: VOLUMES.bell,
  }).connect(reverb);

  const bass = new T.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 2, type: "lowpass" },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, baseFrequency: 120, octaves: 3 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2 },
    volume: VOLUMES.bass,
  }).connect(out);

  const kick = new T.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    volume: VOLUMES.kick,
  }).connect(out);

  const snare = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.05 },
    volume: VOLUMES.snare,
  }).connect(out);

  const hat = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: VOLUMES.hat,
  }).connect(out);

  const openhat = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: VOLUMES.openhat,
  }).connect(out);

  const rim = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    volume: VOLUMES.rim,
  }).connect(out);

  const padFilter = new T.Filter(1400, "lowpass").connect(reverb);
  const pad = new T.PolySynth(T.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
    envelope: { attack: 0.25, decay: 0.3, sustain: 0.6, release: 1.2 },
    volume: VOLUMES.pad,
  }).connect(padFilter);

  // Infinite-loop drone: distorted FM on A1 (the note is fixed by the sound design).
  const droneDist = new T.Distortion(0.6).connect(out);
  const drone = new T.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 8,
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.6 },
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
    snare: make([snare], (_note, dur, time, vel) => snare.triggerAttackRelease(dur, time, vel)),
    hat: make([hat], (_note, dur, time, vel) => hat.triggerAttackRelease(HAT_HZ, dur, time, vel)),
    openhat: make([openhat], (_note, dur, time, vel) =>
      openhat.triggerAttackRelease(HAT_HZ, dur, time, vel),
    ),
    rim: make([rim], (note, dur, time, vel) =>
      rim.triggerAttackRelease(note ?? "C6", dur, time, vel),
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

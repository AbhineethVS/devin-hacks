import { getTone, isAudioLoaded } from "./audio";
import type { Instrument, Instruments, Player, Song, SoundPack, Step, Voice } from "./types";

export { startAudio, loadTone } from "./audio";

// Scheduler per skills/tone-scheduling: transport scheduleRepeat drives steps, UI callbacks go
// through Draw, mono-synth start-time collisions are nudged, and stop cleans everything up.

/** The bits of Tone's Transport the player uses (injectable so tests run without an AudioContext). */
export interface TransportLike {
  bpm: { value: number };
  scheduleRepeat(cb: (time: number) => void, interval: string, startTime?: number): number;
  clear(id: number): unknown;
  start(time?: string | number): unknown;
  stop(time?: string | number): unknown;
}

/** The bits of Tone's Draw the player uses. */
export interface DrawLike {
  schedule(cb: () => void, time: number): unknown;
  cancel(after?: number): unknown;
}

export interface SchedulerDeps {
  transport: TransportLike;
  draw: DrawLike;
}

/** Instruments may also offer `release()` to cut held notes (the drone) on stop. */
type ReleasableInstrument = Instrument & { release?: () => void };

/** The contract Player plus a few extras the UI needs. */
export interface SyntunePlayer extends Player {
  /** Toggle the pack's backing beat (on by default). Applies from the next step. */
  setBacking(on: boolean): void;
  /** True between play() and stop()/the end of the song. */
  isPlaying(): boolean;
  /** Stop and free every instrument node (e.g. before switching packs for good). */
  dispose(): void;
}

/** Mono synths throw if two notes start at the same instant; nudge by 3 ms per voice. */
export const COLLISION_NUDGE_S = 0.003;
/** Backing beat velocity (docs/SOUND_DESIGN.md: "velocity ~0.4"). */
export const BACKING_VELOCITY = 0.4;
const DEFAULT_VELOCITY = 1;
const DEFAULT_DURATION: Partial<Record<Voice, string>> = { drone: "2m", pad: "4n", crash: "2n" };
const MIN_BPM = 20;
const MAX_BPM = 400;

function toneDeps(): SchedulerDeps {
  const T = getTone();
  return { transport: T.getTransport(), draw: T.getDraw() };
}

function validBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) throw new Error(`Invalid BPM: ${bpm}`);
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

/**
 * Creates the Player (CONTRACTS.md §7). Without `deps` it uses Tone's transport and draw, so
 * startAudio() must have run first (play() throws a clear error otherwise).
 */
export function createPlayer(deps?: SchedulerDeps): SyntunePlayer {
  const stepCbs: ((step: Step, index: number) => void)[] = [];
  const endCbs: (() => void)[] = [];
  const lastStart = new Map<Voice, number>();
  let backingOn = true;
  let instruments: Instruments | null = null;
  let instrumentsPack: SoundPack | null = null;
  let active: SchedulerDeps | null = null;
  let repeatId: number | null = null;
  let stepIndex = 0;
  // Bumped on every play/stop so a stale end-of-song Draw callback can't stop a newer song.
  let generation = 0;
  let warned = false;

  const resolveDeps = (): SchedulerDeps => deps ?? toneDeps();

  function instrumentsFor(pack: SoundPack): Instruments {
    if (instruments && instrumentsPack === pack) return instruments;
    disposeInstruments();
    instruments = pack.createInstruments();
    instrumentsPack = pack;
    return instruments;
  }

  function disposeInstruments(): void {
    if (!instruments) return;
    for (const inst of Object.values(instruments)) inst.dispose();
    instruments = null;
    instrumentsPack = null;
  }

  // Never let one bad note crash the music: log once and keep going.
  function trigger(
    voice: Voice,
    note: string | undefined,
    duration: string,
    time: number,
    vel: number,
  ): void {
    const inst = instruments?.[voice];
    if (!inst) return;
    const prev = lastStart.get(voice);
    const t = prev !== undefined && time <= prev ? prev + COLLISION_NUDGE_S : time;
    lastStart.set(voice, t);
    try {
      inst.trigger(note, duration, t, vel);
    } catch (err) {
      if (!warned) {
        warned = true;
        console.warn(`Syntune: a ${voice} note failed and was skipped.`, err);
      }
    }
  }

  function clearSchedule(): void {
    if (active && repeatId !== null) active.transport.clear(repeatId);
    repeatId = null;
  }

  // `releaseHeld` cuts sustained notes (the 2-bar drone) on a manual stop. At the natural end of a
  // song they ring out for their own duration instead, so a final drone isn't cut off.
  function reset(releaseHeld: boolean): void {
    clearSchedule();
    if (active) {
      active.transport.stop();
      active.draw.cancel(0);
    }
    if (releaseHeld && instruments) {
      for (const inst of Object.values(instruments) as ReleasableInstrument[]) inst.release?.();
    }
    active = null;
    stepIndex = 0;
    lastStart.clear();
  }

  function playStep(song: Song, pack: SoundPack, time: number, gen: number): void {
    const d = active;
    if (!d || gen !== generation) return;
    const index = stepIndex;

    if (index >= song.steps.length) {
      // Song over: stop scheduling now, finish on the UI clock so the last highlight lands.
      clearSchedule();
      d.draw.schedule(() => {
        if (gen !== generation) return;
        generation++;
        reset(false);
        for (const cb of endCbs) cb();
      }, time);
      return;
    }

    const step = song.steps[index];
    stepIndex++;
    if (!step) return;

    for (const ev of step.events) {
      const duration = ev.duration ?? DEFAULT_DURATION[ev.voice] ?? "16n";
      trigger(ev.voice, ev.note, duration, time, ev.velocity ?? DEFAULT_VELOCITY);
    }
    const backing = pack.backing;
    if (backingOn && backing) {
      if (index % backing.kickEvery === 0) trigger("kick", "C1", "16n", time, BACKING_VELOCITY);
      if (index % 4 === backing.hatOffset) trigger("hat", undefined, "16n", time, BACKING_VELOCITY);
    }

    d.draw.schedule(() => {
      if (gen !== generation) return;
      for (const cb of stepCbs) cb(step, index);
    }, time);
  }

  function play(song: Song, pack: SoundPack): void {
    const d = resolveDeps();
    stop();
    instrumentsFor(pack);
    active = d;
    const gen = ++generation;
    d.transport.bpm.value = validBpm(song.bpm);
    repeatId = d.transport.scheduleRepeat(
      (time) => playStep(song, pack, time, gen),
      song.subdivision,
      0,
    );
    // Start just past Tone's lookahead (0.1 s): notes from a song we just stopped may already be
    // scheduled that far ahead, and a mono synth throws if a new note starts before them.
    d.transport.start("+0.15");
  }

  function stop(): void {
    generation++;
    reset(true);
  }

  return {
    play,
    stop,
    onStep(cb): void {
      stepCbs.push(cb);
    },
    onEnd(cb): void {
      endCbs.push(cb);
    },
    setBpm(bpm: number): void {
      // Live: applies to the running transport (play() then uses the song's own bpm).
      const d = active ?? deps ?? (isAudioLoaded() ? toneDeps() : null);
      if (d) d.transport.bpm.value = validBpm(bpm);
    },
    setBacking(on: boolean): void {
      backingOn = on;
    },
    isPlaying(): boolean {
      return active !== null;
    },
    dispose(): void {
      stop();
      disposeInstruments();
    },
  };
}

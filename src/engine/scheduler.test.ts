import { describe, expect, it } from "vitest";
import { createPlayer, type DrawLike, type TransportLike } from "./scheduler";
import { VOICES } from "./types";
import type { Instruments, Song, SoundPack, Step, Voice } from "./types";

// A fake transport/draw pair: tick() fires the repeat callback at successive 16th times, and
// flush() runs the queued Draw callbacks, like Tone would on the next animation frame.
function fakeTone() {
  const repeats = new Map<number, (time: number) => void>();
  let draws: { cb: () => void; time: number }[] = [];
  let nextId = 1;
  let now = 0;
  const transport: TransportLike & { started: boolean } = {
    bpm: { value: 120 },
    started: false,
    scheduleRepeat(cb) {
      const id = nextId++;
      repeats.set(id, cb);
      return id;
    },
    clear(id) {
      repeats.delete(id);
    },
    start() {
      transport.started = true;
    },
    stop() {
      transport.started = false;
    },
  };
  const draw: DrawLike = {
    schedule(cb, time) {
      draws.push({ cb, time });
    },
    cancel() {
      draws = [];
    },
  };
  return {
    transport,
    draw,
    repeats,
    pendingDraws: () => draws.length,
    tick(times = 1) {
      for (let i = 0; i < times; i++) {
        now += 0.125;
        for (const cb of [...repeats.values()]) cb(now);
      }
    },
    flush() {
      const run = draws;
      draws = [];
      for (const d of run) d.cb();
    },
  };
}

interface Hit {
  voice: Voice;
  note: string | undefined;
  time: number;
  velocity: number;
}

function fakePack(backing: SoundPack["backing"] = null) {
  const hits: Hit[] = [];
  let created = 0;
  let disposed = 0;
  let released = 0;
  const pack: SoundPack = {
    id: "default",
    name: "Fake",
    scale: ["A", "C", "D", "E", "G"],
    rootOctave: 4,
    bpm: 112,
    backing,
    createInstruments() {
      created++;
      const entries = VOICES.map((voice) => [
        voice,
        {
          trigger: (note: string | undefined, _d: string, time: number, velocity: number) =>
            hits.push({ voice, note, time, velocity }),
          dispose: () => disposed++,
          release: () => released++,
        },
      ]);
      return Object.fromEntries(entries) as Instruments;
    },
  };
  return {
    pack,
    hits,
    counts: () => ({ created, disposed, released }),
  };
}

const step = (line: number, voice?: Voice): Step => ({
  events: voice ? [{ voice }] : [],
  highlight: { line, token: 0 },
});
const songOf = (steps: Step[], bpm = 100): Song => ({
  steps,
  subdivision: "16n",
  bpm,
  mode: "file",
  info: "test",
});

describe("createPlayer with a fake transport", () => {
  it("fires onStep in order through Draw, then onEnd once at the end", () => {
    const tone = fakeTone();
    const { pack, hits } = fakePack();
    const player = createPlayer(tone);
    const seen: number[] = [];
    let ended = 0;
    player.onStep((s, i) => seen.push(i * 100 + s.highlight.line));
    player.onEnd(() => ended++);

    player.play(songOf([step(1, "snare"), step(2, "lead"), step(3)]), pack);
    expect(tone.transport.started).toBe(true);
    expect(tone.transport.bpm.value).toBe(100);

    tone.tick(3);
    expect(seen).toEqual([]); // UI callbacks wait for Draw
    expect(hits.map((h) => h.voice)).toEqual(["snare", "lead"]);
    tone.flush();
    expect(seen).toEqual([1, 102, 203]);
    expect(ended).toBe(0);

    tone.tick(); // one tick past the last step ends the song
    expect(tone.repeats.size).toBe(0);
    tone.flush();
    expect(ended).toBe(1);
    expect(tone.transport.started).toBe(false);
    expect(player.isPlaying()).toBe(false);
  });

  it("stop leaves nothing scheduled and no stale callbacks fire", () => {
    const tone = fakeTone();
    const { pack, counts } = fakePack();
    const player = createPlayer(tone);
    let stepCalls = 0;
    let ended = 0;
    player.onStep(() => stepCalls++);
    player.onEnd(() => ended++);

    player.play(songOf([step(1), step(2), step(3)]), pack);
    tone.tick(2);
    player.stop();
    expect(tone.repeats.size).toBe(0);
    expect(tone.pendingDraws()).toBe(0);
    expect(tone.transport.started).toBe(false);
    expect(counts().released).toBe(VOICES.length);
    tone.tick(5);
    tone.flush();
    expect(stepCalls).toBe(0);
    expect(ended).toBe(0);
  });

  it("play after play replaces the song and reuses the instruments", () => {
    const tone = fakeTone();
    const { pack, counts } = fakePack();
    const player = createPlayer(tone);
    const lines: number[] = [];
    player.onStep((s) => lines.push(s.highlight.line));

    player.play(songOf([step(1), step(1)]), pack);
    tone.tick();
    player.play(songOf([step(7)]), pack);
    expect(tone.repeats.size).toBe(1);
    tone.tick();
    tone.flush();
    expect(lines).toEqual([7]);
    expect(counts().created).toBe(1);
  });

  it("switching packs disposes the old instruments", () => {
    const tone = fakeTone();
    const a = fakePack();
    const b = fakePack();
    const player = createPlayer(tone);
    player.play(songOf([step(1)]), a.pack);
    player.play(songOf([step(1)]), b.pack);
    expect(a.counts().disposed).toBe(VOICES.length);
    player.dispose();
    expect(b.counts().disposed).toBe(VOICES.length);
  });

  it("nudges same-instant notes on one voice by 3 ms (backing kick + `{` kick)", () => {
    const tone = fakeTone();
    const { pack, hits } = fakePack({ kickEvery: 8, hatOffset: 2 });
    const player = createPlayer(tone);
    player.play(songOf([step(1, "kick")]), pack);
    tone.tick();
    const kicks = hits.filter((h) => h.voice === "kick");
    expect(kicks).toHaveLength(2);
    expect((kicks[1]?.time ?? 0) - (kicks[0]?.time ?? 0)).toBeCloseTo(0.003, 6);
  });

  it("backing: soft kick every kickEvery steps, soft hat at hatOffset of each beat; toggleable", () => {
    const tone = fakeTone();
    const { pack, hits } = fakePack({ kickEvery: 8, hatOffset: 2 });
    const player = createPlayer(tone);
    player.play(songOf(Array.from({ length: 16 }, (_, i) => step(i + 1))), pack);
    tone.tick(16);
    const at = (voice: Voice) =>
      hits.filter((h) => h.voice === voice).map((h) => Math.round(h.time / 0.125) - 1);
    expect(at("kick")).toEqual([0, 8]);
    expect(at("hat")).toEqual([2, 6, 10, 14]);
    expect(hits.every((h) => h.velocity === 0.4)).toBe(true);

    hits.length = 0;
    player.setBacking(false);
    player.play(songOf([step(1), step(2), step(3)]), pack);
    tone.tick(3);
    expect(hits).toEqual([]);
  });

  it("setBpm applies live and rejects nonsense", () => {
    const tone = fakeTone();
    const { pack } = fakePack();
    const player = createPlayer(tone);
    player.play(songOf([step(1)], 112), pack);
    player.setBpm(150);
    expect(tone.transport.bpm.value).toBe(150);
    expect(() => player.setBpm(Number.NaN)).toThrow(/Invalid BPM/);
  });

  it("a throwing instrument doesn't stop the song", () => {
    const tone = fakeTone();
    const { pack } = fakePack();
    const broken: SoundPack = {
      ...pack,
      createInstruments() {
        const inst = pack.createInstruments();
        inst.snare = {
          trigger: () => {
            throw new Error("Start time must be strictly greater");
          },
          dispose: () => {},
        };
        return inst;
      },
    };
    const player = createPlayer(tone);
    const seen: number[] = [];
    player.onStep((_s, i) => seen.push(i));
    const warn = console.warn;
    console.warn = () => {};
    try {
      player.play(songOf([step(1, "snare"), step(2, "snare")]), broken);
      tone.tick(2);
      tone.flush();
    } finally {
      console.warn = warn;
    }
    expect(seen).toEqual([0, 1]);
  });

  it("without injected deps, play fails loudly until startAudio() has run", () => {
    const { pack } = fakePack();
    expect(() => createPlayer().play(songOf([]), pack)).toThrow(/startAudio/);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SoundPack, Token, TokenKind, TraceItem, TraceResult } from "../engine/types";
import { INFINITE_MESSAGE, buildRunSong, hasArrayWrite, valueDegree } from "./runSong";

// Card 1 owns the real mapping; these stand-ins follow docs/SOUND_DESIGN.md closely enough to test Run mode.
vi.mock("../engine/mapping", () => {
  const noteFromDegree = (degree: number, octave: number, pack: SoundPack): string => {
    const n = pack.scale.length;
    const d = Math.round(degree);
    return `${pack.scale[((d % n) + n) % n]}${octave + Math.floor(d / n)}`;
  };
  return {
    noteFromDegree,
    stableHash: (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
    soundForToken: (tok: Token, _depth: number, pack: SoundPack) =>
      tok.kind === "kw"
        ? [
            {
              voice: "bell",
              note: noteFromDegree(tok.text === "if" ? 2 : 0, 4, pack),
              velocity: 0.5,
            },
            { voice: "bass", note: noteFromDegree(0, 2, pack) },
          ]
        : [],
  };
});

const pack: SoundPack = {
  id: "default",
  name: "Default",
  scale: ["A", "C", "D", "E", "G"],
  rootOctave: 4,
  bpm: 112,
  backing: null,
  createInstruments: () => {
    throw new Error("not used in tests");
  },
};

/** Hand-built tokens for one line: [text, kind] pairs. */
function line(lineNo: number, parts: [string, TokenKind][]): Token[] {
  return parts.map(([text, kind], index) => ({ text, kind, line: lineNo, col: index, index }));
}

const LINES: Token[][] = [
  line(1, [
    ["for", "kw"],
    ["(", "punct"],
    ["i", "id"],
    [")", "punct"],
    ["{", "punct"],
  ]),
  line(2, [
    ["arr", "id"],
    ["[", "punct"],
    ["j", "id"],
    ["]", "punct"],
    ["=", "op"],
    ["x", "id"],
    [";", "punct"],
  ]),
  line(3, [
    ["if", "kw"],
    ["(", "punct"],
    ["n", "id"],
    [")", "punct"],
    [";", "punct"],
  ]),
  line(4, [
    ["total", "id"],
    ["+=", "op"],
    ["1", "num"],
    [";", "punct"],
  ]),
];

function trace(items: Partial<TraceItem>[], extra: Partial<TraceResult> = {}): TraceResult {
  return {
    items: items.map((i) => ({ line: 4, values: [], depth: 0, ...i })),
    infinite: false,
    durationMs: 1,
    ...extra,
  };
}

const PITCHED = new Set(["lead", "bell", "bass", "pad", "drone"]);

describe("buildRunSong", () => {
  it("builds a 16n run-mode song with one step per trace item", () => {
    const song = buildRunSong(trace([{ line: 1 }, { line: 4 }]), LINES, pack, 99);
    expect(song).toMatchObject({ subdivision: "16n", bpm: 99, mode: "run" });
    expect(song.steps.map((s) => s.highlight)).toEqual([{ line: 1 }, { line: 4 }]);
  });

  it("an infinite trace plays 48 steps then a 2-bar drone on A1", () => {
    const items = Array.from({ length: 300 }, () => ({ line: 4, values: [3] }));
    const song = buildRunSong(trace(items, { infinite: true }), LINES, pack, 112);
    expect(song.steps).toHaveLength(49);
    const last = song.steps.at(-1);
    expect(last?.message).toBe(INFINITE_MESSAGE);
    expect(last?.events).toEqual([{ voice: "drone", note: "A1", velocity: 0.8, duration: "2m" }]);
  });

  it("an infinite run killed by the timeout (no items) still drones", () => {
    const song = buildRunSong(trace([], { infinite: true }), LINES, pack, 112);
    expect(song.steps).toHaveLength(1);
    expect(song.steps[0]?.message).toBe(INFINITE_MESSAGE);
  });

  it("a runtime error ends with a crash and a low kick", () => {
    const song = buildRunSong(trace([{ line: 3 }], { error: "TypeError: boom" }), LINES, pack, 112);
    const last = song.steps.at(-1);
    expect(last?.message).toBe("Crashed: TypeError: boom");
    expect(last?.highlight).toEqual({ line: 3 });
    expect(last?.events.map((e) => e.voice)).toEqual(["crash", "kick"]);
  });

  it("a { line kicks, a ; line hats, an array write adds a snare", () => {
    const song = buildRunSong(trace([{ line: 1 }, { line: 4 }, { line: 2 }]), LINES, pack, 112);
    const voices = song.steps.map((s) => s.events.map((e) => e.voice));
    expect(voices[0]).toContain("kick");
    expect(voices[1]).toContain("hat");
    expect(voices[1]).not.toContain("snare");
    expect(voices[2]).toEqual(expect.arrayContaining(["hat", "snare"]));
    expect(song.steps[2]?.events.find((e) => e.voice === "snare")?.velocity).toBe(0.8);
  });

  it("the first keyword rings a bell at velocity 0.6", () => {
    const song = buildRunSong(trace([{ line: 3 }]), LINES, pack, 112);
    expect(song.steps[0]?.events.filter((e) => e.voice === "bell")).toEqual([
      { voice: "bell", note: "D4", velocity: 0.6 },
    ]);
  });

  it("melody comes from the last value; deeper recursion climbs", () => {
    const song = buildRunSong(
      trace([
        { values: [9, 2], depth: 0 },
        { values: [2], depth: 1, fn: "f" },
        { values: [2], depth: 3, fn: "f" },
      ]),
      LINES,
      pack,
      112,
    );
    const leads = song.steps.map((s) => s.events.find((e) => e.voice === "lead")?.note);
    expect(leads).toEqual(["D4", "E4", "A6"]); // degree 2, 2+1, 2+3=5 at octave 5 (depth > 1)
    expect(song.steps[2]?.meta).toEqual({ depth: 3, fn: "f" });
  });

  it("falls back to the first identifier when there is no value", () => {
    const song = buildRunSong(trace([{ line: 2 }]), LINES, pack, 112);
    expect(song.steps[0]?.events.some((e) => e.voice === "lead")).toBe(true);
  });

  it("plays a pad when entering a function", () => {
    const song = buildRunSong(
      trace([{ depth: 0 }, { depth: 1, fn: "f" }, { depth: 1, fn: "f" }]),
      LINES,
      pack,
      112,
    );
    const pads = song.steps.map((s) => s.events.filter((e) => e.voice === "pad").length);
    expect(pads).toEqual([0, 1, 0]);
  });

  it("maps negative and fractional values into degrees 0..9", () => {
    expect(valueDegree(-3)).toBe(7);
    expect(valueDegree(12.6)).toBe(3);
    expect(valueDegree(-0.2)).toBe(0);
  });

  it("detects array element writes but not reads or comparisons", () => {
    expect(hasArrayWrite(LINES[1] ?? [])).toBe(true);
    const read = line(1, [
      ["x", "id"],
      ["=", "op"],
      ["a", "id"],
      ["[", "punct"],
      ["0", "num"],
      ["]", "punct"],
    ]);
    const compare = line(1, [
      ["a", "id"],
      ["[", "punct"],
      ["0", "num"],
      ["]", "punct"],
      ["==", "op"],
      ["1", "num"],
    ]);
    expect(hasArrayWrite(read)).toBe(false);
    expect(hasArrayWrite(compare)).toBe(false);
  });

  it("every pitched note is in the pack's scale, for any values and depths", () => {
    const items = Array.from({ length: 60 }, (_, k) => ({
      line: (k % 4) + 1,
      values: k % 3 ? [k * 7.3 - 200] : [],
      depth: k % 9,
      fn: k % 2 ? "fib" : undefined,
    }));
    const song = buildRunSong(trace(items, { infinite: true }), LINES, pack, 112);
    for (const step of song.steps) {
      for (const e of step.events) {
        if (!PITCHED.has(e.voice)) continue;
        expect(pack.scale).toContain(e.note?.replace(/-?\d+$/, ""));
      }
    }
  });
});

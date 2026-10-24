import { describe, expect, it } from "vitest";
import { defaultPack } from "../packs/default";
import { buildFileSong } from "./fileSong";
import { tokenize } from "./tokenize";

const song = (code: string, lang: "js" | "c" | "python" = "js") =>
  buildFileSong(tokenize(code, lang), defaultPack, 112);

describe("buildFileSong", () => {
  it("one token per 16th step, each line padded to a multiple of 4", () => {
    const s = song("a;\nfoo(x);");
    // "a ;" → 2 tokens → 4 steps; "foo ( x ) ;" → 5 tokens → 8 steps.
    expect(s.steps).toHaveLength(12);
    expect(s).toMatchObject({ subdivision: "16n", bpm: 112, mode: "file" });
    expect(s.steps[0]?.events[0]?.voice).toBe("lead");
    expect(s.steps[1]?.events[0]?.voice).toBe("snare");
    expect(s.steps[2]?.events).toEqual([]);
    expect(s.steps[3]?.events).toEqual([]);
  });

  it("a line of exactly 4 tokens isn't padded", () => {
    expect(song("x = 1;").steps).toHaveLength(4);
  });

  it("highlights each token by line and index", () => {
    const s = song("a;\nb = c;");
    expect(s.steps.map((st) => st.highlight)).toEqual([
      { line: 1, token: 0 },
      { line: 1, token: 1 },
      { line: 1, token: 1 },
      { line: 1, token: 1 },
      { line: 2, token: 0 },
      { line: 2, token: 1 },
      { line: 2, token: 2 },
      { line: 2, token: 3 },
    ]);
  });

  it("a comment-only line is a 4-step rest with a soft pad chord", () => {
    const s = song("// hello there");
    expect(s.steps).toHaveLength(4);
    const first = s.steps[0]?.events ?? [];
    expect(first.length).toBeGreaterThan(1);
    for (const ev of first) {
      expect(ev.voice).toBe("pad");
      expect(ev.velocity).toBeLessThanOrEqual(0.4);
      expect(defaultPack.scale).toContain(ev.note?.replace(/-?\d+$/, ""));
    }
    expect(s.steps.slice(1).every((st) => st.events.length === 0)).toBe(true);
    expect(s.steps.every((st) => st.highlight.line === 1)).toBe(true);
  });

  it("each line of a multi-line block comment is a pad rest", () => {
    expect(song("/* a\n b\n c */", "c").steps).toHaveLength(12);
  });

  it("empty lines are skipped", () => {
    expect(song("a;\n\n\n   \nb;").steps).toHaveLength(8);
    expect(song("").steps).toHaveLength(0);
  });

  it("deeply indented identifiers move up an octave", () => {
    const s = song("x;\n  x;\n    x;");
    const notes = [0, 4, 8].map((i) => s.steps[i]?.events[0]?.note);
    expect(notes[0]).toBe(notes[1]);
    expect(notes[2]).not.toBe(notes[0]);
    expect(notes[2]?.slice(0, -1)).toBe(notes[0]?.slice(0, -1));
  });
});

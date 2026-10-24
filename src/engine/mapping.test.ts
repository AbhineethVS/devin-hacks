import { describe, expect, it } from "vitest";
import { defaultPack } from "../packs/default";
import { KEYWORD_DEGREES, noteFromDegree, soundForToken, stableHash } from "./mapping";
import type { Token, TokenKind } from "./types";

const tok = (text: string, kind: TokenKind): Token => ({ text, kind, line: 1, col: 0, index: 0 });
const sound = (text: string, kind: TokenKind, depth = 0) =>
  soundForToken(tok(text, kind), depth, defaultPack);
const pitchClass = (note: string | undefined) => note?.replace(/-?\d+$/, "");

describe("noteFromDegree", () => {
  it("walks the scale and wraps into the next octave", () => {
    expect(noteFromDegree(0, 4, defaultPack)).toBe("A4");
    expect(noteFromDegree(4, 4, defaultPack)).toBe("G4");
    expect(noteFromDegree(5, 4, defaultPack)).toBe("A5");
    expect(noteFromDegree(7, 2, defaultPack)).toBe("D3");
  });

  it("handles negative degrees", () => {
    expect(noteFromDegree(-1, 4, defaultPack)).toBe("G3");
    expect(noteFromDegree(-5, 4, defaultPack)).toBe("A3");
    expect(noteFromDegree(-6, 4, defaultPack)).toBe("G2");
  });

  it("is always in the scale", () => {
    for (let d = -20; d <= 20; d++) {
      expect(defaultPack.scale).toContain(pitchClass(noteFromDegree(d, 4, defaultPack)));
    }
  });
});

describe("stableHash", () => {
  it("is deterministic, unsigned and spreads names", () => {
    expect(stableHash("arr")).toBe(stableHash("arr"));
    expect(stableHash("arr")).not.toBe(stableHash("tmp"));
    expect(stableHash("")).toBe(0x811c9dc5);
    expect(stableHash("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("soundForToken (docs/SOUND_DESIGN.md table)", () => {
  it("punctuation drums", () => {
    expect(sound(";", "punct")).toEqual([{ voice: "snare", duration: "16n" }]);
    expect(sound("{", "punct")[0]).toMatchObject({ voice: "kick", note: "C1" });
    expect(sound("}", "punct")[0]).toMatchObject({ voice: "kick", note: "G0" });
    expect(sound("(", "punct")[0]).toMatchObject({ voice: "hat" });
    expect(sound(")", "punct")[0]?.velocity).toBeUndefined();
    expect(sound("[", "punct")[0]).toMatchObject({ voice: "hat", velocity: 0.8 });
    expect(sound(",", "punct")[0]).toMatchObject({ voice: "hat", velocity: 0.5 });
    expect(sound(".", "punct")[0]).toMatchObject({ voice: "rim", note: "C6", velocity: 0.4 });
    expect(sound(":", "punct")[0]).toMatchObject({ voice: "rim", note: "C6", velocity: 0.4 });
  });

  it("operators", () => {
    for (const op of ["<", ">", "<=", ">=", "==", "===", "!=", "!=="]) {
      expect(sound(op, "op")[0]).toMatchObject({ voice: "rim", note: "E6" });
    }
    for (const op of ["=", "+=", "-=", "*=", "/="]) {
      expect(sound(op, "op")[0]).toMatchObject({ voice: "hat", velocity: 0.6 });
    }
    expect(sound("+", "op")[0]).toMatchObject({ voice: "rim", note: "A5", velocity: 0.7 });
    expect(sound("++", "op")[0]).toMatchObject({ voice: "rim", note: "A5" });
  });

  it("type keywords play bass degree 0 at octave 2", () => {
    for (const t of ["let", "const", "var", "int", "float", "double", "char", "long", "bool"]) {
      expect(sound(t, "type")).toEqual([{ voice: "bass", note: "A2", duration: "8n" }]);
    }
  });

  it("keywords play bell (octave 4) + bass (octave 2) at the table degree", () => {
    const table: [string, number][] = [
      ["for", 0],
      ["while", 1],
      ["do", 1],
      ["if", 2],
      ["switch", 2],
      ["else", 3],
      ["false", 3],
      ["return", 4],
      ["case", 4],
      ["function", 5],
      ["def", 5],
      ["fn", 5],
      ["new", 6],
      ["break", 7],
      ["continue", 7],
      ["true", 8],
      ["null", 9],
      ["None", 9],
      ["typeof", 0],
    ];
    for (const [word, degree] of table) {
      const [bell, bass] = sound(word, "kw");
      expect(bell).toMatchObject({ voice: "bell", note: noteFromDegree(degree, 4, defaultPack) });
      expect(bass).toMatchObject({ voice: "bass", note: noteFromDegree(degree, 2, defaultPack) });
    }
    expect(Object.keys(KEYWORD_DEGREES)).toHaveLength(18);
    expect(sound("True", "kw")[0]?.note).toBe(noteFromDegree(8, 4, defaultPack));
  });

  it("numbers play bass at degree round(n) mod 10, octave 2", () => {
    const bassNote = (text: string) => sound(text, "num")[0]?.note;
    expect(bassNote("0")).toBe(noteFromDegree(0, 2, defaultPack));
    expect(bassNote("7")).toBe(noteFromDegree(7, 2, defaultPack));
    expect(bassNote("12")).toBe(noteFromDegree(2, 2, defaultPack));
    expect(bassNote("2.6")).toBe(noteFromDegree(3, 2, defaultPack));
    expect(bassNote("0x10")).toBe(noteFromDegree(6, 2, defaultPack));
    expect(sound("5", "num")[0]?.voice).toBe("bass");
  });

  it("strings play lead at octave 5 from their content length", () => {
    expect(sound('"abc"', "str")[0]).toMatchObject({
      voice: "lead",
      note: noteFromDegree(3, 5, defaultPack),
    });
    // Wrapped mod 10 so long strings stay audible (see the deviation note in mapping.ts).
    expect(sound(`"${"x".repeat(83)}"`, "str")[0]?.note).toBe(noteFromDegree(3, 5, defaultPack));
  });

  it("identifiers are deterministic, in-scale, octave 4 (5 when depth > 1)", () => {
    const a = sound("arr", "id")[0];
    expect(a).toEqual(sound("arr", "id")[0]);
    expect(a?.voice).toBe("lead");
    expect(a?.note).toBe(noteFromDegree(stableHash("arr") % 7, 4, defaultPack));
    expect(sound("arr", "id", 2)[0]?.note).toBe(
      noteFromDegree(stableHash("arr") % 7, 5, defaultPack),
    );
    for (const name of ["i", "j", "tmp", "length", "quicksort", "café"]) {
      for (const depth of [0, 1, 2, 3]) {
        expect(defaultPack.scale).toContain(pitchClass(sound(name, "id", depth)[0]?.note));
      }
    }
  });

  it("comments are silent", () => {
    expect(sound("// hi", "comment")).toEqual([]);
  });
});

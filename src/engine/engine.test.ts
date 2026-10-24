import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenize";
import { buildFileSong } from "./fileSong";
import { VOICES } from "./types";
import { defaultPack } from "../packs/default";
import { PRESETS } from "../presets";

describe("engine wiring", () => {
  it("tokenize returns one array per line with 1-based lines", () => {
    const lines = tokenize("let a = 1;\n\nfoo()", "js");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.[0]).toMatchObject({ text: "let", line: 1, col: 0, index: 0 });
    expect(lines[1]).toEqual([]);
  });

  it("every preset builds a non-empty file song whose pitched notes are in the scale", () => {
    for (const preset of PRESETS) {
      const song = buildFileSong(tokenize(preset.code, preset.lang), defaultPack, 112);
      expect(song.mode).toBe("file");
      expect(song.steps.length % 4).toBe(0);
      expect(song.steps.length).toBeGreaterThan(16);
      for (const step of song.steps) {
        for (const ev of step.events) {
          if (ev.voice === "lead" || ev.voice === "bell" || ev.voice === "bass") {
            expect(defaultPack.scale).toContain(ev.note?.replace(/-?\d+$/, ""));
          }
        }
      }
    }
  });

  it("the same code always builds the same song", () => {
    const code = PRESETS[0]?.code ?? "";
    const a = buildFileSong(tokenize(code, "js"), defaultPack, 112);
    const b = buildFileSong(tokenize(code, "js"), defaultPack, 112);
    expect(a).toEqual(b);
  });

  it("lists every voice", () => {
    expect(VOICES).toHaveLength(11);
  });
});

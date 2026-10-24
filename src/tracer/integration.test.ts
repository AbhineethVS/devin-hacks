import { describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { tokenize } from "../engine/tokenize";
import { buildFileSong } from "../engine/fileSong";
import { defaultPack } from "../packs/default";
import { traceSource } from "./execute";
import { buildRunSong } from "./runSong";
import type { Song } from "../engine/types";

// Card 1 (engine) + Card 2 (tracer) together, with the real mapping (no mocks).
const UNPITCHED = new Set(["kick", "snare", "hat", "openhat", "rim", "crash"]);

function offScaleNotes(song: Song): string[] {
  return song.steps
    .flatMap((s) => s.events)
    .filter((e) => e.note && !UNPITCHED.has(e.voice))
    .map((e) => e.note as string)
    .filter((n) => !defaultPack.scale.includes(n.replace(/-?\d+$/, "")));
}

describe("presets play in both modes with the real engine", () => {
  for (const preset of PRESETS) {
    it(preset.id, () => {
      const lines = tokenize(preset.code, preset.lang);

      const fileSong = buildFileSong(lines, defaultPack, 112);
      expect(fileSong.steps.length).toBeGreaterThan(16);
      expect(offScaleNotes(fileSong)).toEqual([]);

      const trace = traceSource(preset.code, preset.lang);
      const runSong = buildRunSong(trace, lines, defaultPack, 112);
      expect(runSong.steps.length).toBeGreaterThan(16);
      expect(offScaleNotes(runSong)).toEqual([]);

      const last = runSong.steps.at(-1);
      if (preset.id === "infinite-loop") {
        expect(trace.infinite).toBe(true);
        expect(last?.events.some((e) => e.voice === "drone")).toBe(true);
        expect(last?.message).toMatch(/Infinite loop/);
      } else {
        expect(trace.error).toBeUndefined();
        expect(trace.infinite).toBe(false);
      }
    });
  }

  it("is deterministic", () => {
    const p = PRESETS[1]!;
    const song = () =>
      buildRunSong(traceSource(p.code, p.lang), tokenize(p.code, p.lang), defaultPack, 112);
    expect(song()).toEqual(song());
  });
});

import { describe, expect, it } from "vitest";
import { getPack, PACKS } from "./index";

describe("packs", () => {
  it("default pack matches the sound design", () => {
    const pack = getPack("default");
    expect(pack.scale).toEqual(["A", "C", "D", "E", "G"]);
    expect(pack.bpm).toBe(112);
  });

  it("default pack backing beat: kick every 8 steps, hat at step 2 of each beat", () => {
    expect(getPack("default").backing).toEqual({ kickEvery: 8, hatOffset: 2 });
  });

  it("importing a pack creates no audio nodes; instruments need startAudio() first", async () => {
    const { isAudioLoaded } = await import("../engine/audio");
    expect(isAudioLoaded()).toBe(false);
    expect(() => getPack("default").createInstruments()).toThrow(/startAudio/);
  });

  it("unknown packs fall back to default", () => {
    expect(getPack("techno").id).toBe("default");
    expect(PACKS.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { getPack, PACKS } from "./index";

describe("packs", () => {
  it("default pack matches the sound design", () => {
    const pack = getPack("default");
    expect(pack.scale).toEqual(["A", "C", "D", "E", "G"]);
    expect(pack.bpm).toBe(112);
  });

  it("unknown packs fall back to default", () => {
    expect(getPack("techno").id).toBe("default");
    expect(PACKS.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";

describe("presets", () => {
  it("has the five demo presets with unique ids", () => {
    expect(PRESETS).toHaveLength(5);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(5);
  });

  it("every preset is valid JavaScript (C preset after the int → let rewrite)", () => {
    for (const p of PRESETS) {
      const js = p.code
        .replace(/\b(int|float|double|char|long)\b(?=\s+[A-Za-z_])/g, "let")
        .replace(/\bprintf\(/g, "void(");
      // Compile only (never run): the infinite-loop preset would hang.
      expect(() => new Function(js), p.id).not.toThrow();
    }
  });
});

import { describe, expect, it } from "vitest";
import { createVisualizer } from "./visualizer";

describe("viz", () => {
  it("exports createVisualizer", () => {
    expect(typeof createVisualizer).toBe("function");
  });
});

import { describe, expect, it } from "vitest";
import { createVisualizer, noteToMidi } from "./visualizer";

describe("visualizer", () => {
  it("exports createVisualizer", () => {
    expect(typeof createVisualizer).toBe("function");
  });

  it("maps note names to MIDI numbers for placing notes by pitch", () => {
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("C1")).toBe(24);
    expect(noteToMidi("G0")).toBe(19);
    expect(noteToMidi("C#4")).toBe(61);
    expect(noteToMidi(undefined)).toBe(60);
    expect(noteToMidi("nope")).toBe(60);
  });
});

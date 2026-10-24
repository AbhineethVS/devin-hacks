import { describe, expect, it } from "vitest";
import { createEditor } from "./editor";

describe("ui", () => {
  it("exports createEditor", () => {
    expect(typeof createEditor).toBe("function");
  });
});

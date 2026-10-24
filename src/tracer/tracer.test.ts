import { describe, expect, it } from "vitest";
import { runTrace } from "./runTrace";
import { instrument } from "./instrument";

describe("tracer stubs", () => {
  it("runTrace rejects instead of faking a result", async () => {
    await expect(runTrace("let a = 1;", "js")).rejects.toThrow(/Not implemented/);
  });

  it("instrument fails loudly", () => {
    expect(() => instrument("let a = 1;", "js")).toThrow(/Not implemented/);
  });
});

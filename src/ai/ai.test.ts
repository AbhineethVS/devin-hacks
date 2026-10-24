import { describe, expect, it } from "vitest";
import { generate } from "./generate";
import { explain } from "./explain";

describe("ai stubs", () => {
  it("reject instead of faking a response", async () => {
    await expect(generate({ prompt: "rain", lang: "js" })).rejects.toThrow(/Not implemented/);
    await expect(
      explain({
        code: "",
        traceSummary: { steps: 0, infinite: false, hotLines: [], maxDepth: 0 },
      }),
    ).rejects.toThrow(/Not implemented/);
  });
});

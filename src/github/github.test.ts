import { describe, expect, it } from "vitest";
import { parseGitHubUrl } from "./github";

describe("github stubs", () => {
  it("parseGitHubUrl fails loudly", () => {
    expect(() => parseGitHubUrl("https://github.com/a/b")).toThrow(/Not implemented/);
  });
});

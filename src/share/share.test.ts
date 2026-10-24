import { describe, expect, it } from "vitest";
import { decodeShareHash, encodeShareHash } from "./share";

describe("share stubs", () => {
  it("encode and decode fail loudly", () => {
    expect(() =>
      encodeShareHash({ code: "", lang: "js", pack: "default", bpm: 112, mode: "file" }),
    ).toThrow(/Not implemented/);
    expect(() => decodeShareHash("#c=")).toThrow(/Not implemented/);
  });
});

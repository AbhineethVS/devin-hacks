import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenize";
import { buildFileSong } from "./fileSong";
import { createPlayer } from "./scheduler";
import { VOICES } from "./types";
import { defaultPack } from "../packs/default";

describe("engine stubs", () => {
  it("tokenize returns one array per line with 1-based lines", () => {
    const lines = tokenize("let a = 1;\n\nfoo()", "js");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.[0]).toMatchObject({ text: "let", line: 1, col: 0, index: 0 });
    expect(lines[1]).toEqual([]);
  });

  it("buildFileSong returns a file-mode song", () => {
    const song = buildFileSong(tokenize("a b", "js"), defaultPack, 112);
    expect(song.mode).toBe("file");
    expect(song.steps).toHaveLength(2);
  });

  it("player stub fails loudly on play", () => {
    expect(() => createPlayer().play(buildFileSong([], defaultPack, 112), defaultPack)).toThrow(
      /Not implemented/,
    );
  });

  it("lists every voice", () => {
    expect(VOICES).toHaveLength(11);
  });
});

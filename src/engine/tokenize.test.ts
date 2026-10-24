import { describe, expect, it } from "vitest";
import { detectLanguage } from "./languages";
import { MAX_PLAY_LINES, MAX_TOKENS_PER_LINE, tokenize, tokenizeWithInfo } from "./tokenize";
import type { Token } from "./types";

const kinds = (line: Token[] | undefined): [string, string][] =>
  (line ?? []).map((t) => [t.text, t.kind]);

describe("tokenize", () => {
  it("C for-loop", () => {
    const [line] = tokenize("for(int i=0;i<n;i++)", "c");
    expect(kinds(line)).toEqual([
      ["for", "kw"],
      ["(", "punct"],
      ["int", "type"],
      ["i", "id"],
      ["=", "op"],
      ["0", "num"],
      [";", "punct"],
      ["i", "id"],
      ["<", "op"],
      ["n", "id"],
      [";", "punct"],
      ["i", "id"],
      ["++", "op"],
      [")", "punct"],
    ]);
    expect(line?.map((t) => t.index)).toEqual(line?.map((_, i) => i));
    expect(line?.[2]).toMatchObject({ line: 1, col: 4 });
  });

  it("Python def", () => {
    const [line] = tokenize("def f(x): return x", "python");
    expect(kinds(line)).toEqual([
      ["def", "kw"],
      ["f", "id"],
      ["(", "punct"],
      ["x", "id"],
      [")", "punct"],
      [":", "punct"],
      ["return", "kw"],
      ["x", "id"],
    ]);
  });

  it("a block comment across 3 lines gives only comment tokens on those lines", () => {
    const lines = tokenize("/* one\n   two\n   three */\nint x;", "c");
    for (const line of lines.slice(0, 3)) {
      expect(line.length).toBeGreaterThan(0);
      expect(line.every((t) => t.kind === "comment")).toBe(true);
    }
    expect(kinds(lines[3])).toEqual([
      ["int", "type"],
      ["x", "id"],
      [";", "punct"],
    ]);
  });

  it("code after a block comment closes on the same line is tokenized", () => {
    const [line] = tokenize("/* a */ x = 1; // done", "js");
    expect(kinds(line)).toEqual([
      ["/* a */", "comment"],
      ["x", "id"],
      ["=", "op"],
      ["1", "num"],
      [";", "punct"],
      ["// done", "comment"],
    ]);
  });

  it("hex numbers and floats are single number tokens", () => {
    const [line] = tokenize("i = 0x5f3759df - 1.5e3;", "c");
    expect(kinds(line)).toEqual([
      ["i", "id"],
      ["=", "op"],
      ["0x5f3759df", "num"],
      ["-", "op"],
      ["1.5e3", "num"],
      [";", "punct"],
    ]);
  });

  it("a // inside a string is not a comment", () => {
    const [line] = tokenize('const url = "http://x.y"; // real', "js");
    expect(kinds(line)).toEqual([
      ["const", "type"],
      ["url", "id"],
      ["=", "op"],
      ['"http://x.y"', "str"],
      [";", "punct"],
      ["// real", "comment"],
    ]);
  });

  it("escaped quotes stay inside the string", () => {
    const [line] = tokenize("s = 'it\\'s';", "js");
    expect(line?.[2]).toMatchObject({ text: "'it\\'s'", kind: "str" });
    expect(line).toHaveLength(4);
  });

  it("Python triple-quoted strings span lines; # starts a comment", () => {
    const lines = tokenize('x = """a\nb"""  # note\ny = 2', "python");
    expect(kinds(lines[0])).toEqual([
      ["x", "id"],
      ["=", "op"],
      ['"""a', "str"],
    ]);
    expect(kinds(lines[1])).toEqual([
      ['b"""', "str"],
      ["# note", "comment"],
    ]);
    expect(kinds(lines[2])).toEqual([
      ["y", "id"],
      ["=", "op"],
      ["2", "num"],
    ]);
  });

  it("multi-char operators match longest first", () => {
    const [line] = tokenize("a === b !== c => d >>= e", "js");
    expect(line?.filter((t) => t.kind === "op").map((t) => t.text)).toEqual([
      "===",
      "!==",
      "=>",
      ">>=",
    ]);
  });

  it("unicode identifiers", () => {
    const [line] = tokenize("let café = naïve;", "js");
    expect(kinds(line)).toEqual([
      ["let", "type"],
      ["café", "id"],
      ["=", "op"],
      ["naïve", "id"],
      [";", "punct"],
    ]);
  });

  it("assembly: ; comments and all-caps mnemonics", () => {
    const lines = tokenize("START   TC      BANKCALL ; go\n        CAF     ZERO", "asm");
    expect(kinds(lines[0])).toEqual([
      ["START", "id"],
      ["TC", "kw"],
      ["BANKCALL", "id"],
      ["; go", "comment"],
    ]);
    expect(kinds(lines[1])).toEqual([
      ["CAF", "kw"],
      ["ZERO", "id"],
    ]);
  });

  it("caps each line at 64 tokens and flags it, but keeps comment state", () => {
    const long = Array.from({ length: 100 }, (_, i) => `a${i}`).join(" ");
    const result = tokenizeWithInfo(`${long} /* open\nstill */ x`, "js");
    expect(result.lines[0]).toHaveLength(MAX_TOKENS_PER_LINE);
    expect(result.truncatedLines).toEqual([1]);
    expect(kinds(result.lines[1])).toEqual([
      ["still */", "comment"],
      ["x", "id"],
    ]);
  });

  it("flags files over the 400-line Play-file limit", () => {
    expect(tokenizeWithInfo("x\n".repeat(MAX_PLAY_LINES - 1), "js").overLineLimit).toBe(false);
    expect(tokenizeWithInfo("x\n".repeat(MAX_PLAY_LINES + 1), "js").overLineLimit).toBe(true);
  });

  it("handles CRLF line endings", () => {
    const lines = tokenize("a;\r\nb;", "js");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.map((t) => t.text)).toEqual(["a", ";"]);
  });
});

describe("detectLanguage", () => {
  it("uses the extension first", () => {
    expect(detectLanguage("q_math.c", "")).toBe("c");
    expect(detectLanguage("main.CPP", "")).toBe("cpp");
    expect(detectLanguage("app.tsx", "")).toBe("ts");
    expect(detectLanguage("x.py", "")).toBe("python");
    expect(detectLanguage("Main.java", "")).toBe("java");
    expect(detectLanguage("main.go", "")).toBe("go");
    expect(detectLanguage("lib.rs", "")).toBe("rust");
    expect(detectLanguage("BURN_BABY_BURN.agc", "")).toBe("asm");
    expect(detectLanguage("sort.js", "def f(): pass")).toBe("js");
  });

  it("sniffs content when the extension doesn't help", () => {
    expect(detectLanguage("", "#include <stdio.h>\nint main() {}")).toBe("c");
    expect(detectLanguage("", "#include <vector>\nstd::vector<int> v;")).toBe("cpp");
    expect(detectLanguage("", "def f(x):\n    return x")).toBe("python");
    expect(detectLanguage("", "import os\nprint(os.name)")).toBe("python");
    expect(detectLanguage("", "package main\nfunc main() {}")).toBe("go");
    expect(detectLanguage("", "const a = [1, 2];")).toBe("js");
    expect(detectLanguage("", "")).toBe("unknown");
  });
});

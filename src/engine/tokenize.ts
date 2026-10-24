import type { Language, Token } from "./types";

export type { Language, Token, TokenKind } from "./types";
export { detectLanguage } from "./languages";

// STUB (Card 1): fake tokenizer that splits on whitespace and marks everything as "id",
// so the UI can be built against real-looking token positions.
export function tokenize(source: string, _lang: Language): Token[][] {
  return source.split("\n").map((text, i) =>
    Array.from(text.matchAll(/\S+/g), (m, index) => ({
      text: m[0],
      kind: "id" as const,
      line: i + 1,
      col: m.index,
      index,
    })),
  );
}

import type { Language } from "./types";

export interface LanguageSpec {
  keywords: ReadonlySet<string>;
  types: ReadonlySet<string>;
}

// STUB (Card 1): fill the keyword/type sets per skills/code-tokenizing.
const EMPTY: LanguageSpec = { keywords: new Set(), types: new Set() };
export const LANGUAGES: Record<Language, LanguageSpec> = {
  js: EMPTY,
  ts: EMPTY,
  c: EMPTY,
  cpp: EMPTY,
  java: EMPTY,
  python: EMPTY,
  go: EMPTY,
  rust: EMPTY,
  asm: EMPTY,
  unknown: EMPTY,
};

// STUB (Card 1): always "js" until extension + content sniffing land.
export function detectLanguage(_filename: string, _source: string): Language {
  return "js";
}

import { LANGUAGES, type LanguageSpec } from "./languages";
import type { Language, Token, TokenKind } from "./types";

export type { Language, Token, TokenKind } from "./types";
export { detectLanguage } from "./languages";

/** Minified code: keep at most this many tokens per line (skills/code-tokenizing). */
export const MAX_TOKENS_PER_LINE = 64;
/** Play file plays at most this many lines at a time; longer files are flagged. */
export const MAX_PLAY_LINES = 400;

export interface TokenizeResult {
  /** Same as `tokenize()`: one array per source line. */
  lines: Token[][];
  /** 1-based line numbers that hit the 64-token cap (extra tokens were dropped). */
  truncatedLines: number[];
  /** True when the source has more than MAX_PLAY_LINES lines. */
  overLineLimit: boolean;
}

// A construct that is still open at the end of a line (block comment, triple-quoted string, template).
interface OpenSpan {
  kind: TokenKind;
  end: string;
}

// Multi-character operators, longest first so `===` wins over `==`.
const MULTI_OPS = [
  ">>>=",
  "===",
  "!==",
  "**=",
  "<<=",
  ">>=",
  ">>>",
  "...",
  "==",
  "!=",
  "<=",
  ">=",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "&&",
  "||",
  "->",
  "=>",
  "::",
  "<<",
  ">>",
  "**",
  "??",
  "?.",
  ":=",
];
const PUNCT = new Set(["(", ")", "{", "}", "[", "]", ";", ",", ".", ":", "#", "@", "\\"]);

const NUMBER_RE =
  /0[xX][0-9a-fA-F_]+[uUlL]*|0[bB][01_]+[uUlL]*|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?[fFdDlLuUn]?/y;
const IDENT_RE = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const WS_RE = /\s+/y;
const ASM_MNEMONIC_RE = /^[A-Z]{2,6}$/;

function matchAt(re: RegExp, text: string, pos: number): string | null {
  re.lastIndex = pos;
  return re.exec(text)?.[0] ?? null;
}

/** A quoted string on one line, honouring backslash escapes. Unterminated → rest of the line. */
function quotedLength(text: string, pos: number): number {
  const quote = text[pos];
  let i = pos + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i] === quote) return i + 1 - pos;
    else i++;
  }
  return text.length - pos;
}

function classifyWord(word: string, spec: LanguageSpec, mnemonicSlot: boolean): TokenKind {
  const key = spec.caseInsensitive ? word.toLowerCase() : word;
  if (spec.types.has(key)) return "type";
  if (spec.keywords.has(key)) return "kw";
  // Assembly: an all-caps 2–6 letter word in the opcode position is a mnemonic.
  if (spec.caseInsensitive && mnemonicSlot && ASM_MNEMONIC_RE.test(word)) return "kw";
  return "id";
}

/**
 * Regex-driven tokenizer (skills/code-tokenizing). Not a parser: it only needs token kinds.
 * Lines are 1-based, cols 0-based. Whitespace is dropped; comments are kept as `comment`.
 */
export function tokenizeWithInfo(source: string, lang: Language): TokenizeResult {
  const spec = LANGUAGES[lang] ?? LANGUAGES.unknown;
  const rawLines = source.split(/\r?\n/);
  const lines: Token[][] = [];
  const truncatedLines: number[] = [];
  let open: OpenSpan | null = null;

  rawLines.forEach((text, i) => {
    const lineNo = i + 1;
    const tokens: Token[] = [];
    let truncated = false;
    // Assembly opcode position: the first word, or the second when the first is a label in column 0.
    let wordsSeen = 0;
    let labelAtStart = false;

    // Keep scanning after the cap so open comments/strings are still tracked across lines.
    const push = (tokText: string, kind: TokenKind, col: number): void => {
      if (tokens.length >= MAX_TOKENS_PER_LINE) {
        truncated = true;
        return;
      }
      tokens.push({ text: tokText, kind, line: lineNo, col, index: tokens.length });
    };

    let pos = 0;
    while (pos < text.length) {
      if (open) {
        const endAt = text.indexOf(open.end, pos);
        const stop = endAt === -1 ? text.length : endAt + open.end.length;
        const chunk = text.slice(pos, stop);
        if (chunk.trim()) push(chunk.trimEnd(), open.kind, pos);
        if (endAt !== -1) open = null;
        pos = stop;
        continue;
      }

      const ws = matchAt(WS_RE, text, pos);
      if (ws) {
        pos += ws.length;
        continue;
      }

      const rest = text.slice(pos, pos + 4);
      if (spec.lineComments.some((c) => rest.startsWith(c))) {
        push(text.slice(pos).trimEnd(), "comment", pos);
        break;
      }
      if (spec.blockComments && rest.startsWith("/*")) {
        open = { kind: "comment", end: "*/" };
        const endAt = text.indexOf("*/", pos + 2);
        const stop = endAt === -1 ? text.length : endAt + 2;
        push(text.slice(pos, stop).trimEnd(), "comment", pos);
        if (endAt !== -1) open = null;
        pos = stop;
        continue;
      }

      const strLen = stringLength(text, pos, spec);
      if (strLen.length > 0) {
        push(text.slice(pos, pos + strLen.length), "str", pos);
        if (strLen.open) open = strLen.open;
        pos += strLen.length;
        continue;
      }

      const num = matchAt(NUMBER_RE, text, pos);
      if (num) {
        push(num, "num", pos);
        pos += num.length;
        continue;
      }

      const word = matchAt(IDENT_RE, text, pos);
      if (word) {
        const slot = wordsSeen === 0 ? pos > 0 : wordsSeen === 1 && labelAtStart;
        if (wordsSeen === 0 && pos === 0) labelAtStart = true;
        wordsSeen++;
        push(word, classifyWord(word, spec, slot), pos);
        pos += word.length;
        continue;
      }

      const op = MULTI_OPS.find((o) => text.startsWith(o, pos));
      if (op) {
        push(op, "op", pos);
        pos += op.length;
        continue;
      }

      // Single character (code point, so emoji and astral symbols stay whole).
      const ch = String.fromCodePoint(text.codePointAt(pos) ?? 0);
      push(ch, PUNCT.has(ch) ? "punct" : "op", pos);
      pos += ch.length;
    }

    if (truncated) truncatedLines.push(lineNo);
    lines.push(tokens);
  });

  return { lines, truncatedLines, overLineLimit: rawLines.length > MAX_PLAY_LINES };
}

// Returns how many characters of a string literal start at `pos` (0 if none), and whether it stays open.
function stringLength(
  text: string,
  pos: number,
  spec: LanguageSpec,
): { length: number; open?: OpenSpan } {
  let start = pos;
  // Python string prefixes: r"", f"", b"", rb"", …
  if (spec.tripleQuotes) {
    const prefix = /[rRbBuUfF]{1,2}(?=["'])/y;
    prefix.lastIndex = pos;
    const m = prefix.exec(text);
    if (m) start += m[0].length;
  }
  const ch = text[start];
  if (ch !== '"' && ch !== "'" && ch !== "`") return { length: 0 };
  if (start > pos && ch === "`") return { length: 0 };

  if (spec.tripleQuotes && (text.startsWith('"""', start) || text.startsWith("'''", start))) {
    const delim = text.slice(start, start + 3);
    const endAt = text.indexOf(delim, start + 3);
    if (endAt === -1) return { length: text.length - pos, open: { kind: "str", end: delim } };
    return { length: endAt + 3 - pos };
  }
  if (ch === "`") {
    if (!spec.backticks) return { length: 0 };
    const endAt = text.indexOf("`", start + 1);
    if (endAt === -1) return { length: text.length - pos, open: { kind: "str", end: "`" } };
    return { length: endAt + 1 - pos };
  }
  if (ch === "'" && spec.charLiteralsOnly) {
    // Rust: 'a' or '\n' is a char literal; `'a` (a lifetime) is not a string.
    const m = /'(?:\\[^']+|[^'\\])'/y;
    m.lastIndex = start;
    const hit = m.exec(text);
    return hit ? { length: hit[0].length + (start - pos) } : { length: 0 };
  }
  return { length: quotedLength(text, start) + (start - pos) };
}

/** One token array per source line (CONTRACTS.md §1). See tokenizeWithInfo for the truncation flags. */
export function tokenize(source: string, lang: Language): Token[][] {
  return tokenizeWithInfo(source, lang).lines;
}

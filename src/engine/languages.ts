import type { Language } from "./types";

export interface LanguageSpec {
  /** Control-flow and other reserved words → `kw`. */
  keywords: ReadonlySet<string>;
  /** Type-like declaration words (`let const var int …`) → `type`, which plays bass degree 0. */
  types: ReadonlySet<string>;
  /** Line comment starters, checked in order. */
  lineComments: readonly string[];
  /** Whether `/* … *\/` block comments exist. */
  blockComments: boolean;
  /** Python `"""…"""` / `'''…'''` strings (may span lines). */
  tripleQuotes: boolean;
  /** JS/TS template strings in backticks (may span lines). */
  backticks: boolean;
  /** Rust: `'` is only a char literal when it closes right away; otherwise it's a lifetime. */
  charLiteralsOnly: boolean;
  /** Assembly: mnemonics are matched case-insensitively, plus the all-caps mnemonic rule. */
  caseInsensitive: boolean;
}

function words(s: string): ReadonlySet<string> {
  return new Set(s.split(/\s+/).filter(Boolean));
}

// Shared by every language so the "keyword degrees" table in docs/SOUND_DESIGN.md always applies.
const JS_KEYWORDS =
  "break case catch class continue debugger default delete do else export extends false finally for function if import in instanceof new null return super switch this throw true try typeof void while with yield async await of from as static get set undefined";
const JS_TYPES = "let const var";

const C_KEYWORDS =
  "if else for while do return switch case break continue sizeof typedef struct union enum static extern goto default register volatile inline restrict true false NULL include define ifdef ifndef endif pragma";
const C_TYPES = "int float double char long short unsigned signed void const bool size_t";

const CPP_EXTRA_KEYWORDS =
  "class public private protected virtual override template typename namespace using new delete this throw try catch operator friend nullptr constexpr explicit mutable noexcept static_cast dynamic_cast reinterpret_cast const_cast";
const CPP_EXTRA_TYPES = "auto wchar_t";

const BASE = {
  lineComments: ["//"],
  blockComments: true,
  tripleQuotes: false,
  backticks: false,
  charLiteralsOnly: false,
  caseInsensitive: false,
} as const;

const js: LanguageSpec = {
  ...BASE,
  backticks: true,
  keywords: words(JS_KEYWORDS),
  types: words(JS_TYPES),
};

const ts: LanguageSpec = {
  ...js,
  keywords: words(
    `${JS_KEYWORDS} interface type enum implements namespace declare abstract readonly public private protected keyof infer is satisfies`,
  ),
  types: words(`${JS_TYPES} number string boolean any unknown never object bigint symbol`),
};

const c: LanguageSpec = { ...BASE, keywords: words(C_KEYWORDS), types: words(C_TYPES) };

const cpp: LanguageSpec = {
  ...BASE,
  keywords: words(`${C_KEYWORDS} ${CPP_EXTRA_KEYWORDS}`),
  types: words(`${C_TYPES} ${CPP_EXTRA_TYPES}`),
};

const java: LanguageSpec = {
  ...BASE,
  keywords: words(
    "abstract assert break case catch class continue default do else enum extends final finally for if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while true false null var",
  ),
  types: words("int float double char long short byte boolean void const String"),
};

const python: LanguageSpec = {
  ...BASE,
  lineComments: ["#"],
  blockComments: false,
  tripleQuotes: true,
  keywords: words(
    "def class if elif else for while in return import from as with try except finally lambda None True False and or not pass yield break continue global nonlocal raise assert del is async await",
  ),
  types: words("int float str bool list dict tuple set"),
};

const go: LanguageSpec = {
  ...BASE,
  backticks: true,
  keywords: words(
    "break case chan continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type true false nil",
  ),
  types: words(
    "var const int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error",
  ),
};

const rust: LanguageSpec = {
  ...BASE,
  charLiteralsOnly: true,
  keywords: words(
    "as break continue crate else enum extern false fn for if impl in loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn None Some Ok Err",
  ),
  types: words(
    "let const i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result",
  ),
};

// Generic mnemonics (x86, ARM, AGC). Matched lowercased; all-caps words also count (see tokenize.ts).
const asm: LanguageSpec = {
  ...BASE,
  lineComments: [";", "#"],
  blockComments: false,
  caseInsensitive: true,
  keywords: words(
    "mov movl movq lea add sub mul imul div idiv inc dec and or xor not neg shl shr sal sar cmp test jmp je jne jz jnz jg jge jl jle ja jb call ret push pop nop int syscall ldr str b bl bx beq bne cbz tc tcf ca cs ad ts xch inhint relint extend bzf bzmf ccs index",
  ),
  types: words("db dw dd dq byte word dword qword dec oct equals erase"),
};

const unknown: LanguageSpec = { ...BASE, keywords: words(JS_KEYWORDS), types: words(JS_TYPES) };

export const LANGUAGES: Record<Language, LanguageSpec> = {
  js,
  ts,
  c,
  cpp,
  java,
  python,
  go,
  rust,
  asm,
  unknown,
};

const EXTENSIONS: Record<string, Language> = {
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "js",
  ts: "ts",
  tsx: "ts",
  mts: "ts",
  cts: "ts",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  java: "java",
  py: "python",
  pyw: "python",
  go: "go",
  rs: "rust",
  asm: "asm",
  s: "asm",
  agc: "asm",
  nasm: "asm",
};

/** Extension first, then simple content sniffing. Returns "unknown" when nothing matches. */
export function detectLanguage(filename: string, source: string): Language {
  const ext = /\.([A-Za-z0-9+]+)$/.exec(filename.trim())?.[1]?.toLowerCase();
  if (ext && EXTENSIONS[ext]) return EXTENSIONS[ext];
  return sniffLanguage(source);
}

function sniffLanguage(source: string): Language {
  const s = source.slice(0, 20_000);
  if (/^\s*#include\b/m.test(s)) {
    return /\bstd::|\bnamespace\b|\btemplate\s*<|\bclass\s+\w+/.test(s) ? "cpp" : "c";
  }
  if (/^package\s+\w+/m.test(s) && /\bfunc\b/.test(s)) return "go";
  if (/\bfn\s+\w+\s*[(<]/.test(s) && /\blet\b|\buse\s+\w+::/.test(s)) return "rust";
  if (/\bpublic\s+(static\s+)?(class|void)\b/.test(s)) return "java";
  if (/^\s*def\s+\w+\s*\(.*\)\s*(->.*)?:\s*$/m.test(s)) return "python";
  if (/^\s*(from\s+[\w.]+\s+import\s+\w|import\s+[\w.]+\s*$)/m.test(s)) return "python";
  if (/^\s*(interface|type)\s+\w+|:\s*(number|string|boolean)\b/m.test(s)) return "ts";
  if (/\b(function|const|let|var)\b|=>|console\./.test(s)) return "js";
  if (/^\s*[A-Za-z_]\w*:\s*$|^\s+[A-Z]{2,6}\s+\S/m.test(s) && /^\s*[;#]/m.test(s)) return "asm";
  return "unknown";
}

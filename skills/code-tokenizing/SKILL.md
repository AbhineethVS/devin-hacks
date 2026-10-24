---
name: code-tokenizing
description: How Syntune tokenizes source code in many languages for the Play-file mode. Covers token kinds, per-language keyword sets, language detection and the edge cases. Read this before touching src/engine/tokenize.ts or languages.ts.
---

# Tokenizing code for music

## Approach
- **A single regex-driven tokenizer, not a real parser.** Fast and language-agnostic. The musical result only needs token *kinds*.
- **Order of alternatives matters,** longest first:
  1. whitespace
  2. line comment (`//`, `#` for Python and shell, `;` for assembly)
  3. block-comment start and end (track state across lines)
  4. strings (`"…"`, `'…'`, `` `…` ``, Python triple quotes as one token)
  5. numbers (including hex `0x5f3759df`, floats)
  6. identifiers
  7. multi-character operators (`===`, `!==`, `==`, `!=`, `<=`, `>=`, `++`, `--`, `+=`, `-=`, `*=`, `/=`, `&&`, `||`, `->`, `=>`, `::`, `<<`, `>>`)
  8. single-character punctuation and operators
- **Classify identifiers** with the per-language sets in `languages.ts`: a `keywords` set and a `types` set.
  - **c/cpp:** `int float double char long short unsigned void struct const static if else for while do return switch case break continue sizeof typedef`
  - **python:** `def class if elif else for while in return import from as with try except finally lambda None True False and or not pass yield`
  - **asm** (Apollo AGC and generic): treat mnemonics (all-caps words of 2–6 letters at the start of a line) as keywords, and labels as identifiers.
- **Language detection:** by file extension first, then simple content sniffing (`def ` or `import ` → python, `#include` → c).

## Edge cases
- Block comments spanning lines: carry `inComment` state across lines.
- Very long lines (minified code): cap each line at 64 tokens. The extra tokens are skipped, and the line is marked as truncated.
- Files over 2,000 lines: Play file takes the first 400 lines and offers "Play next section".
- Unicode identifiers: allow `\p{L}` with the `u` flag.

## Tests (Vitest)
- `for(int i=0;i<n;i++)` → `for` kw, `(` punct, `int` type, `i` id, `=` op, `0` num, `;` punct, …
- Python `def f(x): return x` → `def` kw, … `return` kw
- A block comment across 3 lines → only comment tokens on those lines.

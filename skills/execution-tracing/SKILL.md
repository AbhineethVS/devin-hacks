---
name: execution-tracing
description: How Syntune runs user and AI code safely and records an execution trace for Run mode. Covers instrumentation, safe value probes, the step cap, timeouts, recursion depth, the C-like subset and the worker sandbox. Read this before touching src/tracer/.
---

# Execution tracing

## Pipeline
`source → (C-like rewrite) → instrument → run in a Web Worker → TraceResult`

## 1. C-like rewrite (only when lang is c/cpp/java)
- `\b(int|float|double|char|long|short|bool|unsigned)\b(?=\s+[A-Za-z_])` → `let`
- `printf(...)` / `System.out.println(...)` → `__print(...)`, which is a no-op.
- Leave everything else alone. If the rewritten code throws a SyntaxError, report "Run mode supports a C-like subset. Try Play file."

## 2. Instrumentation (line-based, proven in the prototype)
- For each line whose trimmed text **does not start with** `}`, `else`, `)`, `//`, `case`, `default`, and is not just `{`, prepend `__s(lineNo, [probes])` at the line's indentation.
- **Probes:** for every identifier or simple index expression on the line (`name` or `name[expr]`), except keywords and `console`, emit `__v(() => expr)`.
  - **`__v` must wrap each probe in its own try/catch.** Otherwise a `let x` declared on that same line throws (temporal dead zone) and you lose every probe on the line. Return the value only if it's a number.
- **Better (do it if time allows):** use an AST (`acorn` + `astring`) to insert `__s` before every statement node and `__enter(fnName)` / `__exit()` at function entry and return. Then you get recursion depth and function names reliably. The line-based version is the fallback.

## 3. Depth and functions (line-based approximation)
- Wrap every `function name(` body: insert `__enter("name");` as the first statement after `{`.
- Wrap `return` statements: `return __exit(<expr>)`.
- `__enter` increments the depth, `__exit` decrements it. Each `__s` records the current depth and function.

## 4. Safety
- **Run in a dedicated Web Worker,** created per run and **terminated** after it finishes or after `timeoutMs` (default 1500 ms). This kills `while(true){}` loops that never call `__s`.
- **Step cap** (default 1500): `__s` throws a sentinel error when the cap is exceeded, and the result is marked `infinite: true`.
- No DOM, no network: the worker has no access to the page. Shadow `fetch`, `XMLHttpRequest` and `importScripts` to throwing stubs before running the code.
- Use `new Function("__s", "__v", "__enter", "__exit", "__print", "console", code)`, with console silenced.
- **AI-generated code goes through the exact same path.** It's untrusted.

## 5. Trace → song
See `docs/SOUND_DESIGN.md` → "Run mode". When infinite, include only the first 48 steps, then the drone step.

## Tests
- Bubble sort trace is 50–150 items, ends without error, and `values` are numbers.
- `while(i<5){}` with no increment → `infinite: true`.
- `let tmp = arr[j];` → probes don't throw, and the values include `arr[j]`.
- `int i = 0;` in C mode runs.
- A recursive fibonacci reaches depth > 3.

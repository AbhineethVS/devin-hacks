import { describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import type { TraceResult } from "../engine/types";
import { executeInstrumented, traceSource } from "./execute";
import {
  C_SUBSET_ERROR,
  TS_ERROR,
  UNSUPPORTED_ERROR,
  instrument,
  rewriteCLike,
} from "./instrument";
import { runTrace, type TraceWorker } from "./runTrace";
import { summarizeTrace } from "./summary";

function preset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
}

function traceOf(id: string): TraceResult {
  const p = preset(id);
  return traceSource(p.code, p.lang);
}

const maxDepth = (t: TraceResult) => Math.max(0, ...t.items.map((i) => i.depth));

describe("C-like rewrite", () => {
  it("turns typed declarations into let and prints into __print", () => {
    expect(rewriteCLike('int n = 8;\nfor (int i = 0; i < n; i++) printf("%d", i);')).toBe(
      'let n = 8;\nfor (let i = 0; i < n; i++) __print("%d", i);',
    );
    expect(rewriteCLike("System.out.println(x);")).toBe("__print(x);");
  });

  it("reports the C-subset message when the rewrite still isn't JS", () => {
    expect(() => instrument("int main() { return 0; }", "c")).toThrow(C_SUBSET_ERROR);
    expect(traceSource("struct P { int x; };", "cpp").error).toBe(C_SUBSET_ERROR);
  });
});

describe("instrument", () => {
  it("rejects languages Run mode can't execute", () => {
    expect(traceSource("print(1)", "python").error).toBe(UNSUPPORTED_ERROR);
  });

  it("runs plain-JS TypeScript and explains type annotations", () => {
    expect(traceSource("let a = 1;\na = a + 1;", "ts").error).toBeUndefined();
    expect(traceSource("let a: number = 1;", "ts").error).toBe(TS_ERROR);
  });

  it("reports JS syntax errors as errors, not exceptions", () => {
    expect(traceSource("let = ;", "js").error).toMatch(/^SyntaxError/);
  });

  it("traces every loop iteration on the loop's own line", () => {
    const t = traceSource("let s = 0;\nfor (let i = 0; i < 3; i++) {\n  s += i;\n}", "js");
    expect(t.items.filter((i) => i.line === 2)).toHaveLength(4); // 3 passing tests + the final failing one
    expect(t.items.filter((i) => i.line === 3)).toHaveLength(3);
  });

  it("supports bare return and keeps depth balanced after early returns", () => {
    const code =
      "function f(n) {\n  if (n > 0) {\n    return;\n  }\n}\nf(1);\nf(0);\nlet done = 1;";
    const t = traceSource(code, "js");
    expect(t.error).toBeUndefined();
    expect(t.items.at(-1)).toMatchObject({ line: 8, depth: 0 });
  });
});

describe("executeInstrumented / traceSource", () => {
  it("bubble sort: 50-150 numeric trace items, no error", () => {
    const t = traceOf("bubble-sort");
    expect(t.error).toBeUndefined();
    expect(t.infinite).toBe(false);
    expect(t.items.length).toBeGreaterThanOrEqual(50);
    expect(t.items.length).toBeLessThanOrEqual(150);
    for (const item of t.items) for (const v of item.values) expect(typeof v).toBe("number");
  });

  it("quicksort recurses deeper than 1", () => {
    const t = traceOf("quicksort");
    expect(t.error).toBeUndefined();
    expect(maxDepth(t)).toBeGreaterThan(1);
    expect(t.items.some((i) => i.fn === "quickSort")).toBe(true);
  });

  it("fibonacci reaches depth > 3", () => {
    const t = traceOf("fibonacci");
    expect(t.error).toBeUndefined();
    expect(maxDepth(t)).toBeGreaterThan(3);
  });

  it("C-style for loop with int runs", () => {
    const t = traceOf("c-for-loop");
    expect(t.error).toBeUndefined();
    expect(t.infinite).toBe(false);
    expect(t.items.length).toBeGreaterThan(8);
  });

  it("the infinite-loop preset hits the step cap", () => {
    const t = traceOf("infinite-loop");
    expect(t.infinite).toBe(true);
    expect(t.error).toBeUndefined();
    expect(t.items).toHaveLength(1500);
  });

  it("a user catch can't swallow the step cap", () => {
    const t = traceSource(
      "let i = 0;\nwhile (true) {\n  try {\n    i++;\n  } catch (e) {}\n}",
      "js",
      { cap: 50 },
    );
    expect(t.infinite).toBe(true);
  });

  it("a runtime error is reported in error", () => {
    const t = traceSource("let a = 1;\nnull.x;", "js");
    expect(t.infinite).toBe(false);
    expect(t.error).toMatch(/TypeError: .*null/);
    expect(t.items.map((i) => i.line)).toEqual([1, 2]);
  });

  it("probes survive the temporal dead zone and include arr[j]", () => {
    const t = traceSource("const arr = [4, 42];\nlet j = 1;\nlet tmp = arr[j];", "js");
    expect(t.error).toBeUndefined();
    const line3 = t.items.find((i) => i.line === 3);
    expect(line3?.values).toContain(42);
  });

  it("blocks network APIs and silences console", () => {
    const t = traceSource('console.log("hi");\nfetch("https://example.com");', "js");
    expect(t.error).toMatch(/disabled in Run mode/);
  });

  it("every preset runs without throwing out of the harness", () => {
    for (const p of PRESETS) {
      expect(() => executeInstrumented(instrument(p.code, p.lang))).not.toThrow();
    }
  });
});

/** Like the real worker: announce `{ ready: true }` once "loaded" (after a delay). */
function announceReady(worker: TraceWorker, delayMs = 0): void {
  setTimeout(() => worker.onmessage?.({ data: { ready: true } } as MessageEvent), delayMs);
}

/** A fake Worker that loads but never answers, like one stuck in `while(true){}` with no traced statement. */
function silentWorker(readyDelayMs = 0) {
  const state = { terminated: false, posted: [] as unknown[] };
  const worker: TraceWorker = {
    onmessage: null,
    onerror: null,
    postMessage: (m) => void state.posted.push(m),
    terminate: () => void (state.terminated = true),
  };
  announceReady(worker, readyDelayMs);
  return { worker, state };
}

/** A fake Worker that runs the trace in-process and answers asynchronously. */
function inProcessWorker(): TraceWorker {
  const worker: TraceWorker = {
    onmessage: null,
    onerror: null,
    postMessage: (m) => {
      const { source, lang, cap } = m as { source: string; lang: "js"; cap: number };
      const data = traceSource(source, lang, { cap });
      setTimeout(() => worker.onmessage?.({ data } as MessageEvent), 0);
    },
    terminate: () => {},
  };
  announceReady(worker);
  return worker;
}

describe("runTrace", () => {
  it("doesn't count a slow worker load against the run timeout", async () => {
    const { worker } = silentWorker(60);
    const started = performance.now();
    const t = await runTrace("while(true){}", "js", { timeoutMs: 30 }, () => worker);
    expect(t.infinite).toBe(true);
    expect(performance.now() - started).toBeGreaterThanOrEqual(85);
  });

  it("reports an error when the worker never loads", async () => {
    const state = { terminated: false };
    const worker: TraceWorker = {
      onmessage: null,
      onerror: null,
      postMessage: () => {},
      terminate: () => void (state.terminated = true),
    };
    const t = await runTrace("1;", "js", { loadTimeoutMs: 30 }, () => worker);
    expect(t.infinite).toBe(false);
    expect(t.error).toMatch(/took too long to start/);
    expect(state.terminated).toBe(true);
  });

  it("kills a worker that never answers and reports infinite", async () => {
    const { worker, state } = silentWorker();
    const t = await runTrace("while(true){}", "js", { timeoutMs: 30 }, () => worker);
    expect(t.infinite).toBe(true);
    expect(t.error).toBeUndefined();
    expect(state.terminated).toBe(true);
    expect(state.posted).toEqual([{ source: "while(true){}", lang: "js", cap: 1500 }]);
  });

  it("resolves with the worker's trace and passes the cap through", async () => {
    const t = await runTrace(preset("infinite-loop").code, "js", { cap: 40 }, inProcessWorker);
    expect(t.infinite).toBe(true);
    expect(t.items).toHaveLength(40);
  });

  it("never rejects when the worker can't start", async () => {
    const t = await runTrace("1;", "js", {}, () => {
      throw new Error("no workers here");
    });
    expect(t.error).toMatch(/no workers here/);
  });
});

describe("summarizeTrace", () => {
  it("counts hot lines and max depth", () => {
    const trace: TraceResult = {
      items: [
        { line: 1, values: [], depth: 0 },
        { line: 3, values: [1], depth: 1, fn: "f" },
        { line: 3, values: [2], depth: 2, fn: "f" },
        { line: 2, values: [], depth: 0 },
        { line: 3, values: [3], depth: 1, fn: "f" },
        { line: 2, values: [], depth: 0 },
      ],
      infinite: false,
      error: "TypeError: boom",
      durationMs: 1,
    };
    expect(summarizeTrace(trace)).toEqual({
      steps: 6,
      infinite: false,
      error: "TypeError: boom",
      hotLines: [
        { line: 3, count: 3 },
        { line: 2, count: 2 },
        { line: 1, count: 1 },
      ],
      maxDepth: 2,
    });
  });

  it("keeps the top 5 lines and omits error when there is none", () => {
    const items = [1, 2, 3, 4, 5, 6, 6].map((line) => ({ line, values: [], depth: 0 }));
    const s = summarizeTrace({ items, infinite: true, durationMs: 0 });
    expect(s.hotLines).toHaveLength(5);
    expect(s.hotLines[0]).toEqual({ line: 6, count: 2 });
    expect("error" in s).toBe(false);
  });
});

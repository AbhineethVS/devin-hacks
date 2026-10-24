import type { Language, TraceItem, TraceResult } from "../engine/types";
import { InstrumentError, instrument } from "./instrument";

export const DEFAULT_CAP = 1500;

/** Thrown by `__s`/`__enter` once the step cap is exceeded. */
class StepCapExceeded extends Error {
  constructor() {
    super("Step cap exceeded");
    this.name = "StepCapExceeded";
  }
}

// Names shadowed as parameters of the sandboxed function, so user code can't reach the network
// or talk to the page directly. The worker also replaces the real globals (see worker.ts).
const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "importScripts",
  "WebSocket",
  "EventSource",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "indexedDB",
  "caches",
  "postMessage",
  "close",
] as const;

function blocked(): never {
  throw new Error("Network and messaging APIs are disabled in Run mode.");
}

// Every console method is a silent no-op.
const silentConsole: Console = new Proxy({} as Console, { get: () => () => undefined });

function errorText(err: unknown): string {
  if (err instanceof Error) return err.name ? `${err.name}: ${err.message}` : err.message;
  return String(err);
}

/** Runs already-instrumented code synchronously and records the trace. Never throws for user-code problems. */
export function executeInstrumented(code: string, opts: { cap?: number } = {}): TraceResult {
  const cap = opts.cap ?? DEFAULT_CAP;
  const items: TraceItem[] = [];
  const fnStack: string[] = [];
  let steps = 0;
  let capped = false;

  // Once tripped, the cap keeps throwing, so a user `catch` can't swallow it and keep looping.
  const tick = (): void => {
    if (capped || ++steps > cap) {
      capped = true;
      throw new StepCapExceeded();
    }
  };
  const __s = (line: number, values: unknown[]): void => {
    tick();
    const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    items.push({ line, values: nums, depth: fnStack.length, fn: fnStack.at(-1), kind: "stmt" });
  };
  // Each probe has its own try/catch: a `let` in its temporal dead zone must not lose the other probes.
  const __v = (probe: () => unknown): number | undefined => {
    try {
      const v = probe();
      return typeof v === "number" ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const __enter = (fn: string, line: number): void => {
    tick();
    fnStack.push(fn);
    items.push({ line, values: [], depth: fnStack.length, fn, kind: "call" });
  };
  const __exit = (): void => {
    fnStack.pop();
  };
  const __print = (): void => {};

  const start = performance.now();
  let error: string | undefined;
  try {
    const run = new Function(
      "__s",
      "__v",
      "__enter",
      "__exit",
      "__print",
      "console",
      ...BLOCKED_GLOBALS,
      code,
    ) as (...args: unknown[]) => unknown;
    run(__s, __v, __enter, __exit, __print, silentConsole, ...BLOCKED_GLOBALS.map(() => blocked));
  } catch (err) {
    if (!capped) error = errorText(err);
  }
  const result: TraceResult = { items, infinite: capped, durationMs: performance.now() - start };
  if (error !== undefined) result.error = error;
  return result;
}

/** Instrument + execute. Instrumentation problems (syntax, unsupported language) come back as `error`. */
export function traceSource(
  source: string,
  lang: Language,
  opts: { cap?: number } = {},
): TraceResult {
  let code: string;
  try {
    code = instrument(source, lang);
  } catch (err) {
    const message = err instanceof InstrumentError ? err.message : errorText(err);
    return { items: [], infinite: false, durationMs: 0, error: message };
  }
  return executeInstrumented(code, opts);
}

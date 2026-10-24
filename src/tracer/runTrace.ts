import type { Language, TraceOptions, TraceResult } from "../engine/types";
import { DEFAULT_CAP } from "./execute";

export type { TraceItem, TraceOptions, TraceResult } from "../engine/types";

export const DEFAULT_TIMEOUT_MS = 1500;
/** How long a fresh worker may take to load before we give up (separate from the run timeout). */
export const LOAD_TIMEOUT_MS = 10_000;

/** The slice of the Worker API runTrace uses, so tests can pass a fake. */
export interface TraceWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
export type WorkerFactory = () => TraceWorker;

export function createTraceWorker(): TraceWorker {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
}

function isTraceResult(data: unknown): data is TraceResult {
  const d = data as TraceResult | null;
  return (
    typeof d === "object" && d !== null && Array.isArray(d.items) && typeof d.infinite === "boolean"
  );
}

function isReady(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { ready?: unknown }).ready === true;
}

/**
 * Runs `source` in a fresh Web Worker with a step cap and a timeout. Always resolves: user-code
 * problems are reported in `error`, and a worker that doesn't answer in time is killed and
 * reported as `infinite: true` (e.g. `while(true){}` with no traced statement inside).
 * The run timeout starts only once the worker reports `{ ready: true }`, so a slow worker load
 * is never mistaken for an infinite loop.
 */
export function runTrace(
  source: string,
  lang: Language,
  opts?: TraceOptions & { loadTimeoutMs?: number },
  createWorker: WorkerFactory = createTraceWorker,
): Promise<TraceResult> {
  const cap = opts?.cap ?? DEFAULT_CAP;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const loadTimeoutMs = opts?.loadTimeoutMs ?? LOAD_TIMEOUT_MS;
  let start = performance.now();

  return new Promise((resolve) => {
    let worker: TraceWorker;
    try {
      worker = createWorker();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      resolve({
        items: [],
        infinite: false,
        durationMs: 0,
        error: `Could not start the sandbox: ${reason}`,
      });
      return;
    }

    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: TraceResult): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const elapsed = (): number => performance.now() - start;

    timer = setTimeout(
      () =>
        finish({
          items: [],
          infinite: false,
          durationMs: 0,
          error: "The sandbox took too long to start. Try again.",
        }),
      loadTimeoutMs,
    );
    worker.onmessage = (event) => {
      if (isReady(event.data)) {
        clearTimeout(timer);
        start = performance.now();
        timer = setTimeout(
          () => finish({ items: [], infinite: true, durationMs: elapsed() }),
          timeoutMs,
        );
        worker.postMessage({ source, lang, cap });
        return;
      }
      if (isTraceResult(event.data)) finish(event.data);
      else
        finish({
          items: [],
          infinite: false,
          durationMs: elapsed(),
          error: "The sandbox sent an invalid trace.",
        });
    };
    worker.onerror = (event) => {
      finish({
        items: [],
        infinite: false,
        durationMs: elapsed(),
        error: `Sandbox error: ${event.message}`,
      });
    };
  });
}

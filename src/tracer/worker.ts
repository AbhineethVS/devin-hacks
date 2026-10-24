// Sandbox worker: one per run. Receives { source, lang, cap }, posts back a TraceResult, then gets terminated.
import type { Language } from "../engine/types";
import { traceSource } from "./execute";

export interface TraceRequest {
  source: string;
  lang: Language;
  cap: number;
}

const post = self.postMessage.bind(self);
const scope = self as unknown as Record<string, unknown>;

// Replace network and messaging globals before any user code runs. User code also gets
// shadowing parameters (execute.ts); this covers `self.fetch` / `globalThis.fetch` style access.
for (const name of [
  "fetch",
  "XMLHttpRequest",
  "importScripts",
  "WebSocket",
  "EventSource",
  "postMessage",
]) {
  try {
    Object.defineProperty(scope, name, {
      value: () => {
        throw new Error("Network and messaging APIs are disabled in Run mode.");
      },
      configurable: false,
      writable: false,
    });
  } catch {
    // A non-configurable global stays as it is; the parameter shadowing still applies.
  }
}

self.onmessage = (event: MessageEvent<TraceRequest>) => {
  const { source, lang, cap } = event.data;
  post(traceSource(source, lang, { cap }));
};

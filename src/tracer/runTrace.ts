import type { Language, TraceOptions, TraceResult } from "../engine/types";

// STUB (Card 2): run in a fresh Web Worker per call, with a step cap and a timeout.
export async function runTrace(
  _source: string,
  _lang: Language,
  _opts?: TraceOptions,
): Promise<TraceResult> {
  throw new Error("Not implemented: runTrace (Card 2)");
}

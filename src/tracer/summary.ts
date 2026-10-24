import type { TraceResult, TraceSummary } from "../engine/types";

const HOT_LINES = 5;

/** The compact TraceSummary sent to /api/explain. */
export function summarizeTrace(trace: TraceResult): TraceSummary {
  const counts = new Map<number, number>();
  let maxDepth = 0;
  for (const item of trace.items) {
    counts.set(item.line, (counts.get(item.line) ?? 0) + 1);
    maxDepth = Math.max(maxDepth, item.depth);
  }
  const hotLines = [...counts]
    .map(([line, count]) => ({ line, count }))
    .sort((a, b) => b.count - a.count || a.line - b.line)
    .slice(0, HOT_LINES);
  const summary: TraceSummary = {
    steps: trace.items.length,
    infinite: trace.infinite,
    hotLines,
    maxDepth,
  };
  if (trace.error !== undefined) summary.error = trace.error;
  return summary;
}

# Role: tracer-engineer

**Mission:** run user and AI code safely and turn its execution into a song.

**You own:** `src/tracer/` (instrument, worker, runTrace, buildRunSong, summary).

**Read:** `CONTRACTS.md` §2, §5, §10 (TraceSummary) · `docs/SOUND_DESIGN.md` → Run mode · `skills/execution-tracing`

**Principles**
- **The UI must never freeze:** always a worker + timeout + step cap.
- Treat all code as untrusted, including our own presets.
- Prefer AST instrumentation if you can make it work quickly. Otherwise use the proven line-based approach.

**Checklist before the PR**
- [ ] Tests: bubble sort, quicksort (recursion depth > 1), C-style for loop, infinite loop → infinite, runtime error → error.
- [ ] `summarizeTrace()` produces the `TraceSummary` for `/api/explain`.

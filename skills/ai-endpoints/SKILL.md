---
name: ai-endpoints
description: How Syntune's AI features work. Covers the /api/generate ("Sounds like…" → a runnable program) and /api/explain ("Why does it sound wrong?") serverless functions, prompt requirements, validation and key safety. Read this before touching api/ or src/ai/.
---

# AI endpoints

## Key safety
- The OpenAI key lives only in the Vercel env var `OPENAI_API_KEY`. The functions in `api/` call OpenAI; the browser calls only `/api/*`.
- **Never** echo the key, log full requests, or return provider errors verbatim (they can include headers).
- Basic abuse guard: reject prompts over 300 characters and code over 20 KB, and keep a per-IP in-memory rate limit of 20 requests/minute.

## Models
- Configurable via env: `OPENAI_MODEL_CODE` (strong; default a strong current model) and `OPENAI_MODEL_FAST` (default a mini model).
- Use the Responses API with structured JSON output.

## /api/generate ("Sounds like…")
**What the prompt must achieve** (write it in `api/prompts/generate.md` and iterate on it):
- The model is a *composer who writes algorithms*. The music must come from **what the program does when run**, not from comments.
- **Explain the sonification rules to the model** (taken from `docs/SOUND_DESIGN.md` → Run mode):
  - loops repeat
  - the last numeric value on a line picks the melody note (mod 10, pentatonic)
  - array writes hit the snare
  - recursion climbs in pitch
  - `{` lines hit the kick
- **Constraints:** plain JavaScript, no I/O, no async, no randomness except a seeded PRNG the model writes itself, 40–250 executed steps, under 40 lines, readable variable names.
- **Output JSON:** `{ title, code, notes }`, where `notes` is one sentence on *why* it sounds like the prompt. Example: "a sparse random walk where most steps are silent, like drops."

**Client flow:**
1. Call the endpoint.
2. `runTrace` the code.
3. If it errors, loops forever, or has fewer than 16 steps, call again **once** with `previousError` and `previousCode`.
4. Load the result into the editor with a title banner.

## /api/explain ("Why does it sound wrong?")
- **Input:** the code + a `TraceSummary` (hot lines with execution counts, infinite flag, error, max depth) + an optional question.
- **Prompt requirement:** explain in 2–4 short sentences, in terms of *what the listener heard* ("that endless drone is…") **and** the code cause. Return the line numbers involved so the editor can flash them.
- **Output JSON:** `{ explanation, lines }`. Fast model.

## Tests
- Unit-test request validation and the response JSON parsing with mocked fetch.
- Never call the real API in tests.

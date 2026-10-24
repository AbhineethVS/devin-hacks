# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `2026-10-24T21:30:00+05:30`.

## Event build log

No project implementation has been recorded yet. Add entries as you build:

```text
## <actual timestamp> — <short change title>

- Changed: <feature or files changed>
- Why: <reason for the change>
- Validation: <commands or manual checks actually run, with results>
- Limitations: <known issues, or "None identified in these checks">
```

## 2026-10-24T22:43:00+05:30 — Default pack now sounds exactly like the original sound test

- Changed:
  - `src/engine/mapping.ts`: identifier hash is now `h * 31 + charCode`, seeded with 7 (it was FNV-1a, which changed every melody note). Type, keyword, number and string notes last a 16th (they were 8th notes). Bells play at velocity 0.8.
  - `src/engine/scheduler.ts`: default velocity is 1 (it was 0.8).
  - `src/packs/default.ts`: drums are filtered noise (1.8 kHz high-passed snare, 7 kHz and 6 kHz high-passed hats; they were MetalSynth hats and an unfiltered snare), the rim goes through a 2.5 kHz band-pass, and the lead, bell, bass, kick and drone settings match the test.
  - `src/tracer/runSong.ts`: function pads and the per-depth pitch climb are off (`FUNCTION_PADS`, `DEPTH_CLIMB`); the Run bell plays at 0.48.
  - `src/presets.ts`: bubble sort, quicksort, the C-style loop and the infinite loop are the exact sound-test programs. Fibonacci is kept.
  - Tests updated to match, and `docs/SOUND_DESIGN.md` notes the reference sound.
- Why: the engine sounded different from the sound test the project was chosen on.
- Validation:
  - `npm test` 102/102 passed, `npm run build` passed, `npm run lint` passed.
  - A parity script compared Play-file step sequences against the sound-test page: **0 differing steps** for bubble sort (132), quicksort (200), the C loop (72) and the infinite loop (28).
  - Headless Chrome on `/dev/engine.html` played with 0 console errors.
- Limitations: Run mode follows the same rules but isn't note-identical, because the AST tracer also records loop-header checks, so runs have a few more steps. Not yet checked by ear after this change.

## 2026-10-24T22:27:00+05:30 — Cards 1 + 2: music engine, Default pack and Run-mode tracer

- Changed:
  - Card 1 (`src/engine/`, `src/packs/`): regex tokenizer for 9 languages (block comments, 64-token line cap, 400-line flag), `detectLanguage`, the token → sound mapping from `docs/SOUND_DESIGN.md`, `buildFileSong`, a Tone.js scheduler (`createPlayer`, `startAudio`, backing beat, mono-synth collision nudge, live BPM), the Default pack with one limiter and a shared analyser. Tone loads lazily, so audio only starts on a click.
  - Card 2 (`src/tracer/`): AST instrumentation (acorn + astring) tracing every statement, loop iteration and call with depth; a sandboxed Web Worker per run with a 1500-step cap and a 1500 ms timeout; `buildRunSong` (infinite loop → 48 steps + drone, error → crash) and `summarizeTrace`.
  - Integration fix: the worker now posts `{ ready: true }` once loaded, and `runTrace` starts its run timeout only then, with a separate 10 s start-up limit. Before this, a slow worker load could be reported as an infinite loop.
  - `src/tracer/integration.test.ts`: every preset in both modes with the real mapping; every pitched note is in the scale, and output is deterministic.
  - `dev/engine.html`: preset picker and a Run button. `dev/trace-check.html`: runs every preset through the real worker. `scripts/browser-check.mjs`: headless-browser check with console error capture. Added a favicon (it was a 404 console error).
  - New dependencies: `acorn@8.19.0` and `astring@1.9.0`, a real JS parser and code generator, so the tracer gets accurate statements, loops and recursion depth.
- Why: Wave 1 of the task cards. The core music for both modes now works.
- Validation: `npm run build` passed. `npm test`: 16 files, 102 tests passed. `npm run lint` passed. In headless Edge (real time): `dev/trace-check.html` gave bubble sort 85 items, quicksort 161 (depth 6), C loop 35, infinite loop 1500 + `infinite`, fibonacci 124 (depth 7), `fetch` blocked. Clicking Play file and Run on `/dev/engine.html` played with 0 console errors (Run reached "Finished"). The main page has 0 console errors.
- Limitations: sound not yet checked by ear. Not wired into the main UI (Card 5). Deviations from SOUND_DESIGN.md need your review: string degree = length mod 10, recursion bonus capped at +5, the function pad re-triggers every 8 steps, and probe values are read before the line runs. When the drone ends a song, `onEnd` fires while it's still ringing.

## 2026-10-24T21:58:00+05:30 — Card 0: project scaffold

- Changed:
  - Vite + strict TypeScript app. npm scripts: `dev`, `build` (tsc + vite), `test` (Vitest), `lint` (ESLint + Prettier), `format`.
  - Dependencies pinned to exact versions published before 2026-10-17 (`npm install --before`): tone, @codemirror/{state,view,language,lang-javascript,lang-cpp,lang-python}, lz-string, lucide. Dev: typescript, vite, vitest, eslint, typescript-eslint, prettier.
  - Contract stubs with the CONTRACTS.md signatures in `src/engine`, `src/tracer`, `src/packs`, `src/ui`, `src/viz`, `src/github`, `src/share`, `src/ai`. Shared types live in `src/engine/types.ts`.
  - `src/presets.ts`: bubble sort, quicksort, C-style `for` with `int`, buggy infinite loop, recursive fibonacci.
  - Placeholder layout (`index.html`, `src/main.ts`, `src/styles.css`): top bar, editor, visualizer, status bar and transport, styled per skills/ui-quality.
  - `vercel.json` and `api/health.ts` (`GET /api/health` → `{ ok: true }`). API tests live in `tests/` so Vercel doesn't deploy them as functions.
  - CONTRACTS.md: documented conventions (1-based lines, factory names, the types file, stub markers). No shapes changed.
- Why: give the parallel task cards a working build and fixed module signatures to code against.
- Validation: `npm run build` passed. `npm test` passed: 10 files, 16 tests. `npm run lint` passed. Dev server loads at 1440×900 (screenshot in `docs/media/card-0-scaffold.png`).
- Limitations: there's no audio, tracer or real editor yet; Play file and Run only show a status message. Stubs throw "Not implemented". `/api/health` hasn't been tested on Vercel yet. No browser console capture was done; the screenshot only shows that `main.ts` ran to completion.

## 2026-10-24T21:53:05+05:30 — Correct Devin Hack Kochi event guidance

- Changed: corrected the current event name and AI tool guidance in `.github/pull_request_template.md`, `AGENTS.md`, `AI_USAGE.md`, `CHANGELOG.md`, `README.md`, `RULES.md`, `SUBMISSION.md`.
- Why: the organizer shared an older event template; Devin Hack Kochi has no
  major AI usage constraints and the template must not require a particular AI provider.
- Scope: preserved project implementation and historical assistance records.
- Validation: reviewed documentation diffs, checked whitespace with `git diff --check`, and checked local Markdown links for new breakage.
- Limitations: maintainer review is pending; application tests were not run for this documentation-only correction. (Merged from PR #3; entry moved into date order on merge.)

## 2026-10-24T21:42:00+05:30 — Fresh Syntune README

- Changed: replaced `README.md` with a new Syntune README (idea, planned features with status, stack, planned commands, doc links, prior art).
- Why: the README on GitHub was still the previous DevDay template.
- Validation: documentation-only. Checked that the links point to files in the repo.
- Limitations: setup commands are planned, not yet working; no features are built.

## 2026-10-24T21:25:16+05:30 — Rename event to Devin Hacks and AI tool to Devin

- Changed: Replaced the "DevDay Exchange Community Hackathon: Kochi" title with "Devin Hacks", and the Codex workflow references with Devin, in `README.md`, `RULES.md`, `AGENTS.md`, `AI_USAGE.md`, `SUBMISSION.md`, and `.github/pull_request_template.md`.
- Why: The team is entering Devin Hacks and will use Devin as its AI coding tool.
- Validation: Searched the repository for remaining "Codex" and "DevDay" mentions and reviewed the diff.
- Limitations: The venue, dates, Luma link, and credits lines (Codex/OpenAI credits) still describe the original event, and need confirming against the Devin Hacks announcement. The historical template-preparation note in `AI_USAGE.md` still credits Codex, which is accurate. (Superseded: the Syntune planning-docs commit, rebased on top of this change, replaced these files wholesale.)

## 2026-10-24T21:15:00+05:30 — Adapt template for Devin Hacks Kochi + Syntune planning docs

- Changed:
  - Updated `RULES.md`, `AGENTS.md`, `README.md`, `SUBMISSION.md`, `AI_USAGE.md`, `.gitignore` and the pull request template from the previous DevDay (Codex) template to Devin Hacks Kochi (solo, Devin, four tracks, 24–25 October).
  - Added `CONTRACTS.md`, `docs/` (product brief, sound design, demo script, task cards), `skills/` and `agents/`.
- Why: give the Devin sessions one consistent set of rules, interfaces and task specs before implementation starts.
- Validation: documentation-only. Checked that the files and cross-links exist. Unconfirmed event details are marked TODO.
- Limitations: no application code yet. Venue, credits, submission method and evaluation criteria still need to be confirmed with the organizers.

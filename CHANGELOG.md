# Change log

## 2026-10-24T21:53:05+05:30 — Correct Devin Hack Kochi event guidance

- Changed: corrected the current event name and AI tool guidance in `.github/pull_request_template.md`, `AGENTS.md`, `AI_USAGE.md`, `CHANGELOG.md`, `README.md`, `RULES.md`, `SUBMISSION.md`.
- Why: the organizer shared an older event template; Devin Hack Kochi has no
  major AI usage constraints and the template must not require a particular AI provider.
- Scope: preserved project implementation and historical assistance records.
- Validation: reviewed documentation diffs, checked whitespace with `git diff --check`, and checked local Markdown links for new breakage.
- Limitations: maintainer review is pending; application tests were not run for this documentation-only correction.

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

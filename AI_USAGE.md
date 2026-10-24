# AI usage record

Devin Hack Kochi has no major AI usage constraints. This project may keep an accurate record of assistance from Devin or any other AI tool; the record does not impose an event eligibility requirement. Keep summaries concise; omit secrets, private data and full transcripts.

## Event build log (AI assistance)

Mark human review as "Pending" until you have reviewed (and listened to) the result.

| Date and time (IST) | Tool / model | Task card | Session link | PR | What it built (files) | Human review / corrections | Validation and result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-24 21:58 | Devin | Card 0: Scaffold | TODO | [#2](https://github.com/AbhineethVS/devin-hacks/pull/2) | Vite + TS scaffold, contract stubs, presets, placeholder layout, `vercel.json`, `api/health.ts` | Pending | build ✓, 16/16 tests ✓, lint ✓ |
| 2026-10-24 22:15 | Devin (background sub-session) | Card 1: Engine | TODO | direct merge to `main` | `src/engine/*` (tokenizer, languages, mapping, fileSong, scheduler, audio), `src/packs/default.ts`, `src/packs/master.ts`, `dev/engine.*` | Pending (listen on `/dev/engine.html`) | merged: build ✓, 102/102 tests ✓, lint ✓; Play file runs 8 s in headless Edge with 0 console errors (not heard by ear) |
| 2026-10-24 22:10 | Devin (background sub-session) | Card 2: Tracer | TODO | direct merge to `main` | `src/tracer/*` (AST instrumentation with acorn + astring, worker sandbox, runTrace, runSong, summary) | Coordinator fix: the run timeout now starts after the worker reports ready | all 5 presets trace correctly in a real browser worker; Run plays to the end with 0 console errors |
| 2026-10-24 22:50 | Claude Code | Sound parity pass (after Cards 1–2) | n/a | direct commit to `main` | `src/engine/mapping.ts`, `src/engine/scheduler.ts`, `src/packs/default.ts`, `src/tracer/runSong.ts`, `src/presets.ts`, tests, `docs/SOUND_DESIGN.md` | Pending (listen on `/dev/engine.html`) | 102/102 tests ✓, build ✓, lint ✓; Play file matches the sound test with 0 differing steps on 4 presets |

## Other AI tools used during the event

| Tool | What it was used for | Where it appears |
| --- | --- | --- |
| OpenAI API | Runtime AI features ("Sounds like…", "Why does it sound wrong?") | `api/` |
| TODO | TODO | TODO |

## Planning and template preparation (before implementation)

On 24 October 2026 at the event, **Claude Code** (Anthropic) was used to:
- adapt this documentation template from the previous DevDay template
- research and choose the project idea
- write a throwaway sound test page outside this repository
- draft the planning docs: `AGENTS.md`, `RULES.md`, `README.md`, `SUBMISSION.md`, `CHANGELOG.md`, `AI_USAGE.md`, `CONTRACTS.md`, `docs/`, `skills/`, `agents/`, and the pull request template

No application code from that session is in this repository. TODO: the participant should review this note and keep it accurate.

## Event documentation correction — 2026-10-24T21:53:05+05:30

- Tool: Codex.
- Task: correct the organizer-shared template to Devin Hack Kochi and clarify
  that the event has no major AI usage constraints.
- Affected files: `.github/pull_request_template.md`, `AGENTS.md`, `AI_USAGE.md`, `CHANGELOG.md`, `README.md`, `RULES.md`, `SUBMISSION.md`.
- Human review: pending maintainer review of this pull request.
- Validation: documentation diff, whitespace, and local Markdown link checks;
  no application code changed and no runtime checks were needed.

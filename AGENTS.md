# AGENTS.md: rules for every agent working in this repo

**Syntune** (working name) turns code into music.
- **Play file** plays the source text, token by token, as a song.
- **Run** executes the program and plays its execution: loops repeat, data drives melody, errors and infinite loops are audible.

This is a solo, overnight hackathon build with a hard demo deadline. **Working and polished beats clever and broad.**

## Read first, every session
1. [RULES.md](RULES.md): the event rules. Build from scratch at the event, solo, with Devin.
2. [CONTRACTS.md](CONTRACTS.md): interfaces and data shapes. **Do not change a contract silently.** If you must, say so in the PR under "Contract change" with the reason.
3. [docs/PRODUCT.md](docs/PRODUCT.md): what we're building and the scope.
4. Your role brief in `agents/` and the skills named in your task card ([docs/TASK_CARDS.md](docs/TASK_CARDS.md)).

## Stack (fixed; don't introduce alternatives)
- **Vite + TypeScript (strict)**, vanilla DOM, no UI framework.
- **CodeMirror 6** for the editor.
- **Tone.js** for audio.
- **Canvas 2D** for visuals.
- **Vitest** for unit tests. **Playwright** only for a smoke test if time allows.
- **Vercel** for hosting. Serverless functions in `api/` hold the OpenAI key (`OPENAI_API_KEY`). **Never put a key in client code or commit one.**
- **lz-string** for share links.
- Any other runtime dependency needs one line of justification in the PR.

## Layout and file ownership
```
src/
  engine/   tokenizer, sound mapping, step builders, scheduler   (audio-engineer)
  tracer/   instrumentation, worker runner, trace → steps        (tracer-engineer)
  packs/    sound packs (data + instrument factories)            (audio-engineer)
  ui/ viz/ github/ share/   editor, visualizer, GitHub loading, share/export   (frontend-builder)
  ai/       client for /api endpoints                            (ai-integrator)
api/        Vercel functions: generate.ts, explain.ts            (ai-integrator)
docs/ skills/ agents/                                            (human + docs-writer)
```
Stay inside the folders your task names. Keep changes elsewhere minimal and call them out in the PR.

## Use basic coding patterns
- Straightforward, idiomatic code: small functions, clear names, simple data structures, one responsibility per module.
- The simplest implementation that meets the requirement. No speculative abstractions or features.
- Few, purposeful dependencies.
- Validate inputs, handle errors explicitly, show useful failure messages. **Never hide failures behind fake success or demo data.**
- Explain non-obvious decisions in short comments.

## Commands (keep them working; list them in README.md as soon as they exist)
- `npm run dev` starts the app.
- `npm run build` must pass with no TypeScript errors.
- `npm test` runs Vitest and must pass.
- `npm run lint` if configured.

## Definition of done for any task
- [ ] Build, tests and lint pass. Report what actually ran and its result.
- [ ] New logic in `engine/`, `tracer/` and `packs/` has unit tests.
- [ ] The PR has: what changed, how to try it, **a screenshot or short GIF**, and known limitations.
- [ ] No console errors when using the feature.
- [ ] Audio still starts only after a user gesture (`Tone.start()`).
- [ ] [CHANGELOG.md](CHANGELOG.md) has an entry for the change (real timestamp, what, why, validation, limitations).
- [ ] [README.md](README.md) is updated if setup, commands or behaviour changed.

## Document every meaningful change
- **CHANGELOG.md:** update it in the same commit or PR as each meaningful change.
- **AI_USAGE.md:** the human records each Devin session (card, session link, PR, what Devin built, what was changed by hand). Devin may draft its own row in the PR description for the human to copy.
- **Keep claims accurate.** Distinguish working and verified behaviour from planned work. Never invent test results, deployment success, AI usage or timestamps.

## Regular, honest commits
1. **One task card = one PR.** Small, coherent changes.
2. The human merges PRs as they're ready, **aiming for a meaningful checkpoint about every 30 minutes** while building. Never leave the night's work for one final commit.
3. Short, descriptive conventional messages: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
4. **No empty commits to satisfy the clock.** No backdating, no squashing away the event's history, no force-pushing or rewriting shared history.
5. If work is incomplete at a handoff, use an honest `wip:` message and say what's missing.

## Hard rules
- **The music must never crash the app.** User code runs only in the tracer worker, with a step cap and a timeout. **AI-generated code is untrusted user code.** Never execute user or AI code on the server.
- **Determinism:** the same code + pack + BPM always produces the same song. No `Math.random()` in mapping; use seeded hashes.
- **Musical safety:** every pitched note comes from the active pack's scale.
- **No secrets** in code, logs, PR descriptions or `.env.example`.

## Human preferences
- After every card: start the dev server (`npm run dev`, http://localhost:5173) and give the human a short manual test checklist for that card.

## Known gotchas (learned the hard way; see skills/)
- Tone mono synths **throw** if two notes start at the same instant → `skills/tone-scheduling`.
- `let` variables referenced before their declaration throw (temporal dead zone) inside value probes → `skills/execution-tracing`.
- Browsers block audio until a user gesture.
- The GitHub API allows 60 requests/hour without a token → prefer raw URLs → `skills/github-file-loading`.

## Before submission
- Complete [SUBMISSION.md](SUBMISSION.md).
- Check that the README's setup and demo steps match the submitted code.
- Check that the change log and AI usage record are complete, then commit and push.
- Record the final submitted commit SHA in SUBMISSION.md.
- Follow the organizers' submission method and deadline. The event ends **25 October 2026, 11:00 AM IST**.

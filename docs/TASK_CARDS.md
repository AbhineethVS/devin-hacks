# Syntune: Devin task cards (paste-ready)

**How to use:**
- Each card = **one Devin session = one PR.** Paste the prompt block as-is.
- **At most 2 sessions at a time:** you must review and *listen to* every PR, and credits are limited. Cards in the same wave own different folders.
- Merge in the order listed. Log every session in `AI_USAGE.md`.

| Wave | Cards | Start | Parallel? |
|---|---|---|---|
| 0 | Card 0: Scaffold | T+0 | No (everything depends on it) |
| 1a | Card 1 (engine) + Card 2 (tracer) | When Card 0 merges | 2 sessions |
| 1b | Card 3 (editor) + Card 4 (visualizer) | When 1 or 2 merges | 2 sessions |
| 1.5 | Card 5: Integration + Vercel deploy | When 1–4 merge | No |
| 2a | Card 8 (AI "Sounds like…") + Card 6 (sound packs) | When the core plays end to end | 2 sessions |
| 2b | Card 7 (GitHub + famous code) + Card 10 (share/export) | As 2a merges | 2 sessions |
| 2c | Card 9 (AI "Why does it sound wrong?") | As 2b merges | 1 session |
| 3 | Card 11 (QA) + Card 12 (README) | **3 AM feature freeze** | 2 sessions |
| Stretch | Cards S1, S2 | Only if wave 2 is merged before 1 AM | |

**You (not Devin):**
- tune `docs/SOUND_DESIGN.md` by ear after Card 5
- review every PR by listening to it
- record the demo video
- write the README intro in your own voice

---

## Card 0: Scaffold
```
Role: read agents/frontend-builder.md (you are setting up the project for every role).
Read first: AGENTS.md, CONTRACTS.md, docs/PRODUCT.md.

Task: scaffold the Syntune repo so four parallel sessions can start right after this merges.
- Vite + TypeScript (strict) app. npm scripts: dev, build, test (vitest), lint (eslint + prettier, light config).
- Dependencies: tone, @codemirror/* (state, view, language, lang-javascript, lang-cpp, lang-python), lz-string, lucide. Dev dependencies: vitest, eslint, prettier.
- Create the folder layout from AGENTS.md. Put a stub in every module, with the exact exported signatures from CONTRACTS.md. Stubs throw "not implemented" or return minimal fake data, so other sessions can code against them.
- src/presets.ts with 5 presets (plain source strings): bubble sort (JS), quicksort (JS, recursive), a C-style for loop using `int`, a buggy infinite loop (while with no increment), recursive fibonacci (JS).
- index.html + src/main.ts showing a placeholder layout (top bar, editor area, visualizer area, bottom transport) matching skills/ui-quality.
- vercel.json for a Vite static build + the api/ functions folder (an api/health.ts returning { ok: true }).
- Keep the existing .gitignore, and add any build artefacts the stack produces.
- Do NOT rewrite README.md. Only fill in its "Run the project" commands. Add a CHANGELOG.md entry for the scaffold.
Acceptance: npm run build and npm test pass (one trivial test per module); dev server shows the placeholder layout; PR includes a screenshot.
Out of scope: any real audio, tracer or editor logic.
```

---

## Card 1: Engine (tokenizer, mapping, Play file, scheduler, Default pack)
```
Role: agents/audio-engineer.md.
Read first: AGENTS.md, CONTRACTS.md (§1–4, §6–7), docs/SOUND_DESIGN.md, skills/tone-scheduling, skills/code-tokenizing.

Task: implement the music engine so "Play file" works end to end from code.
- src/engine/languages.ts: keyword/type sets for js, ts, c, cpp, java, python, go, rust, asm; detectLanguage().
- src/engine/tokenize.ts per the skill (block comments across lines, the 64-token line cap, the 400-line limit flag).
- src/engine/mapping.ts: soundForToken, noteFromDegree, stableHash, exactly per docs/SOUND_DESIGN.md.
- src/engine/fileSong.ts: buildFileSong (one token per 16th step, lines padded to whole beats, comment lines become pad rests).
- src/engine/scheduler.ts: Player per the contract. Tone transport scheduleRepeat, UI callbacks via Tone.Draw, the mono-synth collision nudge, clean stop, live BPM, backing beat from pack.backing.
- src/packs/default.ts: the Default pack (instruments, mix levels and limiter from docs/SOUND_DESIGN.md) + an exported Tone.Analyser for the visualizer.
- A temporary dev page (dev/engine.html) with a textarea and a Play button, so you can listen.
Acceptance: unit tests for tokenizing (C for-loop, Python def, block comments), mapping (`;` → snare, `{` → kick, deterministic identifiers) and fileSong step counts; 60 seconds of bubble-sort playback with backing on gives zero console errors; PR has a short screen recording with sound if possible.
Out of scope: Run mode, UI, other packs.
```

---

## Card 2: Tracer (Run mode)
```
Role: agents/tracer-engineer.md.
Read first: AGENTS.md, CONTRACTS.md (§2, §5, §10 TraceSummary), docs/SOUND_DESIGN.md (Run mode), skills/execution-tracing.

Task: implement safe execution tracing and the Run-mode song builder.
- src/tracer/instrument.ts: the C-like rewrite + instrumentation. Try AST (acorn + astring) with __enter/__exit for depth and function names; if that isn't solid within ~60 minutes, ship the line-based approach from the skill and note it.
- src/tracer/worker.ts + runTrace(): a fresh Web Worker per run, terminated after timeoutMs (1500), step cap (1500), network APIs stubbed, console silenced.
- src/tracer/runSong.ts: buildRunSong per docs/SOUND_DESIGN.md (percussion from line shape, melody from values, depth adds degrees, function pads, infinite → 48 steps + drone, error → crash).
- src/tracer/summary.ts: summarizeTrace(trace) → TraceSummary.
Acceptance: tests for bubble sort (50–150 items, no error), quicksort (depth > 1), C-style for with `int`, while(true) with no __s calls (killed by the timeout, reported infinite), runtime error → error message. All the presets in src/presets.ts run.
Out of scope: UI and audio playback (use the Player from Card 1, or a stub).
```

---

## Card 3: Editor + transport + layout
```
Role: agents/frontend-builder.md.
Read first: AGENTS.md, CONTRACTS.md (§7–8), skills/ui-quality.

Task: build the main UI against the contracts (use the stubs if Cards 1/2 haven't merged).
- src/ui/editor.ts: CodeMirror 6 editor implementing EditorApi. Language modes for js/c/cpp/python. Token highlight = pink pill on the current token; line highlight = blue wash; smooth auto-scroll during playback.
- Top bar: logo/wordmark "Syntune", preset picker (src/presets.ts), a GitHub URL input placeholder (wired up in Card 7), a "Sounds like…" button placeholder (Card 8).
- Bottom transport: Play file, Run, Stop, BPM slider (70–180), pack chips (Default + placeholders), backing toggle, Share and Export placeholders.
- Status bar for Step.message (red styling for infinite loop / crash).
- Keyboard: Space play/stop, F play file, R run.
- Designed empty, loading and error states. Dark studio theme per the skill.
Acceptance: PR screenshots at 1440×900 (idle, playing with highlight, infinite-loop state using fake steps); no layout shift while playing.
Out of scope: the visualizer canvas (Card 4), real GitHub/AI/share logic.
```

---

## Card 4: Visualizer
```
Role: agents/frontend-builder.md.
Read first: AGENTS.md, CONTRACTS.md (§2, §9), skills/ui-quality.

Task: src/viz/visualizer.ts, a Canvas 2D visualizer that makes every step visible.
- Inputs: onStep(step) and an AnalyserNode (waveform).
- Layers: (1) a waveform ribbon from the analyser; (2) a burst per SoundEvent, colour-coded by voice (kick = big low ring, snare = sharp flash, hats = small sparks, lead/bell = rising notes placed by pitch); (3) a subtle canvas shake on kicks.
- Run-mode extras: recursion depth shown as stacked rings; the infinite-loop drone tints everything red with a slow distortion wobble.
- 60 fps on a mid laptop; respect devicePixelRatio; pause when the tab is hidden.
- A dev page (dev/viz.html) driving it with fake steps at 112 BPM.
Acceptance: a GIF of the dev page in the PR; no frame drops over 15 seconds on the dev page.
Out of scope: the editor and transport.
```

---

## Card 5: Integration
```
Role: agents/frontend-builder.md (+ read agents/audio-engineer.md and agents/tracer-engineer.md).
Read first: AGENTS.md, CONTRACTS.md.

Task: wire Cards 1–4 together in src/main.ts so the full core works:
- Play file → tokenize → buildFileSong → Player.play; Run → runTrace → buildRunSong → Player.play.
- Player.onStep → editor.highlight + visualizer.onStep + status bar. Player.onEnd → reset the UI.
- Preset picker loads code and sets the language. Language changes update the tokenizer and the editor mode. For non-JS/C languages, Run is disabled with the tooltip "Run supports JavaScript and C-like code. Use Play file."
- Remove the temporary dev pages from navigation (keep the files).
- Deploy to Vercel (I'll connect the project; make sure the build works there).
Acceptance: on the deployed URL, all 5 presets work in both modes with synced highlight and visuals; the infinite-loop preset shows the red drone state; zero console errors.
```

---

## Card 6: Sound packs
```
Role: agents/audio-engineer.md.
Read first: docs/SOUND_DESIGN.md (Packs), CONTRACTS.md §6, skills/tone-scheduling.

Task: add Lo-fi, Techno and 8-bit packs (Orchestral only if all three are done and sound good) in src/packs/, and wire the pack chips (dispose the old instruments on switch; apply the pack's suggested BPM unless the user moved the slider).
- Lo-fi: C major pentatonic, 82 BPM, soft tones, low-pass ~1.8 kHz, quiet vinyl-noise bed, slight swing.
- Techno: A natural minor, 128 BPM, four-on-the-floor backing, acid saw bass with filter envelope, short claps for the snare.
- 8-bit: C major pentatonic, 140 BPM, square/pulse only, noise drums, no reverb.
Acceptance: each pack plays bubble sort and quicksort cleanly for 30 seconds with zero console errors; switching packs mid-song doesn't leak audio; PR lists anything you think sounds off.
```

---

## Card 7: GitHub loader + Famous Code shelf
```
Role: agents/frontend-builder.md.
Read first: skills/github-file-loading, CONTRACTS.md §1 (detectLanguage).

Task: src/github/: paste any GitHub file, folder or repo URL → load code into the editor.
- URL parsing for blob, raw, tree and repo-root URLs (unit tests).
- Folder/repo → one git/trees?recursive=1 call → a searchable file picker (code extensions only, skip anything over 200 KB).
- Fetch file contents via raw.githubusercontent.com. sessionStorage cache. A friendly rate-limit message.
- A "Famous code" shelf in the top bar: Apollo 11 (a short .agc file), Quake III q_math.c, Doom m_random.c, one small Linux kernel file. Verify each URL works; bundle a fallback copy in public/famous/ with the licence or attribution header kept.
Acceptance: the four famous entries load and play (Play file); a random public repo URL opens the picker; bad URLs show a helpful error.
```

---

## Card 8: AI "Sounds like…" (code generation)
```
Role: agents/ai-integrator.md.
Read first: skills/ai-endpoints, skills/execution-tracing, docs/SOUND_DESIGN.md (Run mode), CONTRACTS.md §10.

Task: build the "Sounds like…" feature.
- api/generate.ts (Vercel function, OPENAI_API_KEY from env, model from OPENAI_MODEL_CODE): Responses API with JSON output { title, code, notes }. Input validation + per-IP rate limit.
- api/prompts/generate.md: a prompt that teaches the model the Run-mode sonification rules and the constraints from the skill. The music must come from what the program DOES.
- src/ai/generate.ts: client flow: call → runTrace → if error/infinite/<16 steps, retry once with previousError/previousCode → load into the editor with a title banner + notes → auto-play Run.
- UI: a "Sounds like…" popover with an input and 4 example chips; a composing state with an animated indicator.
Acceptance: 5 test prompts (listed in the role brief) all produce running programs; paste titles + step counts in the PR. No key in the client bundle (grep dist/ for "sk-").
```

---

## Card 9: AI "Why does it sound wrong?"
```
Role: agents/ai-integrator.md.
Read first: skills/ai-endpoints, CONTRACTS.md §10 (TraceSummary).

Task: an explain button that appears after any Run (prominent after infinite loop / crash).
- api/explain.ts (fast model): input { code, traceSummary, question? } → { explanation, lines }.
- api/prompts/explain.md: explain in 2–4 short sentences, in terms of what the listener HEARD plus the code cause.
- src/ai/explain.ts + UI: a side card with the explanation; flash the returned lines in the editor.
Acceptance: the infinite-loop preset → the explanation names the while loop and the variable that never changes; bubble sort → explains the repeating comparison riff. Screenshots in the PR.
```

---

## Card 10: Share link + audio export
```
Role: agents/frontend-builder.md.
Read first: skills/audio-export, CONTRACTS.md §11.

Task: src/share/:
- Share button → copies a URL with the state in the hash (lz-string); loading the URL restores the state and shows "▶ Press play".
- Export button → records the current song via Tone.Recorder from step 0 to the end → downloads syntune-<title>.webm; progress indicator; transport disabled while recording; 3-minute cap.
- Stretch (only if quick): "Export video" using canvas.captureStream + audio via MediaRecorder.
Acceptance: a share link round-trips all 5 presets (code, language, pack, BPM, mode); the exported file plays in a normal media player.
```

---

## Card 11: QA pass (after the 3 AM freeze)
```
Role: agents/qa-reviewer.md.
Task: follow the role brief exactly on the deployed URL. Produce the ranked issue list and open small PRs for blockers only. No new features.
```

## Card 12: README + docs (after the 3 AM freeze)
```
Role: agents/docs-writer.md.
Task: write README.md per the role brief, using AI_USAGE.md for the "How I built this with Devin" section. Leave clearly marked TODOs where the human must add the demo video link and their own intro paragraph. Add GIFs if they're available in docs/media/.
```

---

## Stretch S1: Repo history song
```
Role: agents/audio-engineer.md + agents/frontend-builder.md.
Task: a "History" mode for a pasted repo URL. GET /repos/{o}/{r}/stats/contributors (it may return 202 at first: retry with backoff up to ~10 s). Weeks = steps (8n), the top 4 contributors = 4 voices, additions → velocity + pitch degree, silent weeks = rests, a big spike → crash. Show a timeline scrubber with year labels.
Acceptance: facebook/react and a small repo both play; the 202-retry path is handled.
```

## Stretch S2: Conduct your code (webcam)
```
Role: agents/frontend-builder.md.
Task: an optional "Conduct" toggle. MediaPipe Hand Landmarker (self-hosted assets): hand height sets BPM (70–180, smoothed); a sideways swipe skips to the next function/section; open palm = pause. Webcam preview in a corner.
Acceptance: works at 30 fps on the demo laptop; can be turned off; no impact when off.
```

# Syntune

**Your code, played as music.** Hear what your code *looks* like, then hear what it actually *does*.

Built solo at **[Devin Hack Kochi](https://luma.com/3v8n74l1)** (24–25 October 2026) with Devin. Track: **Make Room for Play**.

> **Status:** in development. The main app plays: a CodeMirror editor with live token and line highlighting, Play file and Run, and a visualizer. Each feature is marked as it lands and is verified.

## The idea

Every program has a song. Syntune plays it in two ways:

| Mode | What you hear |
| --- | --- |
| **Play file** | The source text as a song. Every token is a 16th-note step: `;` is a snare, `{ }` a kick, keywords ring as bells, variable names carry the melody. The same code always gives the same song. |
| **Run** | The program executes in a sandbox and performs itself. Loops repeat their riff, values become melody, array writes hit the snare, recursion climbs in pitch, crashes crash, and **an infinite loop drones forever**. |

You can hear the difference between bubble sort and quicksort, and you can hear a bug.

## Planned features

| Feature | Status |
| --- | --- |
| Editor with live token and line highlighting | Built (CodeMirror 6) |
| Play file and Run modes | Built, in the main app |
| Presets: bubble sort, quicksort, C-style `for`, infinite loop, recursive fibonacci | Built |
| Sound packs: Default, Lo-fi, Techno, 8-bit | Default built; others planned |
| Visualizer that pulses with every step | Built (waveform, per-sound bursts, depth rings, red drone mode) |
| Play any file from GitHub, plus a "Famous code" shelf (Apollo 11, Quake III, Doom, Linux) | Planned |
| AI **"Sounds like…"**: describe a sound, the AI writes a program, the music comes from running it | Planned |
| AI **"Why does it sound wrong?"**: explains the music from the code and its trace | Planned |
| Share links and audio export | Planned |

## Tech stack

Vite + TypeScript (strict), vanilla DOM, [CodeMirror 6](https://codemirror.net/), [Tone.js](https://tonejs.github.io/), Canvas 2D, [Vitest](https://vitest.dev/), [lz-string](https://github.com/pieroxy/lz-string), hosted on [Vercel](https://vercel.com/). The AI features call the OpenAI API from Vercel serverless functions; the key never reaches the browser. User and AI code runs only in a sandboxed Web Worker in the browser, with a step cap and a timeout.

## Run the project

Prerequisites: Node.js 20 or newer (developed on Node 24).

```bash
npm install
npm run dev     # start the app at http://localhost:5173
npm run build   # type-check (tsc) and build to dist/
npm test        # Vitest unit tests
npm run lint    # ESLint + Prettier check (npm run format to fix)
```

Open http://localhost:5173, pick a preset and press **Play file** (F) or **Run** (R). Space plays and stops; Esc stops. Headphones help. `/dev/engine.html` is the bare engine test page.

`node scripts/browser-check.mjs <url> [selector] [waitForRegex] [timeoutMs] [clickSelector] [listenMs]` opens a page in headless Edge/Chrome, optionally clicks a button, and prints the page text plus any console errors.

The AI features will need `OPENAI_API_KEY`, set in Vercel or a local `.env.local` that is never committed.

## Project docs

- [AGENTS.md](AGENTS.md): rules for every agent working in this repo
- [CONTRACTS.md](CONTRACTS.md): interfaces and data shapes
- [docs/PRODUCT.md](docs/PRODUCT.md): product brief and scope
- [docs/SOUND_DESIGN.md](docs/SOUND_DESIGN.md): the token-to-sound mapping
- [docs/TASK_CARDS.md](docs/TASK_CARDS.md): the build plan, one Devin session per card
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md): the 2-minute demo
- [RULES.md](RULES.md): event rules

## Prior art

Program auralization research (for example CAITLIN, 1996) showed that people can hear bugs, but it never became something people want to use. Live-coding tools like Sonic Pi and Strudel are music *languages*: you write code meant as music. Syntune plays **ordinary programs**.

## How I built this with Devin

Every Devin session is recorded in [AI_USAGE.md](AI_USAGE.md), and every meaningful change in [CHANGELOG.md](CHANGELOG.md).

## Event clarification

Devin Hack Kochi has no major AI usage constraints. Participants may use Devin and other AI tools, models, and providers; this template does not require Codex or restrict AI usage to OpenAI. AI usage notes are project documentation, not an additional event eligibility requirement.

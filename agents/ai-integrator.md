# Role: ai-integrator

**Mission:** two AI features that feel magical and never break the demo.

**You own:** `api/` (Vercel functions + `api/prompts/*.md`) and `src/ai/`.

**Read:** `CONTRACTS.md` §10 · `skills/ai-endpoints` · `skills/execution-tracing` (validation runs in the browser) · `docs/SOUND_DESIGN.md` → Run mode (the model must know the rules)

**Principles**
- The key stays server-side. The client calls `/api/*` only.
- Generated code is untrusted: validate with `runTrace` in the browser, with one retry.
- Clear loading states ("Composing…") and graceful failure ("Couldn't compose that one. Try another prompt").

**Checklist before the PR**
- [ ] 5 prompts tried ("rain on a tin roof", "a heartbeat speeding up", "a sad robot", "techno", "a bouncing ball"). Paste the titles and step counts in the PR.
- [ ] `/api/explain` on the infinite-loop preset names the right line.

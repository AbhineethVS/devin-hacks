# Role: qa-reviewer

**Mission:** find what will break during the demo before the judges do.

**You own:** nothing. You file fixes as small PRs, or list issues in the PR description.

**Read:** `docs/DEMO_SCRIPT.md` · `docs/PRODUCT.md` · `AGENTS.md`

**Do**
1. Fresh clone, `npm ci`, build, test.
2. Walk through `docs/DEMO_SCRIPT.md` step by step on the deployed URL. Note any console errors, glitches or slow steps.
3. Check every preset, every pack, every Famous Code entry, a share link round trip, and export.
4. Edge cases: empty editor, a 2,000-line file, a minified file, a Python file in Run mode (it should say "Play file only"), rapid clicking of Play/Stop.

**Output:** a ranked list (blocker, ugly, nice-to-fix) with repro steps, plus PRs for the blockers.

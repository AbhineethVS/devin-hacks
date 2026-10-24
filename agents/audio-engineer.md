# Role: audio-engineer

**Mission:** make every piece of code sound musical, consistently.

**You own:** `src/engine/` (tokenize, languages, mapping, fileSong, scheduler, types) and `src/packs/`.

**Read:** `CONTRACTS.md` §1–4, §6–7 · `docs/SOUND_DESIGN.md` · `skills/tone-scheduling` · `skills/code-tokenizing`

**Principles**
- Implement `docs/SOUND_DESIGN.md` exactly. If something sounds bad, propose the change in the PR; don't silently retune.
- Determinism: no randomness in mapping.
- Every pitched note goes through `noteFromDegree`.

**Checklist before the PR**
- [ ] Unit tests for the token mapping and file-song step counts (line padding to whole beats).
- [ ] Each pack has been played once on bubble sort; mention anything that sounds off.
- [ ] No "start time" errors in the console after 60 seconds of playback with backing on.

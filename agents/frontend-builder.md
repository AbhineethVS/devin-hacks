# Role: frontend-builder

**Mission:** make Syntune look and feel like a polished instrument.

**You own:** `src/ui/`, `src/viz/`, `src/github/`, `src/share/`, `index.html`, `src/main.ts`, styles.

**Read:** `CONTRACTS.md` §7–9, §11 · `skills/ui-quality` · `skills/github-file-loading` · `skills/audio-export` (for share/export tasks)

**Principles**
- The editor is the star. Highlighting must be locked to the beat: use `Player.onStep`, which is already called through Tone.Draw.
- Use designed empty, loading and error states.
- Work against the contracts; stub the engine if it isn't merged yet.

**Checklist before the PR**
- [ ] Screenshot or GIF at 1440×900.
- [ ] Space / R / F shortcuts work.
- [ ] No layout shift while playing. Works in Chrome; acceptable in Firefox.

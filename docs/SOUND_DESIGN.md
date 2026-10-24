# Sound design (owned by the human; agents implement it exactly)

> **Reference sound:** the Default pack must sound like the original sound test the project was chosen on. As of the parity pass, Play file is identical to it, note for note:
> - identifier hash `h = h * 31 + charCode`, seeded with 7
> - every pitched note lasts a 16th
> - default velocity 1, bells at 0.8
> - the drums are filtered noise
> - the synth settings in `src/packs/default.ts`
>
> **Run mode:** function pads and the per-depth climb below are switched **off** (`FUNCTION_PADS`, `DEPTH_CLIMB` in `src/tracer/runSong.ts`) to match the test. Try them later by ear.

This mapping was tested and sounds good. Keep it as the **Default** pack baseline, and only change it here first.

## Scale and grid
- **Scale:** A minor pentatonic (A C D E G) for Default. No out-of-scale notes, ever.
- `noteFromDegree(d, oct)` = `scale[d mod 5]` at octave `oct + floor(d / 5)`.
- **Grid:** 16th-note steps. Default 112 BPM (slider 70–180).
- **Backing beat** (toggle, default on): a soft kick every 8 steps and a soft hat at step 2 of each beat. velocity ~0.4.

## Token → sound (both modes use this)

| Token | Sound |
|---|---|
| `;` | snare |
| `{` | kick (C1) |
| `}` | kick (G0) |
| `(` `)` | hat |
| `[` `]` | hat, velocity 0.8 |
| `,` | hat, velocity 0.5 |
| `.` and other punctuation | rim C6, velocity 0.4 |
| comparison `< > <= >= == === != !==` | rim E6 |
| assignment `= += -= *= /=` | hat, velocity 0.6 |
| other operators | rim A5, velocity 0.7 |
| type keywords (`let const var int float double char long bool`) | bass, degree 0, octave 2 |
| other keywords | bell at (degree, octave 4) + bass at (degree, octave 2) |
| numbers | bass, degree = round(n) mod 10, octave 2 |
| strings | lead, degree = length, octave 5 |
| identifiers | lead, degree = stableHash(name) mod 7, octave 4 (or 5 when indent depth > 1) |
| comments | silent; a comment-only line becomes a 4-step rest with a soft pad chord |

Keyword degrees: `for` 0, `while`/`do` 1, `if`/`switch` 2, `else`/`false` 3, `return`/`case` 4, `function`/`def`/`fn` 5, `new` 6, `break`/`continue` 7, `true` 8, `null`/`None` 9. Unknown keywords: 0.

## Run mode: one executed line = one step
- **Percussion from the line's shape:**
  - a `{` on the line → kick
  - otherwise, a `;` → hat (velocity 0.7)
  - an array element write (`x[...] =`) → snare (velocity 0.8)
- **Bell:** the line's first non-type keyword (same degrees as above), velocity 0.6.
- **Melody from the data:**
  - the last numeric value probed on the line → lead, degree = value mod 10, octave 4 (5 when depth > 1)
  - if the line has no numeric value, use the sound of its first identifier
- **Depth (new):** each recursion level adds +1 degree to the melody (it climbs as it goes deeper).
- **Function call (new):** a pad note at the function's hash degree, while inside that function.
- **Infinite loop:** play the first 48 steps, then a distorted FM drone on A1 for 2 bars, with the message "Infinite loop: the program never ends."
- **Runtime error:** a crash cymbal plus a low kick, with the message "Crashed: …".

## Packs (same mapping; the instruments and scale change)

| Pack | Scale | BPM | Character |
|---|---|---|---|
| Default | A minor pentatonic | 112 | triangle lead, FM bell, saw bass, reverb 0.22 |
| Lo-fi | C major pentatonic | 82 | soft sine/triangle, low-pass at 1.8 kHz, vinyl-noise bed, slight swing |
| Techno | A minor (natural) | 128 | four-on-the-floor backing, acid saw bass with filter envelope, short claps |
| 8-bit | C major pentatonic | 140 | square and pulse waves only, noise drums, no reverb |
| Orchestral (stretch) | D dorian | 96 | string pad, pizzicato lead, timpani kick |

## Mixing
- Everything goes through one Limiter (-2 dB).
- Starting volumes: kick -4, snare -10, hat -12, rim -20, lead -8, bell -10, bass -10 dB.

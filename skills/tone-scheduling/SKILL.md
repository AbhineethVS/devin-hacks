---
name: tone-scheduling
description: How to schedule Syntune songs with Tone.js without glitches. Covers the transport, sync with the UI, mono-synth collisions, the user-gesture start, and cleanup. Read this before touching src/engine/scheduler.ts or src/packs/.
---

# Scheduling audio with Tone.js

## Rules
1. **Start audio only from a click handler:** `await Tone.start()` before the first play. Browsers block audio otherwise.
2. **Drive steps with the transport:** `Tone.getTransport().scheduleRepeat(cb, song.subdivision)`.
   - Inside `cb(time)`, trigger every event *at `time`*, never at "now".
   - Advance a step counter. At the end, schedule the stop through `Tone.getDraw()`.
3. **UI and visuals must sync through `Tone.getDraw().schedule(fn, time)`,** never directly in the audio callback. This is what keeps the highlight perfectly on the beat.
4. **The mono-synth collision gotcha:** `MembraneSynth`, `NoiseSynth`, `MetalSynth`, `MonoSynth` and `Synth` **throw** "Start time must be strictly greater than previous start time" when two notes start at the same instant. This happens when a backing kick and a `{` kick share a step.
   - Fix: keep the last start time per voice. If the new time is ≤ the last one, nudge it by +3 ms.
   - `PolySynth` voices (lead, bell, pad) are fine.
   - Reset the map on stop.
5. **One limiter at the end** (`Tone.Limiter(-2)`). Reverb only on the lead, bell and pad sends.
6. **Stop cleanly:** clear the scheduled repeat id, stop the transport, release any held drone, reset the step counter and the collision map.
7. **Pack switching:** dispose the old instruments (`.dispose()` on every node) before creating new ones, otherwise memory and volume pile up.
8. **BPM changes apply live** via `transport.bpm.value`.
9. **Analyser for visuals:** one `Tone.Analyser("waveform", 1024)` tapped after the limiter. Pass its underlying node to the visualizer.

## Testing
Unit-test step building, not audio. For the scheduler, test that `onStep` callbacks fire in order using a fake transport, and that stop/start leaves no scheduled events behind.

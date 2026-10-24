---
name: audio-export
description: How Syntune exports a song as an audio file (and optionally a video) and builds share links. Read this before touching src/share/.
---

# Export and share

## Share link
- Hash format (see CONTRACTS.md §11): `#c=<lzString.compressToEncodedURIComponent(code)>&l=<lang>&p=<pack>&b=<bpm>&m=<mode>`
- On load, if the hash is present, restore the state and show "▶ Press play" (audio still needs a click).
- Over about 8 KB of compressed code, warn that the link may be too long for some chat apps.

## Audio export
- Create a `Tone.Recorder`, connect the limiter output to it, `start()`, play the song from step 0, and `stop()` on the end event. The result is a webm/ogg Blob. Download it as `syntune-<title>.webm`.
- Show progress (current step / total). Disable the transport controls while recording.
- Cap exports at 3 minutes.

## Video export (stretch)
- `canvas.captureStream(30)` from the visualizer plus `Tone.getContext().createMediaStreamDestination()` for audio → combine the tracks → `MediaRecorder` (`video/webm;codecs=vp9,opus`).
- This makes ready-to-post clips for the demo and for social media.

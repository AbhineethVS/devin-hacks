# Syntune: product brief

**One-liner:** *Your code, played as music.* Hear what your code looks like, then hear what it actually does.

**Track:** 4 (Make Room for Play: make music). Bonus angle: Track 2 (you can *hear* bugs).

**Prior art (be upfront in the README):** program auralization research (CAITLIN, 1996; layered program auralization) showed people can hear bugs, but it never became something people want to use. Sonic Pi and Strudel are music *languages* (you write code meant as music). Syntune plays **ordinary programs**.

## The two modes
1. **Play file:** the source text as a song. Each token is one 16th note; each line rounds up to a whole beat. Symbols are drums, keywords are bells and bass, names are melody. The same code always gives the same song.
2. **Run:** the program executes in a sandbox, and each executed line is a step:
   - loops repeat their riff
   - variable values pick the melody notes
   - array writes hit the snare
   - recursion depth raises the pitch
   - function calls add a layer
   - errors crash; infinite loops drone

## Must have (the demo depends on these)
- Editor + Play file + Run, with live token/line highlighting
- Presets: bubble sort, quicksort, a C-style `for` loop, a buggy infinite loop, recursive fibonacci
- 4 sound packs: Default, Lo-fi, Techno, 8-bit (Orchestral is a stretch)
- Visualizer that pulses with every step
- **Play any file from GitHub** (paste a URL, pick a file), plus a "Famous code" shelf (see the demo script)
- AI: **"Sounds like…"** → the AI writes a runnable program, and the music comes from running it
- Share link
- Polished landing state

## Should have
- AI: **"Why does it sound wrong?"** explains the music from the code and the trace
- Audio export (download the song)

## Stretch (only if everything above is done before 1 AM)
- Repo history song (weekly contributor activity → song)
- "Conduct your code" with the webcam (hand height = tempo)
- Orchestral pack

## Out of scope
- Running whole repos, or non-JS languages in Run mode
- Accounts or a database
- Live multiplayer

## Rules of the night
- **Feature freeze at 3 AM.** After that: bug fixes, the video, the README.
- Every evening milestone must leave a demoable build on Vercel.

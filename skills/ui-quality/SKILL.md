---
name: ui-quality
description: Visual and UX standards for Syntune so it looks designed, not AI-generated. Covers layout, typography, colour, motion and the anti-slop checklist. Read this before any UI or visualizer work.
---

# UI quality bar

## Look and feel
- **Dark "studio" aesthetic:** near-black background (#0b0d12), one bold accent (hot pink #ff4d8d) plus one secondary (electric blue #2f6bff). No rainbow gradients.
- **Type:** a characterful display face for the title (e.g. "Space Grotesk" or "Clash Display" via a free licence) and a great monospace for code ("JetBrains Mono"). Body text: system UI.
- **Layout (desktop first, 1440×900 for the demo):**
  - **Top bar:** logo, preset picker, GitHub URL box, "Sounds like…" button.
  - **Centre:** the editor (60%) with the visualizer beside or behind it (40%).
  - **Bottom transport:** Play file, Run, Stop, BPM, pack chips, backing toggle, share, export.
- **The editor is the star:** big font (16–18 px). The current token gets a pink pill, the current line a blue wash. They scroll smoothly to follow playback.

## Motion
- Every step produces visible feedback (a token pulse, a visualizer burst). Kicks shake or flash the canvas subtly. The infinite-loop drone turns the UI red and distorts.
- 150–250 ms ease-out transitions. Nothing bounces for no reason.

## Anti-slop checklist (reject a PR that breaks these)
- [ ] No default purple-blue gradient hero, no glassmorphism everywhere.
- [ ] No emoji as icons; use one consistent icon set (e.g. Lucide).
- [ ] No identical three-card rows.
- [ ] Real hierarchy: one primary action per area.
- [ ] Empty, loading and error states are designed, not blank.
- [ ] Contrast is AA or better for text.
- [ ] Keyboard: Space = play/stop, R = run, F = play file.

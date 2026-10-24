# Demo script

## Setup

- Load `extension/` as an unpacked Chrome extension.
- Save the API key and preferred model before judging begins.
- Open the public IRCTC train-search homepage in the original view.
- Keep a previously generated IRCTC renderer and a Wikipedia article available as fallbacks.
- Keep a previously generated article available in another tab as a network/API fallback.

## Two-minute flow

1. Show the original IRCTC homepage and its competing menus, promotions, and cramped booking card.
2. Open Remodel and prompt: **“Turn IRCTC into a calm, premium Indian rail journey planner: booking first, confident railway typography, route-line navigation, useful services, restrained motion, and no generic cards or gradients.”**
3. While generation streams, explain that the model is writing a reusable renderer—not a screenshot or CSS theme—and that a second AI pass visually reviews its result.
4. Enter Ernakulam and New Delhi, choose a date and class, then search. Show the values reaching IRCTC's real results flow.
5. Press `Alt+R` before searching if needed to compare the original and remodelled homepages.
6. Open the cached Wikipedia example to demonstrate scroll motion and chapter remixing.

## Backup plan

- Use the cached IRCTC renderer and demonstrate the functional search form, links, and `Alt+R`.
- If model generation is unavailable, show the before/after screenshots in `docs/media/` and explain the live renderer contract.
- Be explicit that IRCTC support stops at public train search; login, captcha, booking, and payment use the original interface.

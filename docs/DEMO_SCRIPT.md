# Demo script

## Setup

- Load `extension/` as an unpacked Chrome extension.
- Save the API key and preferred model before judging begins.
- Open a long, image-rich Wikipedia article in the original view.
- Keep a previously generated article available in another tab as a network/API fallback.

## Two-minute flow

1. Show the original Wikipedia article and its dense, fixed presentation.
2. Open Remodel and prompt: **“Turn this into a cinematic graphic novel: bold chapter openers, archival labels, dramatic image crops, and restrained scroll motion.”**
3. While generation streams, explain that the model is writing a reusable renderer rather than a one-off screenshot or CSS theme.
4. Scroll through chapter reveals, the sticky navigation, transformed infobox, real article text, and working links.
5. Hover one chapter, click **Remix**, and ask: **“Make this chapter an interactive chronological timeline.”**
6. After the focused remix, press `Alt+R` to compare with the original.
7. Navigate to another Wikipedia article and show the saved design applying without another model call.

## Backup plan

- Use the cached generated renderer and demonstrate scrolling, chapter remix selection, links, and `Alt+R`.
- If model generation is unavailable, show the before/after screenshots in `docs/media/` and explain the live renderer contract.
- Be explicit that arbitrary-site extraction is experimental; the extension currently supports Wikipedia and Hacker News.

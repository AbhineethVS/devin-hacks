# Remodel

**Redesign and rewrite any website with a single prompt.**

Remodel is an AI-native browser extension that turns a page's real content into a new, reusable interactive experience. The embedded model acts as an art director and front-end engineer: it can invent the layout, components, typography, colour, and motion, while generated code runs inside an extension sandbox.

## Current prototype

- Rebuilds Wikipedia articles and Hacker News list/comment pages from a prompt.
- Creates one reusable renderer per page type and applies it instantly on later pages.
- Adds cinematic scroll reveals, parallax hooks, progress effects, and reduced-motion support.
- Lets you hover a generated Wikipedia chapter and remix that section with another prompt.
- Preserves links, Wikipedia search, caching, reset, and original/remodel switching with `Alt+R`.

Generic extraction for arbitrary sites exists as an experiment in `tools/generic-test.mjs`; it is not yet part of the installed extension.

## Try it

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension` directory.
3. Visit a Wikipedia article or Hacker News.
4. Open **Remodel**, save an OpenAI API key locally, choose a model, and enter a direction such as `Cinematic graphic novel with scroll-driven chapter reveals`.
5. Hover a redesigned Wikipedia chapter and choose **Remix** to transform it again.

There is no development server. The extension is loaded directly by Chrome. API keys are stored in local extension storage and are never committed.

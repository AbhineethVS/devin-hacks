# Remodel

**Redesign and rewrite any website with a single prompt.**

Remodel is an AI-native browser extension that turns a page's real content into a new, reusable interactive experience. The embedded model acts as an art director and front-end engineer: it can invent the layout, components, typography, colour, and motion, while generated code runs inside an extension sandbox.

## Current prototype

- Rebuilds any website from a prompt. The public IRCTC homepage, Wikipedia articles, and Hacker News pages have specialised extractors; every other site uses a generic extractor that reads sections, cards, forms, buttons and the site's brand.
- Writes the prompt for you: **Suggest prompts for this site** studies a screenshot of the page and its content, optionally researches the site on the web, and proposes three art directions. Notes you type first (for example "for kids") shape all three.
- Designs with real design knowledge: each request pulls matching styles, font pairings, palettes, page patterns and UX rules from the [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) data set, and the model follows design-judgement rules adapted from Anthropic's [frontend-design](https://github.com/anthropics/skills) skill. Licences are in `third_party/`.
- Reuses a design across websites: a "Graphic novel" listing made on one shop applies instantly to another listing site, in that site's colours and with its logo.
- Keeps IRCTC train search functional: station autocomplete, date, class, quota, and submission are bridged to the live booking form.
- Creates one reusable renderer per page type and applies it instantly on later pages.
- Adds cinematic scroll reveals, parallax hooks, progress effects, and reduced-motion support.
- Reviews generated pages from screenshots in the background and runs one repair pass when it finds visible layout defects.
- Lets you hover a generated Wikipedia chapter and remix that section with another prompt.
- Preserves links, Wikipedia search, caching, reset, and original/remodel switching with `Alt+R`.

Generic mode is best-effort; see the known limitations in `docs/PRODUCT.md`.

## Try it

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension` directory.
3. Visit the public [IRCTC train-search homepage](https://www.irctc.co.in/nget/train-search), a Wikipedia article, Hacker News, or any other website.
4. Click the **✦ Remodel** pill in the bottom-right corner (or the toolbar button, or press Alt+Shift+M), save an OpenAI API key locally, choose a model, and describe the new experience.
5. On IRCTC, use the redesigned booking form; Remodel hands the journey to IRCTC's real results page.
6. On Wikipedia, hover a redesigned chapter and choose **Remix** to transform it again.

There is no development server. The extension is loaded directly by Chrome. API keys are stored in local extension storage and are never committed.

IRCTC support intentionally ends at the public search handoff. Login, captcha, passenger details, booking, and payment remain in IRCTC's original interface.

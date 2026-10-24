# Contracts

## Generated renderer

An AI response defines:

- `const STYLE`: CSS scoped beneath `#rm`.
- `render(data)`: a pure function returning the complete page HTML.
- `mount(root)`: an optional enhancement function with no network access.

Plain-text data must pass through the provided `esc()` helper. Fields documented as sanitized HTML may be inserted directly.

## Cinematic hooks

- `data-rm-section="<id>"` and `data-rm-title="<title>"` identify remixable Wikipedia chapters.
- `data-rm-reveal="up|left|right|scale"` opts into viewport reveals.
- `data-rm-parallax="0.05..0.35"` opts into restrained parallax.
- `data-rm-progress` receives a `--rm-progress` CSS custom property between zero and one.

All hooks are optional except `data-rm-section` on rendered Wikipedia sections.

## Sandbox messages

The host sends `{ type: "render", code, data, options }`. The sandbox responds with `rendered`, `render-error`, `navigate`, `search`, `toggle`, or `select-section`. Navigation and search are performed by the host page.

## Wikipedia additions

Article data includes aggregate `stats`. Each section includes `index`, `wordCount`, `imageCount`, and extracted `years` for visual composition. These are presentation hints; original blocks remain the source of truth.

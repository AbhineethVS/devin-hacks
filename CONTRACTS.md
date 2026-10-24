# Contracts

## Generated renderer

An AI response defines:

- `const STYLE`: CSS scoped beneath `#rm`.
- `render(data)`: a pure function returning the complete page HTML.
- `mount(root)`: an optional enhancement function with no network access.

Plain-text data must pass through the provided `esc()` helper. Fields documented as sanitized HTML may be inserted directly.

## Cinematic hooks

- `data-rm-section="<id>"` and `data-rm-title="<title>"` identify remixable Wikipedia chapters.
- `data-rm-reveal="up|down|left|right|scale|mask|blur"` opts into viewport reveals.
- `data-rm-stagger="<reveal>"` applies staggered reveals to a container's children.
- `data-rm-scrub="zoom|rise|drift|fade|unmask"` opts into browser-native scroll-linked motion.
- `data-rm-parallax="0.05..0.35"` opts into restrained parallax.
- `data-rm-count` animates a statistic once, excluding year-like values.
- `data-rm-progress` receives a `--rm-progress` CSS custom property between zero and one.

All hooks are optional except `data-rm-section` on rendered Wikipedia sections.

## Sandbox messages

The host sends `{ type: "render", code, data, options }`. The sandbox responds with `rendered`, `render-error`, `navigate`, `search`, `toggle`, `select-section`, `bound-input`, `bound-submit`, or `bound-click`. Navigation, search, and bound control actions are performed by the host page.

## Bound forms

Site-specific controls extracted from the real page receive opaque `rm-N` IDs. Generated controls use those IDs only through `data-bind`; the host rejects any other ID.

The public IRCTC renderer must provide one `form[data-bound-form="train-search"]`, bind its origin, destination, date, class, quota, optional checkboxes, and submit button, and expose `data-rm-form-status` for bridge messages. Submission selects real PrimeNG autocomplete options, updates the original Angular controls, hides the redesign, and clicks IRCTC's own Find Trains button.

## Generic pages

`RemodelExtract.detect()` returns `{ site: <hostname>, type: "generic", generic: true }` for any http(s) page without a specialised extractor. Other IRCTC routes return `null`, so the script keeps watching for the train-search route.

Generic data has these parts (the full schema is `GENERIC_SCHEMA` in `extension/extractors.js`):

- `generic: true` and an `archetype` (`article`, `listing`, `form` or `landing`).
- `brand: { name, logo, favicon, colors: { primary, accent, bg, text } }`.
- `nav`, `footer`, `heroImage`, `search`, `stats`.
- `sections[]` of `{ id, title, index, wordCount, blocks[] }`, where blocks are `p`, `subheading`, `list`, `quote`, `image`, `table`, `link`, `button`, `cards` or `form`.

Rules:

- **Image scale:** generic `image` blocks carry the original displayed `w`, `h` and `role` (`icon` up to 96 px, `thumb` up to 240 px, `photo`, `hero`). Runs of small images become `{ type: "icons", size, items }`. After every render, the sandbox caps icon and thumb images at 1.5 times `w`, icon-role card images at 96 px, and unhinted images with natural width under 200 px at 1.5 times natural width. Capped images get `data-rm-capped` and are reported by the audit.
- **Brand variables:** the sandbox sets `--brand-primary`, `--brand-accent`, `--brand-bg` and `--brand-text` on the document root, only for values that pass `CSS.supports("color", …)`. Renderers must supply fallbacks.
- **Forms:** use the bound-form contract with the form's `rm-N` ID as `data-bound-form`.
- **Buttons:** standalone buttons and card actions use `<button type="button" data-bind="rm-N">`. The sandbox sends `bound-click` and the host clicks the real element.
- **Search:** `<form data-search>` sets the real search input and submits its form. Without one, it falls back to a site-restricted web search.
- **Single-page apps:** after a bound click, submit or search, the host waits for DOM mutations to settle, re-extracts the page and re-renders with the same renderer.
- **Design reference:** the content script sends `{ type: "design-ref", style, site }` to the service worker, which answers `{ text }`, or `{ text: "", error }` on failure. `text` is plain-text guidance retrieved from `design-kb.js` and appended to the build and prompt-writer requests. An empty `text` is valid.
- **Layout audit:** besides missing sections and capped images, the sandbox audit reports high severity when, on a page at least 1100 px wide, a section taller than 500 px has content spanning under 62% of the width and offset to one side.
- **Thesis:** every renderer opens with a `/* THESIS: … AVOIDED: … */` comment. It is stored with the renderer and passed as design context when the same style is generated for another archetype.
- **Cache:** generic renderers are stored under `renderer:generic:<archetype>:<hash(style prompt)>` with `{ code, prompt, model, style, thesis, host, archetype }`. A renderer whose `host` differs from the current site is applied instantly once; pressing Remodel again with the same prompt generates a fresh one.
- **Site preference:** `site:<hostname>` stores `{ enabled, prompt }`. A generic site auto-applies only when it is enabled; the panel pill is mounted on every page either way.

## Reskin

The model returns only a JSON theme spec; `extension/reskin.js` turns it into CSS. The model never writes CSS.

- **Spec:** `{ name, thesis, palette: { bg, surface, text, muted, border, primary, onPrimary, accent, link }, fonts: { heading, body }, heading: { weight, case, tracking, style }, radius: { card, button, input, badge }, card: { shadow, ring }, button: { shadow }, link: { underline } }`.
  - Colours must pass `CSS.supports("color")`, shadows `CSS.supports("box-shadow")` and font names `^[A-Za-z0-9 ]{2,40}$`. Radii are clamped. Anything invalid falls back to a derived default.
  - `heading.case` and `heading.tracking` are accepted but not applied, because they change text width.
- **Written properties:** only `color`, `-webkit-text-fill-color`, `background-color`, gradient `background-image` (colour stops remapped, alpha kept), `border-color`, `border-radius`, `box-shadow`, `font-family`, `font-weight` (headings with a matched font only), `font-style`, link `text-decoration-line`, and an input focus `outline`. Width, height, margin, padding, display, position and font size are never written.
- **Element hooks:** the engine writes `data-rm-k="<n>"` (a shared colour rule), `data-rm-role="card|button|input|heading|badge|link"` and `data-rm-font` on page elements, and `data-rm-skin` on `<html>`. `remove()` deletes all of them along with the injected `<style data-remodel-ui>`. Elements marked `data-remodel-ui` are skipped.
- **Colour mapping:** neutral colours map by lightness relative to the original page background and body text. Chromatic colours map by hue rank: the dominant hue goes to `primary` (text to `link`), the others to `accent`. Very light and very dark chromatic colours become tints. Text is pushed to WCAG AA (3:1 for large text) against its new effective background.
- **Fonts:** the content script sends `{ type: "font", family }`; the service worker answers `{ faces: [{ weight, style, data }] }`, with `data` base64 Latin-subset WOFF2 from Google Fonts. Each family is registered twice: once raw, once with `size-adjust` and ascent/descent overrides measured against the font it replaces.
- **Storage:** themes are stored under `theme:<hash(style prompt)>` as `{ spec, prompt, model, host, created }`. `site:<hostname>` gains `mode: "reskin" | "rebuild"`. The global default mode is `genericMode`. A theme whose `host` differs is applied instantly once; pressing Reskin again generates a fresh one.

## Wikipedia additions

Article data includes aggregate `stats`. Each section includes `index`, `wordCount`, `imageCount`, and extracted `years` for visual composition. These are presentation hints; original blocks remain the source of truth.

# Third-party notices

## UI UX Pro Max

- Source: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), commit `d14efff`.
- Licence: MIT. See `ui-ux-pro-max-LICENSE.txt`.
- Used in: `extension/design-kb.js`, which `tools/build-design-kb.mjs` generates from the skill's `styles.csv`, `typography.csv`, `colors.csv`, `products.csv`, `landing.csv` and `ux-guidelines.csv`.
- Modifications: rows were trimmed to selected columns and truncated, and UX guidelines were filtered to high-severity web rules.

## Anthropic frontend-design skill

- Source: [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design), commit `dbd4588`.
- Licence: Apache License 2.0. See `anthropic-frontend-design-LICENSE.txt`.
- Used in: the "DESIGN JUDGEMENT" section of the renderer system prompt and the anti-default guidance in the prompt writer, both in `extension/content.js`.
- Modifications: the guidance was condensed and adapted to a renderer that rebuilds existing pages.

## Fonts

The panel and agent cursors use three fonts, bundled in `extension/fonts/` as Latin-subset WOFF2 files downloaded from [Fontsource](https://fontsource.org/). All three are under the SIL Open Font License 1.1.

- [Inter](https://github.com/rsms/inter) (`inter.woff2`, variable weight). See `inter-OFL.txt`.
- [Instrument Serif](https://github.com/Instrument/instrument-serif) (`instrument-serif.woff2`, `instrument-serif-italic.woff2`). See `instrument-serif-OFL.txt`.
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (`jetbrains-mono.woff2`, variable weight). See `jetbrains-mono-OFL.txt`.

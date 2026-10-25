# Remodel

**Give any website a new look with one sentence.**

Remodel is a Chrome extension. Open a website, type the style you want (for example "cyberpunk" or "neo-brutalist magazine"), and Remodel redesigns the page for you. The site keeps working: links, search, logins and forms still do what they did before.

## Demo videos

| | |
|---|---|
| [![python.org reskin](https://img.youtube.com/vi/dNEG0L8O_Oc/hqdefault.jpg)](https://youtu.be/dNEG0L8O_Oc) [python.org, pink neo-brutalist reskin](https://youtu.be/dNEG0L8O_Oc) | [![GitHub neon reskin](https://img.youtube.com/vi/Xa5lt1BeMjs/hqdefault.jpg)](https://youtu.be/Xa5lt1BeMjs) [GitHub, neon reskin](https://youtu.be/Xa5lt1BeMjs) |
| [![Apple Wikipedia rebuild](https://img.youtube.com/vi/PlnK9Iw7WgI/hqdefault.jpg)](https://youtu.be/PlnK9Iw7WgI) [Wikipedia's Apple article, rebuilt](https://youtu.be/PlnK9Iw7WgI) | [![Cyberpunk redesign](https://img.youtube.com/vi/-1QaEpzxPYg/hqdefault.jpg)](https://youtu.be/-1QaEpzxPYg) [Cyberpunk redesign](https://youtu.be/-1QaEpzxPYg) |

## Before and after

**GitHub, "cyberpunk / futuristic"**: the layout stays the same, and the colours, fonts and shapes change.

| Before | After |
|---|---|
| ![GitHub before](docs/media/github-before.png) | ![GitHub after, cyberpunk](docs/media/github-after-cyberpunk.png) |

**Wikipedia's Apple Inc. article, rebuilt**: the whole page gets a new layout, in a clean Apple-keynote style.

| Before | After |
|---|---|
| ![Wikipedia before](docs/media/apple-wikipedia-before.png) | ![Wikipedia after](docs/media/apple-wikipedia-after.png) |

**Hacker News, as a retro desktop**: the same live stories, inside a 90s-style computer window.

| Before | After |
|---|---|
| ![Hacker News before](docs/media/hackernews-before.png) | ![Hacker News after, retro desktop](docs/media/hackernews-after-windows95.png) |

## Two ways to remodel

- **Reskin** (most websites): keeps the page exactly where it is and repaints it with new colours, fonts, rounded or sharp corners, and shadows. It takes about 10 seconds, and nothing on the page moves or breaks.
- **Rebuild** (Wikipedia, Hacker News, IRCTC train search): designs a brand-new page from the content, with its own layout and scroll animations. On IRCTC, the new booking form still searches real trains.

## Other things it does

- **Suggest prompts:** not sure what to type? Remodel looks at the page and suggests three styles.
- **Reuse a style:** a style you made on one site applies instantly on another.
- **Before / after switch:** press `Alt+R` to flip between the original and the new design.
- **Remix a section:** on Wikipedia, hover over any section and restyle just that part.
- **Watch it work:** while it designs, five little cursors visibly edit the page, retyping headings, moving blocks and picking colours.
- **Self-check:** after a rebuild, the AI looks at a screenshot of its own result and fixes obvious mistakes.

## Try it

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `extension` folder.
3. Open any website and click the **✦ Remodel** button in the bottom-right corner (or press `Alt+Shift+M`).
4. Paste your OpenAI API key. It stays in your browser.
5. Type a style and press **Reskin this page** (or **Remodel this page** on Wikipedia, Hacker News and IRCTC).

## Good to know

- Pictures and logos keep their original colours.
- On IRCTC, Remodel stops at train search. Login, booking and payment happen on the real IRCTC site.

## More docs

- [How AI was used to build this](AI_USAGE.md)
- [What it does and its limits](docs/PRODUCT.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Change log](CHANGELOG.md): everything that was built, in order
- [Technical contracts](CONTRACTS.md): data shapes and messages, for developers
- [Credits for design data and fonts](third_party/NOTICES.md)

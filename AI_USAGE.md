# AI usage

This is a summary of the AI tools used while building Remodel, grouped from the commit history. It is not a transcript of every prompt. Times are IST.

The extension itself also calls the OpenAI Responses API at runtime (`gpt-5.4-mini` in the recorded runs) to write a theme or a page, suggest prompts, and review a screenshot. That key stays in the browser and is not in this repository.

| Time (IST) | Tool | Task | Human review or changes |
| --- | --- | --- | --- |
| 24 Oct, about 21:15–22:50 | Devin | Scaffolded an earlier project (Syntune): planning docs, a Vite app, and the first feature cards. Branch names from that stretch start with `devin/`. | That project was dropped. At 00:41 the repo was reset and Remodel replaced it. None of that code is in the demo. |
| 25 Oct, 00:41–01:36 | Cursor | Pivoted the repo to the Remodel extension. Added Wikipedia extraction and chapter remixing, scroll motion, and a visual review that screenshots the result and asks the model to fix layout mistakes. | Checked against the live Apple Inc. Wikipedia article. The review caught an empty image frame and the renderer was replaced. |
| 25 Oct, about 01:36–03:47 | Cursor | Added the IRCTC train-search bridge, then generic-site extraction, design reference data, prompt suggestions, and guards so small images are not blown up. | IRCTC was checked against a local stand-in of the booking form. The live site blocks automated browsers. Generic flow was run on books.toscrape.com, BBC News, GitHub Trending, and python.org. |
| 25 Oct, 03:53–04:18 | Cursor | Made the five agent cursors visibly retype, resize, repaint, measure, and edit, and redesigned the panel (bundled fonts, light and dark themes, a layout that fits a narrow window). | Cursor tests confirmed the page DOM is unchanged and the panel fits light, dark, and a 390 px width. |
| 25 Oct, 05:01 | Cursor | Added Reskin as the default for ordinary websites: new colours, fonts, and surfaces, with the layout left in place. Wikipedia, Hacker News, and IRCTC still use their custom rebuilds. | Chose Reskin over making every site a full rebuild, after generic rebuilds kept breaking layouts. Measured on books.toscrape.com, python.org, quotes.toscrape.com, and GitHub. |
| 25 Oct, 05:09 | Cursor | Stopped GitHub's single-key shortcuts from stealing letters typed into the open panel. | Reported the bug while typing in the panel on GitHub. A script then typed those same keys and confirmed GitHub did not react. |
| 25 Oct, 05:17–06:07 | Cursor | Rewrote the README in plain language, added the before/after screenshots and the four demo videos, and filled this file. | Picked the screenshots, including the retro Hacker News desktop and the clean Apple article. Recorded the videos, chose the links, and asked for plain links with a one-line description each. |

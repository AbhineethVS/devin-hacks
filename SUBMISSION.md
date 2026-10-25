# Submission checklist

## Project

- **Name:** Remodel
- **One-line description:** Give any website a new look with one sentence.
- **Track:** Make Room for Play. Remodel is something you open on a page to experience a new look, not a task it finishes for you.
- **Repository URL:** https://github.com/AbhineethVS/devin-hacks
- **Demo videos:**
  - [python.org, pink neo-brutalist reskin](https://youtu.be/dNEG0L8O_Oc). Same page, repainted in loud pink with thick borders and heavy type.
  - [GitHub, neon reskin](https://youtu.be/Xa5lt1BeMjs). GitHub stays put. The colours and type turn neon.
  - [Wikipedia's Apple article, rebuilt](https://youtu.be/PlnK9Iw7WgI). The article gets a new layout, in a clean Apple-keynote style.
  - [Cyberpunk redesign](https://youtu.be/-1QaEpzxPYg). A page redesigned in a dark, neon Cyberpunk 2077 look.

## Verification

- [x] Setup instructions are accurate. Load the `extension` folder unpacked, open a page, click ✦ Remodel (bottom-right) or press Alt+Shift+M, paste an OpenAI key, then Reskin or Remodel.
- [x] Demo flow works from a clean install. The unpacked extension was run in fresh Chrome profiles on python.org, books.toscrape.com, GitHub, and the live IRCTC train search.
- [x] No secrets or generated browser profiles are committed. `.env` and the Chrome profiles under `out/` are gitignored.
- [x] Known limitations are documented. Pictures and logos keep their colours. On IRCTC, Remodel stops at train search.
- [x] Final submitted commit SHA: `7eba35e308282353ab98ec9c497e7c6a4ab6974a`

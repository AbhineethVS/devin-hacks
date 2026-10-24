---
name: github-file-loading
description: How Syntune loads source files from GitHub URLs (files, folders, repos) without hitting rate limits, plus the Famous Code shelf. Read this before touching src/github/.
---

# Loading code from GitHub

## Accepted inputs
- File page: `https://github.com/{owner}/{repo}/blob/{ref}/{path}` → raw: `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`
- Raw URL: use as-is.
- Repo or folder: `https://github.com/{owner}/{repo}[/tree/{ref}/{path}]` → list files with `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}?recursive=1`
  - **One request** for the whole tree. Filter to code extensions, sort by path, show a searchable picker.
  - If `{ref}` is missing, get `default_branch` from `GET /repos/{owner}/{repo}` (one more request).

## Rate limits
- Unauthenticated API: **60 requests/hour per IP.** At a hackathon on shared Wi-Fi, assume it's already partly used.
- **Raw file fetches do not count** against the API limit. Prefer raw whenever a file path is known.
- Cache tree listings and file contents in `sessionStorage`.
- On a 403 rate-limit response, show: "GitHub rate limit hit. Paste a direct file link instead."

## Size limits
- Skip files over 200 KB. Play file uses the first 400 lines (see code-tokenizing).
- Binary and lockfiles are excluded by extension.

## Famous Code shelf (preset buttons; verify each URL loads on the night)
- Apollo 11 AGC (`chrislgarry/Apollo-11`): a short `.agc` file
- Quake III `q_math.c` (`id-Software/Quake-III-Arena`): fast inverse square root
- Doom `m_random.c` (`id-Software/DOOM`)
- A tiny Linux kernel file (`torvalds/linux`)

**Store the raw URLs as constants. If the network fails, fall back to a bundled copy** of each file in `public/famous/` (check the licences: Doom and Quake are GPL, Apollo is public domain; keep the attribution headers).

## Tests
URL parsing unit tests for blob, raw, tree and repo-root URLs. Bad URL → helpful error.

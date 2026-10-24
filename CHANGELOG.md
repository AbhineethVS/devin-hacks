# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

No project implementation has been recorded yet. Replace this sentence with entries as you build:

```text
## <actual timestamp> — <short change title>

- Changed: <feature or files changed>
- Why: <reason for the change>
- Validation: <commands or manual checks actually run, with results>
- Limitations: <known issues or "None identified in these checks">
```

## 2026-10-24T15:55:11+05:30 — Rename event to Devin Hacks and AI tool to Devin

- Changed: Replaced the "DevDay Exchange Community Hackathon: Kochi" title with "Devin Hacks", and the Codex workflow references with Devin, in `README.md`, `RULES.md`, `AGENTS.md`, `AI_USAGE.md`, `SUBMISSION.md`, and `.github/pull_request_template.md`.
- Why: The team is entering Devin Hacks and will use Devin as its AI coding tool.
- Validation: Searched the repository for remaining "Codex" and "DevDay" mentions and reviewed the diff.
- Limitations: The venue, dates, Luma link, and credits lines (Codex/OpenAI credits) still describe the original event, and need confirming against the Devin Hacks announcement. The historical template-preparation note in `AI_USAGE.md` still credits Codex, which is accurate.

## Template setup — 10 October 2026

- Changed: Added the event README, rules, agent guide, change log, AI usage record, submission checklist, Git ignore rules, and pull request checklist.
- Why: Give participants a consistent starting point for event rules, basic coding patterns, documented changes, and regular commits.
- Validation: Checked local Markdown links, event detail consistency, required documents, and diff whitespace before publishing.
- Limitations: Documentation scaffolding only; no participant project, application, or working demo is included. GitHub publication and template status are verified separately after creation.

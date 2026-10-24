# Product brief

## One-liner

Redesign and rewrite any website with a single prompt.

## Problem

The web is delivered as a fixed interface even though different people, tasks, and moments need different presentations. Existing extensions mostly recolour pages or hide elements; they do not rebuild the information architecture into a coherent new experience.

## Demo promise

Give Remodel a creative direction and watch the public IRCTC homepage become a calm journey planner without losing the real booking workflow. Search for a train through the redesign, then show the same engine turning Wikipedia into a cinematic, scroll-driven story.

## Must have

- The embedded AI has freedom to author layout, components, typography, colour, and interactions.
- Generated renderers are reusable across pages with the same content schema.
- AI-authored code runs in an MV3 sandbox without extension APIs.
- Links, search, original/remodel toggle, caching, and reset remain functional.
- Public IRCTC train search preserves station autocomplete, journey date, class, quota, and submission.
- Every Wikipedia chapter remains present and individually remixable.
- Motion is smooth, purposeful, and disabled when the user prefers reduced motion.

## Out of scope

- IRCTC login, captcha, passenger details, booking, and payment.
- Accounts, collaboration, or cloud persistence during the hackathon prototype.
- Executing generated code outside the browser sandbox.

## Current supported scope

- Specialised, high-fidelity support for the public IRCTC train-search homepage, Wikipedia articles, Hacker News lists, and Hacker News discussions.
- Best-effort support for any other website through the generic extractor.
  - Pages are classed as `article`, `listing`, `form` or `landing`.
  - Renderers are reused across websites of the same archetype and style, with each site's own branding.

## Known limitations of generic mode

- Content inside canvas, iframes, shadow DOM, or behind a login is not extracted.
- Card detection and archetype guesses are heuristic. A landing page with a long logo strip can be classed as a listing.
- Form fields are forwarded to the real page as plain values. Custom widgets, such as date pickers or autocompletes, may not accept them.
- Radio buttons and file inputs are not extracted.
- Large photos are not size-capped: a renderer can still stretch a 460 px photo to full width, which looks soft.
- Screenshots made with full-page capture tools mix the fixed redesign overlay with the original page underneath. Record the demo with normal screen capture.
- Pages with fewer than about 160 characters of extractable text fail validation.

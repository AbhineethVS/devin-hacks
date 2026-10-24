// Orchestrates a redesign: panel → extract → generate a renderer → render in the sandbox → bridge → cache.

(() => {
  if (window.top !== window || window.__remodelLoaded) return;
  window.__remodelLoaded = true;
  const X = window.RemodelExtract;
  const C = window.RemodelCursors;
  let booted = false;

  function boot(page) {
  // Generic renderers are keyed by archetype and style, not by site, so they are reused across websites.
  let rendererKey = page.generic ? "" : `renderer:${page.type}`;
  const SITE_KEY = `site:${page.site}`;
  const MODELS = ["gpt-6-luna", "gpt-5.4-mini", "gpt-6.1-sol", "gpt-6-astra", "gpt-5.5"];
  const PRESETS = ["Cinematic scroll story", "Graphic novel", "Museum exhibition", "Neo-brutalist", "Apple keynote", "90s Malayalam movie poster"];

  const SYSTEM = `You are an award-winning interactive art director and senior front-end engineer. You completely REBUILD web pages: new information architecture, new layout, original components, typography, colour, and motion. The original design must be unrecognisable, while all the real content stays.

You don't write a page. You write a RENDERER: JavaScript that turns content JSON into a page, so the same design works for every page of this type on the site.

OUTPUT FORMAT: exactly one \`\`\`js code block and nothing else. It must define:
  /* THESIS: ... */             // FIRST, at most 8 short lines: concept, palette roles, type pairing, recurring motifs, section order, motion idea. The code must follow it.
  const STYLE = \`...\`;          // all CSS. May start with @import of Google Fonts (fonts.googleapis.com). Scope every selector under #rm.
  function render(data) {...}   // returns ONE HTML string for the entire page. Pure function, no DOM access.
  function mount(root) {...}    // optional: small enhancements (scroll-spy, reveal-on-scroll, tabs, collapsibles). No network.

RULES
- Use esc(value) for every plain-text field. Fields named html, and list items, are pre-sanitized HTML: insert them as-is.
- Be generic: loop over arrays, never hard-code content from the sample, handle null/empty fields and long arrays (40 sections, 200 comments) gracefully.
- Links: ordinary <a href="..."> using URLs from the data; in-page anchors (#id) are fine. The host handles navigation.
- Search: <form data-search><input name="q" placeholder="..."></form>.
- Design the WHOLE page top to bottom for desktop widths (1280–1600px), responsive down to tablet.
- Make it authored, not AI-template-like: establish one strong visual thesis and repeat a small set of motifs deliberately. Avoid generic gradient blobs, excessive rounded cards, random glassmorphism, and a dashboard grid unless the content calls for it.
- Invent components that fit the subject: chapter openers, timelines, annotated galleries, stat rails, archival labels, pull quotes, maps, dossiers, sticky table of contents, or entirely new forms.
- For Wikipedia, every rendered article section MUST have id="<section.id>", data-rm-section="<section.id>" and data-rm-title="<section.title>". Keep every section, even if some are visually condensed.
- GENERIC PAGES (data.generic is true) can come from ANY website and were extracted automatically, so content is uneven. The renderer is cached and REUSED on other websites with the same archetype, so never hard-code names, text, colours or URLs from the sample. Take identity from data.brand: show brand.name, and brand.logo when present. Use var(--brand-primary, <fallback>) and var(--brand-accent, <fallback>) for identity accents; the host sets them from the real site and they may be unset. The style request decides everything else. Skip empty blocks gracefully and render untitled sections (title ""). Many cards have image: null or text: []; when an image is null, render NO image frame or placeholder box for it and let the card become a compact text card, so a list without images never shows empty frames. data.stats, data.archetype and section wordCount are layout hints, not content: don't display them. Never print invented labels such as "Untitled"; an untitled section simply has no heading. Never show raw URLs as visible text; use them only in href. NO META COPY: never write text about the redesign, the renderer, the style or the layout (e.g. "a graphic-novel frame for listings", "reusable renderer", "ink-ready"), never add empty placeholder panels like "Panel one", and never add filler tag chips. Every visible word comes from the data, except functional UI labels (Search, Menu, Next) and the one sticker. If a slot has no data, drop the slot. RESPECT IMAGE SCALE: image blocks carry their original w, h and role. Only "hero" and "photo" images may be shown large; "icon" and "thumb" images stay close to w (at most 1.5×). An icons block is a wrapped inline row of small images (badges, logos, avatars) at about its size. Cards whose imageRole is "icon" show the image as a small avatar or logo, never as a cover. The host runtime forcibly shrinks small images that are blown up, which leaves awkward gaps, so size them correctly from the start. Every section gets id, data-rm-section and data-rm-title. Follow the CONTROLS CONTRACT in the schema exactly so forms, buttons and search keep working.
- MOTION TOOLKIT. The host runtime implements these attributes smoothly and switches them off for reduced-motion users. Prefer them over hand-written scroll code:
  data-rm-reveal="up|down|left|right|scale|mask|blur"  entrance when the element scrolls into view
  data-rm-stagger="up|..."  on a container: its children enter one after another (lists, timelines, galleries)
  data-rm-scrub="zoom|rise|drift|fade|unmask"  tied to scroll position; ideal for hero and chapter images inside overflow:hidden frames
  data-rm-parallax="0.05..0.35"  depth for decorative or image layers
  data-rm-count  on an element whose text is a statistic: the number counts up once (never on years)
  data-rm-progress  receives --rm-progress (0..1 for the whole page), e.g. a reading-progress bar
  Every [data-rm-section] receives --rm-section-progress (0..1) and data-rm-active while it is the current chapter. Links to "#<section.id>" get class rm-active and aria-current. Elements with data-rm-chapter-label display the current chapter title (great in a sticky header). Smooth anchor scrolling is built in.
  Scrub and parallax use the CSS translate and scale properties, so don't put them on elements whose own transform matters. Use motion with intent: a few memorable moments beat animating everything.
- Add tasteful micro-interactions in CSS: link underline sweeps, image zoom inside frames on hover, button press states, visible focus rings. Keep them between 150ms and 400ms. mount(root) remains available for custom interactions such as tabs or timelines.
- Use the data's images generously (object-fit, aspect-ratio). Images can fail to load: the layout must not depend on them.
- Body copy stays readable: max ~70ch line length.
- Include one small witty sticker or badge that fits the style and the site.
- Make keyboard focus visible. Motion must not be required to understand content.
- No external scripts, no fetch/XHR, no iframes, no alert(). Keep the code under ~600 lines.

DESIGN JUDGEMENT (adapted from Anthropic's frontend-design skill, Apache-2.0)
- Ground the design in the subject: its industry, materials, vernacular and audience are where distinctive choices come from. Open the hero with the most characteristic thing in that world. A big number with a small label and a gradient accent is the default treatment; use it only if it is truly best.
- Typography carries the personality: one or two families, clearly distinct if two, chosen for this brief rather than your usual defaults, on a deliberate type scale. Body lines under ~75ch; serif body gets a little more line-height.
- Structure is information: borders, numbering, eyebrows, dividers and labels must encode something real. Use 01/02/03 markers only for true sequences.
- Avoid the commonest tells of generated pages unless the style request asks for them: accenting a single headline word in another colour or italic; tracked-out ALL-CAPS eyebrow labels above every heading; meta strings joined with middle dots; a spaced em dash in labels; '→' appended to every link; a monospace face for small labels; content chopped into identical rounded cards with one radius and the same soft grey shadow; decorative gradient washes; a cream (#F4F1EA) plus terracotta (#D97757) palette; a near-black with one acid-green accent; broadsheet hairline rules everywhere.
- Spend boldness in one place: one memorable element, everything around it quiet and disciplined. Before finishing, remove one accessory.
- Motion: one orchestrated moment (a page-load sequence or one signature reveal) beats fade-and-slide on every section and hover effects on every card. Motion that answers a user's action is welcome.
- Copy you add (labels, buttons, empty states) is plain, specific, active and in sentence case. The sticker is the one place for wit.
- In the THESIS, add a line "AVOIDED: ..." naming the generic default you deliberately rejected for this brief.
- Watch CSS specificity: type and element selectors cancelling each other out is a common source of broken spacing.

When a DESIGN REFERENCE section is provided, it comes from a curated design library (UI UX Pro Max). Use whatever fits as concrete grounding for palette, fonts, page pattern and UX rules. The style request always wins, and the library never overrides content or contracts.`;

  // ---------- small helpers ----------
  const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn, { once: true }) : fn());
  const extractCode = (text) => {
    const m = text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/);
    return (m ? m[1] : text).trim();
  };
  const extractStyle = (code) => (code.match(/const\s+STYLE\s*=\s*`([\s\S]*?)`\s*;/) || [])[1]?.slice(0, 5000) || "";
  const extractThesis = (code) => (code.match(/\/\*\s*THESIS:?([\s\S]*?)\*\//) || [])[1]?.trim().slice(0, 1500) || "";
  const promptHash = (s) => {
    let h = 5381;
    for (const c of s.trim().toLowerCase()) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return (h >>> 0).toString(36);
  };
  const genericKey = (archetype, prompt) => `renderer:generic:${archetype}:${promptHash(prompt)}`;
  const rendererRecord = (code, prompt, model, extra = {}) => ({
    code, prompt, model, style: extractStyle(code), thesis: extractThesis(code),
    host: location.hostname, archetype: currentData?.archetype || null, created: Date.now(), ...extra,
  });
  const pageLoaded = () => new Promise((resolve) => {
    if (document.readyState === "complete") return setTimeout(resolve, 300);
    addEventListener("load", () => setTimeout(resolve, 300), { once: true });
    setTimeout(resolve, 5000);
  });

  // ---------- cover (prevents a flash of the original page on auto-apply) ----------
  let cover = null;
  function showCover() {
    cover = document.createElement("div");
    cover.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:#fff;display:grid;place-items:center;font:600 14px system-ui;color:#999";
    cover.textContent = "✦ Remodel";
    document.documentElement.append(cover);
  }
  const removeCover = () => { cover?.remove(); cover = null; };

  // ---------- overlay iframe (sandboxed renderer) ----------
  let overlay = null;
  let overlayReady = null;
  let pendingRender = null;
  let overlayVisible = false;
  let currentData = null;

  function ensureOverlay() {
    if (overlay) return overlayReady;
    overlay = document.createElement("iframe");
    overlay.src = chrome.runtime.getURL("sandbox.html");
    overlay.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646;background:#fff;opacity:0;pointer-events:none;transition:opacity .6s ease;";
    overlayReady = new Promise((resolve) => (overlay._ready = resolve));
    document.documentElement.append(overlay);
    return overlayReady;
  }

  async function render(code, data, options = {}) {
    currentData = data;
    await ensureOverlay();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Render timed out")), 10000);
      pendingRender = { resolve: () => { clearTimeout(timer); resolve(); }, reject: (e) => { clearTimeout(timer); reject(e); } };
      overlay.contentWindow.postMessage({ type: "render", code, data, options }, "*");
    });
  }

  // Request/response calls into the sandbox (audit and capture controls).
  let callSeq = 0;
  const calls = new Map();
  function sandboxCall(msg, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const id = ++callSeq;
      const timer = setTimeout(() => {
        calls.delete(id);
        reject(new Error(`${msg.type} timed out`));
      }, timeout);
      calls.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      overlay.contentWindow.postMessage({ ...msg, id }, "*");
    });
  }

  function setOverlay(visible) {
    if (!overlay) return;
    overlayVisible = visible;
    overlay.style.opacity = visible ? "1" : "0";
    overlay.style.pointerEvents = visible ? "auto" : "none";
    document.documentElement.style.overflow = visible ? "hidden" : "";
    if (visible) removeCover();
    panel.updateToggle();
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function extractPageData() {
    if (page.site === "irctc") {
      const ready = () => document.querySelector(
        'input[placeholder^="From" i], p-autocomplete#origin input, input[aria-label^="From" i], input[formcontrolname*="origin" i], input[name*="origin" i]'
      );
      for (let i = 0; i < 450 && !ready(); i++) {
        if (i === 20) panel.status("Waiting for IRCTC’s booking form to load…");
        await wait(100);
      }
      if (!ready()) {
        const blocked = /powered and protected|access denied|captcha/i.test(document.body?.innerText || "");
        throw new Error(blocked
          ? "IRCTC showed a security check instead of the booking form. Complete it, then try again."
          : "Could not detect IRCTC’s booking form. Reload the page and try once more.");
      }
    }
    return X.extract(page.type);
  }
  const boundElement = (id) => {
    if (typeof id !== "string" || !/^rm-\d+$/.test(id)) return null;
    return document.querySelector(`[data-rm-id="${CSS.escape(id)}"]`);
  };
  function nativeSet(el, property, value) {
    let proto = el;
    let setter = null;
    while ((proto = Object.getPrototypeOf(proto)) && !setter) {
      setter = Object.getOwnPropertyDescriptor(proto, property)?.set;
    }
    if (setter) setter.call(el, value);
    else el[property] = value;
  }
  function notifyControl(el, kind = "input") {
    el.dispatchEvent(new Event(kind, { bubbles: true }));
  }
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const postBoundStatus = (text, isError = false) => overlay?.contentWindow?.postMessage({ type: "bound-status", text, isError }, "*");
  const visibleChoice = (item) => {
    const style = getComputedStyle(item);
    const rect = item.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && normalize(item.textContent);
  };

  async function selectDropdown(el, value) {
    const wanted = normalize(value);
    const opener = el.querySelector(".ui-dropdown, .p-dropdown, [role=button], .ui-dropdown-trigger, .p-dropdown-trigger") || el;
    opener.click();
    let choices = [];
    for (let i = 0; i < 12 && !choices.length; i++) {
      await wait(100);
      choices = [...document.querySelectorAll('[role="option"], .ui-dropdown-item, .p-dropdown-item')].filter(visibleChoice);
    }
    const choice = choices.find((item) => normalize(item.textContent) === wanted)
      || choices.find((item) => normalize(item.textContent).includes(wanted));
    if (!choice) throw new Error(`Could not select “${value}” on the original page.`);
    choice.click();
    await wait(80);
  }

  async function selectStation(el) {
    if (!el || !/From|To/i.test(`${el.placeholder || ""} ${el.getAttribute("aria-label") || ""}`)) return;
    el.focus();
    notifyControl(el, "input");
    const value = normalize(el.value).split(" - ")[0];
    let choices = [];
    for (let i = 0; i < 20 && !choices.length; i++) {
      await wait(100);
      choices = [...document.querySelectorAll('ul[role="listbox"] li, [role="option"], p-autocompleteitem li')].filter(visibleChoice);
    }
    const choice = choices.find((item) => normalize(item.textContent).startsWith(value))
      || choices.find((item) => normalize(item.textContent).includes(value))
      || choices[0];
    if (!choice) throw new Error(`Choose a valid station for ${(el.placeholder || el.getAttribute("aria-label") || "station").replace("*", "")}.`);
    choice.click();
    await wait(120);
  }

  async function updateBoundControl(msg) {
    const el = boundElement(msg.id);
    if (!el) return;
    try {
      if (el.matches("p-dropdown, .ui-dropdown, .p-dropdown")) {
        if (msg.event === "change") await selectDropdown(el, msg.value);
        return;
      }
      if (el.tagName === "SELECT") {
        const wanted = normalize(msg.value);
        const option = [...el.options].find((o) => o.value === msg.value) || [...el.options].find((o) => normalize(o.text) === wanted);
        if (option) {
          nativeSet(el, "value", option.value);
          notifyControl(el, "input");
          notifyControl(el, "change");
        }
        return;
      }
      if (el.matches('input[type="checkbox"], input[type="radio"]')) {
        nativeSet(el, "checked", Boolean(msg.checked));
        notifyControl(el, "input");
        notifyControl(el, "change");
        return;
      }
      if ("value" in el) {
        nativeSet(el, "value", String(msg.value ?? ""));
        if (page.site === "irctc" && /From|To/i.test(`${el.placeholder || ""} ${el.getAttribute("aria-label") || ""}`)) {
          el.focus();
          el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: msg.key || "Unidentified" }));
        }
        notifyControl(el, "input");
        if (msg.event === "change") notifyControl(el, "change");
      }
    } catch (err) {
      postBoundStatus(err.message, true);
    }
  }

  // Single-page apps update in place after a click or submit: wait for the DOM to settle, then
  // re-extract and re-render with the same renderer. Full navigations simply unload this script.
  let refreshRun = 0;
  async function refreshAfterAction() {
    if (!page.generic || !currentCode) return;
    const run = ++refreshRun;
    await new Promise((resolve) => {
      let quiet = setTimeout(done, 900);
      const cap = setTimeout(done, 6000);
      const observer = new MutationObserver(() => {
        clearTimeout(quiet);
        quiet = setTimeout(done, 700);
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      function done() {
        observer.disconnect();
        clearTimeout(quiet);
        clearTimeout(cap);
        resolve();
      }
    });
    if (run !== refreshRun || !overlayVisible) return;
    try {
      await render(currentCode, await extractPageData(), { keepScroll: true });
    } catch (err) {
      panel.status(`Could not refresh the redesign: ${err.message.split("\n")[0]}`, true);
    }
  }

  function clickBound(msg) {
    const el = boundElement(msg.id);
    if (!el) return;
    el.click();
    refreshAfterAction();
  }

  function runSearch(q) {
    if (page.site === "wikipedia") return (location.href = `${location.origin}/w/index.php?search=${encodeURIComponent(q)}`);
    if (page.site === "hn") return (location.href = `https://hn.algolia.com/?q=${encodeURIComponent(q)}`);
    const input = boundElement(currentData?.search?.inputId);
    if (!input) return (location.href = `https://www.google.com/search?q=${encodeURIComponent(`site:${location.hostname} ${q}`)}`);
    nativeSet(input, "value", q);
    notifyControl(input, "input");
    notifyControl(input, "change");
    if (input.form?.requestSubmit) input.form.requestSubmit();
    else input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter", keyCode: 13 }));
    refreshAfterAction();
  }

  async function submitBoundForm(msg) {
    if (page.generic) {
      try {
        for (const field of msg.fields || []) await updateBoundControl({ ...field, event: "change" });
        const submit = boundElement(msg.submitId);
        const form = boundElement(msg.form);
        if (submit) submit.click();
        else if (form?.requestSubmit) form.requestSubmit();
        else throw new Error("The original form is no longer on the page.");
        postBoundStatus("Sent to the site…");
        refreshAfterAction();
      } catch (err) {
        postBoundStatus(err.message, true);
      }
      return;
    }
    if (page.site !== "irctc") return;
    try {
      postBoundStatus("Checking stations…");
      for (const id of msg.stationIds || []) await selectStation(boundElement(id));
      for (const field of msg.fields || []) {
        const el = boundElement(field.id);
        if (el && !/From|To/i.test(`${el.placeholder || ""} ${el.getAttribute("aria-label") || ""}`)) {
          await updateBoundControl({ ...field, event: "change" });
        }
      }
      const submit = boundElement(msg.submitId);
      if (!submit) throw new Error("The original Find Trains button is unavailable.");
      postBoundStatus("Opening IRCTC train results…");
      await wait(120);
      setOverlay(false);
      submit.click();
    } catch (err) {
      postBoundStatus(err.message, true);
    }
  }

  window.addEventListener("message", (event) => {
    if (!overlay || event.source !== overlay.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.source !== "remodel-sandbox") return;
    if (msg.type === "ready") overlay._ready();
    else if (msg.type === "rendered") pendingRender?.resolve();
    else if (msg.type === "render-error") pendingRender?.reject(new Error(msg.message));
    else if (msg.type === "reply") {
      const call = calls.get(msg.id);
      if (!call) return;
      calls.delete(msg.id);
      if (msg.error) call.reject(new Error(msg.error));
      else call.resolve(msg.result);
    }
    else if (msg.type === "toggle") setOverlay(!overlayVisible);
    else if (msg.type === "select-section") panel.openRemix(msg.section);
    else if (msg.type === "bound-input") updateBoundControl(msg);
    else if (msg.type === "bound-submit") submitBoundForm(msg);
    else if (msg.type === "bound-click") clickBound(msg);
    else if (msg.type === "navigate") {
      if (msg.newTab) window.open(msg.href, "_blank");
      else location.href = msg.href;
    } else if (msg.type === "search") runSearch(String(msg.q || ""));
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "r" && overlay) {
      event.preventDefault();
      setOverlay(!overlayVisible);
    }
  }, true);

  // ---------- model streaming ----------
  // options.ctl receives a cancel() that aborts the request and rejects the promise.
  function stream(system, user, model, onDelta, options = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: "generate" });
      const ping = setInterval(() => port.postMessage({ type: "ping" }), 20000);
      const finish = () => {
        clearInterval(ping);
        try { port.disconnect(); } catch {}
      };
      if (options.ctl) options.ctl.cancel = () => { finish(); reject(new Error("cancelled")); };
      port.onMessage.addListener((msg) => {
        if (msg.type === "delta") onDelta(msg);
        else if (msg.type === "note") options.onNote?.(msg.text);
        else if (msg.type === "done") { finish(); resolve(msg.text); }
        else if (msg.type === "error") { finish(); reject(new Error(msg.message)); }
      });
      port.postMessage({ type: "generate", system, user, model, images: options.images, effort: options.effort, maxTokens: options.maxTokens, tools: options.tools });
    });
  }

  const siteSummary = (data) => [data.site, data.brand?.name, data.title || data.pageTitle || data.story?.title, data.description, data.archetype, page.type].filter(Boolean).join(" ");
  async function designReference(stylePrompt, data) {
    try {
      const res = await chrome.runtime.sendMessage({ type: "design-ref", style: stylePrompt, site: siteSummary(data) });
      return res?.text || "";
    } catch {
      return "";
    }
  }

  function userPrompt(stylePrompt, data, sibling, designRef = "") {
    let s = `STYLE REQUEST: "${stylePrompt}"
PAGE TYPE: ${page.type}

DATA SCHEMA:
${X.schema(page.type)}

SAMPLE DATA (trimmed; real pages are longer):
${JSON.stringify(X.sample(data, page.type), null, 1)}`;
    if (page.site === "irctc") {
      s += `\n\nThe original IRCTC viewport is attached as an image. Use it only to understand brand and page hierarchy; the JSON is the source of truth for content and controls.`;
    }
    if (page.generic) {
      s += `

ARCHETYPE: ${data.archetype}. "outline" in the sample lists every section and its block types; the real page has all of them.
Screenshots of the original page (top, then mid-page) are attached. Use them to understand what the site is for, its brand and what matters most; the JSON is the source of truth.
This renderer will be reused on OTHER ${data.archetype} pages from other websites in the same style, so keep it fully data-driven.`;
    }
    if (sibling?.style) {
      s += `

DESIGN SYSTEM TO MATCH: another page type in this style already uses the design below. Reuse its fonts, colours and component language so everything feels like one product.
${sibling.thesis ? `THESIS:\n${sibling.thesis}\n\n` : ""}${sibling.style}`;
    }
    if (designRef) s += `\n\nDESIGN REFERENCE (UI UX Pro Max library matches for this request and site):\n${designRef}`;
    return s;
  }

  function remixPrompt(basePrompt, instruction, section, data, previousCode) {
    return `${userPrompt(basePrompt, data)}

FOCUSED REMIX REQUEST
The user selected section "${section.title}" (id: ${section.id}) and asked:
"${instruction}"

Revise the WHOLE renderer so this section receives that transformation while the rest of the design remains coherent. Preserve every data field and all other sections. The selected section must still use data-rm-section="${section.id}".

CURRENT RENDERER:
\`\`\`js
${previousCode}
\`\`\`

Return the complete revised renderer, not a patch.`;
  }

  // ---------- visual review: screenshot the result, let the model judge it, repair once ----------
  const REVIEW_SYSTEM = `You are a meticulous design QA lead. You receive screenshots of an AI-generated redesign of a web page, captured top to bottom (they sample a long page, so gaps between them are normal), plus findings from automated checks.

Report only real defects a visitor would notice. Do not criticise choices the style request asked for.
- high: text that talks about the redesign itself instead of the site's content (e.g. "a graphic-novel frame for listings"), empty placeholder panels, icons, badges, logos or avatars blown up far beyond their natural size (pixelated, or stacked one per row filling the width), overlapping or illegible text, content cut off or hidden, empty or placeholder content, stray debugging text, elements escaping their containers, huge accidental blank regions, a layout that is clearly broken.
- medium: weak contrast, cramped or uneven spacing, misalignment, awkward image crops, elements that look unintended.
- low: matters of taste.

Return ONLY JSON, no prose:
{"verdict":"pass"|"fix","issues":[{"severity":"high"|"medium"|"low","where":"short location","problem":"what is wrong","fix":"how to fix it in CSS/HTML"}]}
Use "fix" only when there is at least one high issue or two or more medium issues. At most 8 issues.`;

  function reviewPrompt(stylePrompt, data, auditIssues) {
    const automated = auditIssues.length
      ? auditIssues.map((i) => `- [${i.severity}] ${i.where}: ${i.problem}`).join("\n")
      : "- none";
    return `STYLE REQUEST: "${stylePrompt}"
PAGE: ${data.title || data.pageTitle || data.story?.title || page.type}

AUTOMATED CHECK FINDINGS:
${automated}

Review the attached screenshots.`;
  }

  function parseReview(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The reviewer did not return JSON.");
    const review = JSON.parse(match[0]);
    return {
      verdict: review.verdict === "fix" ? "fix" : "pass",
      issues: (Array.isArray(review.issues) ? review.issues : []).slice(0, 8).map((i) => ({
        severity: ["high", "medium", "low"].includes(i.severity) ? i.severity : "medium",
        where: String(i.where || ""),
        problem: String(i.problem || ""),
        fix: String(i.fix || ""),
      })),
    };
  }

  function polishPrompt(stylePrompt, data, code, issues) {
    return `${userPrompt(stylePrompt, data)}

YOUR CURRENT RENDERER:
\`\`\`js
${code}
\`\`\`

A visual QA review of the rendered page found these defects:
${issues.map((i) => `- [${i.severity}] ${i.where}: ${i.problem}${i.fix ? ` Fix: ${i.fix}` : ""}`).join("\n")}

Fix every high and medium defect while keeping the same design direction, all content, and every data-rm hook. Return the complete corrected renderer in one \`\`\`js block.`;
  }

  let reviewRun = 0;
  let reviewCtl = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function cancelReview() {
    reviewRun++;
    reviewCtl?.cancel?.();
    reviewCtl = null;
    panel.setHidden(false);
    panel.toast(null);
  }

  async function captureVisiblePage() {
    panel.setHidden(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const shot = await chrome.runtime.sendMessage({ type: "capture" });
      if (!shot || shot.error) throw new Error(shot?.error || "Screenshot failed.");
      return shot.dataUrl;
    } finally {
      panel.setHidden(false);
    }
  }

  // Top and mid-page views of the ORIGINAL page, so the model sees the brand and the hierarchy.
  async function captureOriginalShots() {
    if (overlayVisible) {
      setOverlay(false);
      await sleep(700);
    }
    removeCover();
    const startY = scrollY;
    const shots = [];
    try {
      scrollTo({ top: 0, behavior: "instant" });
      await sleep(250);
      shots.push(await captureVisiblePage());
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max > innerHeight * 0.8) {
        await sleep(550); // captureVisibleTab allows two calls per second
        scrollTo({ top: Math.round(max * 0.45), behavior: "instant" });
        await sleep(450);
        shots.push(await captureVisiblePage());
      }
    } catch {
      // Screenshots are a hint; generation continues without them.
    } finally {
      scrollTo({ top: startY, behavior: "instant" });
    }
    return shots;
  }

  async function captureShots(run) {
    const { positions } = await sandboxCall({ type: "review-begin" });
    const shots = [];
    try {
      for (const [i, y] of positions.entries()) {
        if (run !== reviewRun || !overlayVisible || document.visibilityState !== "visible") throw new Error("cancelled");
        panel.toast(`AI reviewer · capturing ${i + 1}/${positions.length}`, true);
        await sandboxCall({ type: "review-scroll", y });
        panel.setHidden(true);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const shot = await chrome.runtime.sendMessage({ type: "capture" });
        panel.setHidden(false);
        if (!shot || shot.error) throw new Error(shot?.error || "Screenshot failed.");
        shots.push(shot.dataUrl);
        await sleep(550); // captureVisibleTab allows two calls per second
      }
    } finally {
      panel.setHidden(false);
      await sandboxCall({ type: "review-end" }).catch(() => {});
    }
    return shots;
  }

  async function reviewAndPolish({ code, data, prompt, model }) {
    const run = ++reviewRun;
    const stillCurrent = () => run === reviewRun && currentCode === code;
    try {
      panel.toast("AI reviewer · running layout checks", true);
      const auditIssues = await sandboxCall({ type: "audit" });
      if (!stillCurrent()) return;
      const shots = await captureShots(run);
      if (!stillCurrent()) return;

      panel.toast("AI reviewer · studying the screenshots", true);
      reviewCtl = {};
      const review = parseReview(await stream(REVIEW_SYSTEM, reviewPrompt(prompt, data, auditIssues), model, () => {}, { images: shots, ctl: reviewCtl, maxTokens: 4000 }));
      if (!stillCurrent()) return;

      const mustFix = review.verdict === "fix" || auditIssues.some((i) => i.severity === "high");
      const issues = [...auditIssues, ...review.issues].filter((i) => i.severity !== "low").slice(0, 10);
      if (!mustFix || !issues.length) {
        panel.toast("AI review passed · no layout issues found");
        panel.status("AI review passed: no layout issues found.");
        return;
      }

      panel.toast(`AI reviewer found ${issues.length} issue${issues.length === 1 ? "" : "s"} · polishing`, true);
      reviewCtl = {};
      const fixed = extractCode(await stream(SYSTEM, polishPrompt(prompt, data, code, issues), model, () => {}, { ctl: reviewCtl }));
      if (!stillCurrent()) return;

      try {
        await render(fixed, data, { keepScroll: true });
      } catch (err) {
        await render(code, data, { keepScroll: true }).catch(() => {});
        panel.toast("Polish attempt failed its checks · kept the current design");
        panel.status(`Polish attempt failed: ${err.message.split("\n")[0]}`, true);
        return;
      }
      currentCode = fixed;
      await chrome.storage.local.set({ [rendererKey]: rendererRecord(fixed, prompt, model, { reviewed: true }) });
      panel.toast(`Polished · fixed ${issues.length} issue${issues.length === 1 ? "" : "s"} found by AI review`);
      panel.status(`AI review fixed: ${issues.map((i) => i.problem).join(" · ").slice(0, 400)}`);
    } catch (err) {
      if (err.message === "cancelled" || run !== reviewRun) return;
      panel.toast("AI review skipped");
      panel.status(`AI review skipped: ${err.message.split("\n")[0]}`, true);
    } finally {
      if (run === reviewRun) reviewCtl = null;
    }
  }

  // ---------- prompt writer: study the page (and optionally the web), propose art directions ----------
  const PROMPT_SYSTEM = `You are a creative director who writes briefs for an AI that completely rebuilds web pages: new information architecture, layout, components, typography, colour and motion, while keeping all real content and keeping the site working.

You receive a screenshot of the original page, its URL, a sample of its extracted content, and optional notes from the user. You may have a web search tool: if so, use it briefly to learn what the site or brand is, who uses it and what it is known for. Do not research if the page already makes that obvious.

Write THREE distinct redesign prompts:
1. "Elevated": faithful to the brand and audience, but far better crafted.
2. "Bold": a daring creative concept rooted in the site's subject, culture or history.
3. "Task-first": built around the visitor's primary task, ideal for speed, clarity and accessibility.
If the user's notes ask for something specific, all three must honour it.

Each prompt is 60-110 words of concrete art direction:
- the concept or metaphor;
- who the page is for and what it must make easy;
- the layout structure and two or three signature components invented for THIS content;
- typography, as named Google Fonts;
- the palette, naming the brand colour role;
- the motion idea;
- the tone of microcopy.
No generic adjectives without specifics. Never ask to remove content or invent facts.
Steer clear of the default looks of AI-generated pages: cream plus terracotta, near-black plus one acid-green accent, identical rounded SaaS cards with soft shadows, ALL-CAPS eyebrow labels, and gradient washes. Use one only when the notes ask for it. Each direction should spend its boldness on one memorable element.

Return ONLY JSON:
{"site":"one line on what this site is","ideas":[{"name":"2-4 word title","prompt":"..."}]}`;

  async function suggestPrompts(notes) {
    if (busy) return;
    busy = true;
    const wasVisible = overlayVisible;
    try {
      const { model } = await chrome.storage.local.get("model");
      const useModel = model || MODELS[0];
      panel.status("Studying the page…");
      const data = await extractPageData();
      const shots = (await captureOriginalShots()).slice(0, 1);
      if (wasVisible && currentCode) setOverlay(true);
      const name = data.brand?.name || data.site || location.hostname;
      panel.status(`Researching ${name} and writing prompts with ${useModel}…`);
      panel.toast(`Prompt writer · researching ${name}`, true);
      const user = `URL: ${location.href}
PAGE TYPE: ${page.type}${data.archetype ? ` (${data.archetype})` : ""}
USER NOTES: ${notes ? `"${notes}"` : "none"}

CONTENT SAMPLE:
${JSON.stringify(X.sample(data, page.type)).slice(0, 7000)}

DESIGN LIBRARY MATCHES (UI UX Pro Max; ground fonts and palettes in these where they fit, but stay original):
${await designReference(notes, data)}`;
      const text = await stream(PROMPT_SYSTEM, user, useModel, () => {}, {
        images: shots,
        maxTokens: 4000,
        tools: [{ type: "web_search" }],
        onNote: (note) => panel.toast(`Prompt writer · ${note}`, true),
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The prompt writer did not return JSON.");
      const result = JSON.parse(match[0]);
      const ideas = (Array.isArray(result.ideas) ? result.ideas : [])
        .filter((i) => i && typeof i.prompt === "string" && i.prompt.trim())
        .slice(0, 3)
        .map((i) => ({ name: String(i.name || "Idea").slice(0, 40), prompt: i.prompt.trim().slice(0, 1200) }));
      if (!ideas.length) throw new Error("The prompt writer returned no ideas.");
      panel.showIdeas(ideas, String(result.site || "").slice(0, 200));
      panel.toast("Prompt writer · 3 directions ready");
      panel.status("Pick a direction to put it in the prompt box, edit it if you like, then Remodel.");
    } catch (err) {
      if (wasVisible && currentCode) setOverlay(true);
      panel.toast(null);
      panel.status(`Prompt writer failed: ${err.message.split("\n")[0]}`, true);
      if (/HTTP 401|API key/i.test(err.message)) panel.showKey();
    } finally {
      busy = false;
    }
  }

  // ---------- generate ----------
  let busy = false;
  let currentCode = "";
  let currentPrompt = "";

  async function generate(stylePrompt, remix = null) {
    if (busy) return;
    busy = true;
    cancelReview();
    const started = Date.now();
    let useModel = MODELS[0];
    try {
      const { model } = await chrome.storage.local.get("model");
      useModel = model || MODELS[0];
      const data = await extractPageData();
      if (page.generic && (!remix || !rendererKey)) {
        rendererKey = genericKey(data.archetype, remix ? (currentPrompt || stylePrompt) : stylePrompt);
        if (!remix && await reuseGeneric(stylePrompt, data, started)) return;
      }
      let referenceImages = [];
      if (!remix && page.site === "irctc") {
        panel.status("Looking at the original IRCTC page…");
        try { referenceImages = [await captureVisiblePage()]; } catch {}
      } else if (!remix && page.generic) {
        panel.status(`Looking at ${data.brand.name} · ${data.archetype} page, ${data.stats.sectionCount} sections…`);
        referenceImages = await captureOriginalShots();
      }
      setOverlay(false);
      removeCover();
      const all = await chrome.storage.local.get(null);
      const sibling = page.generic
        ? Object.entries(all).find(([k]) => k.startsWith("renderer:generic:") && k.endsWith(`:${promptHash(stylePrompt)}`) && k !== rendererKey)?.[1]
        : Object.entries(all).find(([k]) => k.startsWith(`renderer:${page.site}:`) && k !== rendererKey)?.[1];

      C.start();
      panel.status(remix ? `Remixing “${remix.section.title}” with ${useModel}…` : `Directing with ${useModel}…`);
      const user = remix
        ? remixPrompt(currentPrompt || stylePrompt, remix.instruction, remix.section, data, currentCode)
        : userPrompt(stylePrompt, data, sibling, await designReference(stylePrompt, data));
      const onDelta = (m) => panel.progress(m.delta, m.length, started);

      let code = extractCode(await stream(SYSTEM, user, useModel, onDelta, { images: referenceImages }));
      try {
        await render(code, data, { focusSection: remix?.section.id || null });
      } catch (err) {
        panel.status("Found a bug in the design. Fixing…");
        const fix = `${user}

YOUR PREVIOUS CODE:
\`\`\`js
${code}
\`\`\`

It failed with this error:
${err.message}

Return the complete corrected code in one \`\`\`js block.`;
        code = extractCode(await stream(SYSTEM, fix, useModel, onDelta));
        await render(code, data, { focusSection: remix?.section.id || null });
      }

      await C.flourish();
      setOverlay(true);
      currentCode = code;
      currentPrompt = remix ? (currentPrompt || stylePrompt) : stylePrompt;
      await chrome.storage.local.set({
        [rendererKey]: rendererRecord(code, currentPrompt, useModel),
        [SITE_KEY]: { enabled: true, prompt: currentPrompt },
      });
      panel.status(`${remix ? "Remix" : "Design"} done in ${Math.round((Date.now() - started) / 1000)} s. Hover a chapter to remix it. Alt+R toggles.`);
      panel.collapse();
      const { review = true } = await chrome.storage.local.get("review");
      if (review) reviewAndPolish({ code, data, prompt: currentPrompt, model: useModel });
    } catch (err) {
      C.stop();
      removeCover();
      if (/Extension context invalidated/i.test(err.message)) {
        panel.status("The extension was reloaded. Refresh this tab, then try again.", true);
        return;
      }
      if (remix && currentCode) {
        try {
          await render(currentCode, await extractPageData(), { focusSection: remix.section.id });
          setOverlay(true);
          panel.status(`Remix failed; restored the previous design. ${err.message}`, true);
        } catch {
          panel.status(`Error: ${err.message}`, true);
        }
      } else {
        panel.status(`Error: ${err.message}`, true);
      }
      if (/HTTP 401|API key|token_invalidated|expired_secret_key/i.test(err.message)) panel.showKey();
    } finally {
      busy = false;
      panel.finishProgress();
    }
  }

  // A design made on another website for the same archetype and style is applied instantly with this
  // site's branding. Pressing Remodel again with the same prompt generates a fresh one.
  let offeredReuse = "";
  async function reuseGeneric(stylePrompt, data, started) {
    const rec = (await chrome.storage.local.get(rendererKey))[rendererKey];
    if (!rec || rec.host === location.hostname || offeredReuse === rendererKey) return false;
    offeredReuse = rendererKey;
    try {
      await render(rec.code, data);
    } catch {
      return false;
    }
    removeCover();
    setOverlay(true);
    currentCode = rec.code;
    currentPrompt = stylePrompt;
    await chrome.storage.local.set({ [SITE_KEY]: { enabled: true, prompt: stylePrompt } });
    panel.toast(`Instant · reused the ${data.archetype} design from ${rec.host}`);
    panel.status(`Reused your ${data.archetype} design from ${rec.host} in ${((Date.now() - started) / 1000).toFixed(1)} s, with ${data.brand.name}'s branding. Press Remodel again for a fresh design.`);
    panel.collapse();
    return true;
  }

  async function applyCached(rec, data = null) {
    cancelReview();
    try {
      currentCode = rec.code;
      currentPrompt = rec.prompt || "";
      await render(rec.code, data || await extractPageData());
      setOverlay(true);
    } catch (err) {
      removeCover();
      panel.status(`Saved design failed on this page: ${err.message.split("\n")[0]}`, true);
      panel.expand();
    }
  }

  async function resetSite() {
    cancelReview();
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(`renderer:${page.site}:`) || k === SITE_KEY));
    setOverlay(false);
    panel.status(page.generic
      ? "Reset. This site is back to normal; saved styles stay available for other sites."
      : "Reset. This site is back to normal.");
  }

  // ---------- panel ----------
  const panel = (() => {
    let root = null;
    let hostEl = null;
    let codeTail = "";
    let toastTimer = 0;
    const $ = (sel) => root.querySelector(sel);

    function mount() {
      if (root) return;
      hostEl = document.createElement("div");
      hostEl.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
      root = hostEl.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { all: initial; color-scheme: light; }
          * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
          button, textarea, input, select { color: #111; }
          .pill { background: #111; color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
          .card { width: 360px; background: #fff; color: #111; border-radius: 16px; padding: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.28); display: none; }
          .open .card { display: block; } .open .pill { display: none; }
          h1 { font-size: 15px; margin: 0 0 10px; display: flex; justify-content: space-between; }
          h1 button { background: none; border: 0; font-size: 16px; cursor: pointer; }
          textarea, input, select { width: 100%; border: 1.5px solid #ddd; border-radius: 10px; padding: 9px; font-size: 13px; }
          textarea { height: 64px; resize: vertical; }
          .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
          .chip { border: 1.5px solid #ddd; background: #fafafa; border-radius: 999px; padding: 4px 9px; font-size: 12px; cursor: pointer; }
          .row { display: flex; gap: 8px; margin-top: 8px; }
          .modelrow select { width: auto; min-width: 0; flex: 1; }
          .go { flex: 1; background: #111; color: #fff; border: 0; border-radius: 10px; padding: 10px; font-weight: 700; cursor: pointer; }
          .ghost { background: #f2f2f2; border: 0; border-radius: 10px; padding: 8px 10px; font-size: 12px; cursor: pointer; }
          .ideas { display: none; margin-top: 8px; max-height: 300px; overflow: auto; }
          .ideas.on { display: block; }
          .ideasite { font-size: 11px; color: #666; margin-bottom: 6px; }
          .idea { display: block; width: 100%; text-align: left; border: 1.5px solid #ddd; background: #fafafa; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px; line-height: 1.35; color: #333; }
          .idea:hover, .idea:focus-visible { border-color: #111; background: #fff; }
          .idea b { display: block; font-size: 12px; color: #111; margin-bottom: 3px; }
          .remixbox { display: none; margin-top: 10px; padding: 10px; border: 1.5px solid #111; border-radius: 12px; background: #fffbea; }
          .remixbox.on { display: block; }
          .remixtitle { font-size: 11px; font-weight: 800; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .remixbox textarea { height: 58px; background: #fff; }
          .status { font-size: 12px; color: #555; margin-top: 10px; min-height: 16px; }
          .status.err { color: #c62828; }
          pre { background: #0d0d0d; color: #39ff88; font: 10px/1.35 ui-monospace, monospace; border-radius: 8px; padding: 8px; height: 84px; overflow: hidden; white-space: pre-wrap; word-break: break-all; margin: 8px 0 0; display: none; }
          .meta { font-size: 11px; color: #888; margin-top: 4px; }
          .reviewrow { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: #333; cursor: pointer; }
          .reviewrow input { width: auto; margin: 0; }
          .wrap { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
          .toast { position: absolute; right: 0; bottom: calc(100% + 10px); width: max-content; max-width: 340px; background: #111; color: #fff;
                   border-radius: 999px; padding: 9px 14px; font-size: 12px; font-weight: 700; box-shadow: 0 8px 26px rgba(0,0,0,.3);
                   opacity: 0; transform: translateY(6px); transition: opacity .25s ease, transform .25s ease; pointer-events: none; }
          .toast.on { opacity: 1; transform: none; }
          .toast.busy::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%;
                   background: #39ff88; animation: pulse 1s ease-in-out infinite; }
          @keyframes pulse { 50% { opacity: .25; } }
          @media (prefers-reduced-motion: reduce) { .toast, .toast.busy::before { transition: none; animation: none; } }
        </style>
        <div class="wrap">
          <div class="toast" role="status" aria-live="polite"></div>
          <button class="pill">✦ Remodel</button>
          <div class="card">
            <h1>✦ Remodel <button class="close" title="Close">×</button></h1>
            <div class="keybox" style="display:none">
              <input class="key" type="password" autocomplete="off" placeholder="Paste a new OpenAI API key">
              <div class="row">
                <button class="ghost savekey">Save new key</button>
                <button class="ghost cancelkey">Cancel</button>
              </div>
            </div>
            <textarea class="prompt" placeholder="Describe the redesign, or jot a few notes about the site and press Suggest prompts…"></textarea>
            <div class="chips">${PRESETS.map((p) => `<button class="chip">${p}</button>`).join("")}</div>
            <button class="ghost suggest" style="width:100%">✨ Suggest prompts for this site</button>
            <div class="ideas"></div>
            <div class="row modelrow">
              <select class="model">${MODELS.map((m) => `<option>${m}</option>`).join("")}</select>
              <button class="ghost keytoggle">Change API key</button>
            </div>
            <label class="reviewrow"><input type="checkbox" class="review" checked> AI visual review after each design</label>
            <div class="row"><button class="go">Remodel this page</button></div>
            <div class="row">
              <button class="ghost toggle">Original ⇄ Remodel (Alt+R)</button>
              <button class="ghost reset">Reset site</button>
            </div>
            <div class="remixbox">
              <div class="remixtitle"></div>
              <textarea class="remixprompt" placeholder="Turn this chapter into an interactive timeline…"></textarea>
              <div class="row">
                <button class="go remixgo">Remix this chapter</button>
                <button class="ghost remixcancel">Cancel</button>
              </div>
            </div>
            <div class="status"></div>
            <pre class="ticker"></pre>
            <div class="meta">${page.type}</div>
          </div>
        </div>`;
      document.documentElement.append(hostEl);

      $(".pill").onclick = expand;
      $(".close").onclick = collapse;
      root.querySelectorAll(".chip").forEach((c) => (c.onclick = () => ($(".prompt").value = c.textContent)));
      $(".go").onclick = () => {
        const p = $(".prompt").value.trim();
        if (p) generate(p);
        else status("Type a style or pick one.", true);
      };
      $(".suggest").onclick = () => suggestPrompts($(".prompt").value.trim());
      $(".toggle").onclick = () => setOverlay(!overlayVisible);
      $(".reset").onclick = resetSite;
      $(".keytoggle").onclick = () => {
        const keybox = $(".keybox");
        if (keybox.style.display === "none") showKey();
        else keybox.style.display = "none";
      };
      $(".cancelkey").onclick = () => {
        $(".key").value = "";
        $(".keybox").style.display = "none";
      };
      $(".remixcancel").onclick = () => $(".remixbox").classList.remove("on");
      $(".remixgo").onclick = () => {
        const instruction = $(".remixprompt").value.trim();
        const section = $(".remixbox")._section;
        if (instruction && section) generate(currentPrompt || $(".prompt").value.trim(), { instruction, section });
        else status("Describe how this chapter should change.", true);
      };
      $(".model").onchange = () => chrome.storage.local.set({ model: $(".model").value });
      $(".review").onchange = () => {
        chrome.storage.local.set({ review: $(".review").checked });
        if (!$(".review").checked) cancelReview();
      };
      $(".savekey").onclick = async () => {
        const apiKey = $(".key").value.trim();
        if (!apiKey) return status("Paste an API key first.", true);
        await chrome.storage.local.set({ apiKey });
        $(".key").value = "";
        $(".keybox").style.display = "none";
        $(".keytoggle").textContent = "Change API key";
        status("API key updated.");
      };
      chrome.storage.local.get(["apiKey", "model", "review", SITE_KEY]).then((s) => {
        if (!s.apiKey) {
          $(".keytoggle").textContent = "Add API key";
          showKey();
        }
        if (s.model) $(".model").value = s.model;
        $(".review").checked = s.review !== false;
        if (s[SITE_KEY]?.prompt) $(".prompt").value = s[SITE_KEY].prompt;
      });
      updateToggle();
    }

    function expand() { mount(); root.querySelector(".wrap").classList.add("open"); }
    function collapse() { mount(); root.querySelector(".wrap").classList.remove("open"); }
    function showKey() {
      mount();
      $(".keybox").style.display = "block";
      expand();
      setTimeout(() => $(".key").focus(), 0);
    }
    function openRemix(section) {
      mount();
      const box = $(".remixbox");
      box._section = section;
      $(".remixtitle").textContent = `Selected chapter · ${section.title}`;
      $(".remixprompt").value = "";
      box.classList.add("on");
      expand();
      setTimeout(() => $(".remixprompt").focus(), 0);
    }
    function status(text, isError = false) {
      mount();
      $(".status").textContent = text;
      $(".status").classList.toggle("err", isError);
      if (!busy) $(".ticker").style.display = "none";
    }
    function progress(delta, length, started) {
      mount();
      codeTail = (codeTail + delta).slice(-600);
      $(".ticker").style.display = "block";
      $(".ticker").textContent = codeTail;
      $(".status").textContent = `Writing the renderer… ${(length / 1000).toFixed(1)}k chars · ${Math.round((Date.now() - started) / 1000)} s`;
    }
    function finishProgress() {
      if (!root) return;
      $(".ticker").style.display = "none";
      codeTail = "";
    }
    function updateToggle() { if (root) $(".toggle").disabled = !overlay; }
    // Busy toasts stay until replaced; others fade after a few seconds. toast(null) hides it.
    function toast(text, isBusy = false) {
      mount();
      clearTimeout(toastTimer);
      const el = $(".toast");
      if (!text) return el.classList.remove("on");
      el.textContent = text;
      el.classList.toggle("busy", isBusy);
      el.classList.add("on");
      if (!isBusy) toastTimer = setTimeout(() => el.classList.remove("on"), 5000);
    }
    function setHidden(hidden) { if (hostEl) hostEl.style.visibility = hidden ? "hidden" : ""; }
    // Idea text comes from the model, so it is set with textContent, never as HTML.
    function showIdeas(ideas, site) {
      mount();
      expand();
      const box = $(".ideas");
      box.replaceChildren();
      if (site) {
        const line = document.createElement("div");
        line.className = "ideasite";
        line.textContent = site;
        box.append(line);
      }
      for (const idea of ideas) {
        const button = document.createElement("button");
        button.className = "idea";
        const title = document.createElement("b");
        title.textContent = idea.name;
        button.append(title, idea.prompt);
        button.onclick = () => {
          $(".prompt").value = idea.prompt;
          $(".prompt").focus();
        };
        box.append(button);
      }
      box.classList.add("on");
    }

    return { mount, expand, collapse, showKey, openRemix, status, progress, finishProgress, updateToggle, toast, setHidden, showIdeas };
  })();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle-panel") panel.expand();
  });

  // ---------- startup: auto-apply a saved design ----------
  chrome.storage.local.get([rendererKey, SITE_KEY].filter(Boolean)).then((s) => {
    const site = s[SITE_KEY];
    if (page.generic) {
      if (!site?.enabled || !site.prompt) {
        onReady(() => panel.mount());
        return;
      }
      showCover();
      onReady(async () => {
        panel.mount();
        try {
          await pageLoaded();
          const data = await extractPageData();
          rendererKey = genericKey(data.archetype, site.prompt);
          const rec = (await chrome.storage.local.get(rendererKey))[rendererKey];
          if (rec) applyCached(rec, data);
          else {
            panel.expand();
            generate(site.prompt);
          }
        } catch (err) {
          removeCover();
          panel.status(`Error: ${err.message}`, true);
        }
      });
      return;
    }
    const rec = s[rendererKey];
    if (site?.enabled && rec) {
      showCover();
      onReady(() => { panel.mount(); applyCached(rec); });
    } else if (site?.enabled && site.prompt) {
      // New page type on a remodelled site: design it in the same style.
      onReady(() => { panel.mount(); panel.expand(); generate(site.prompt); });
    } else {
      onReady(() => panel.mount());
    }
  });
  }

  // IRCTC can enter /nget/train-search through Angular routing after the
  // document-start scripts have run. Keep watching briefly instead of
  // permanently returning because the first URL was not supported.
  const started = Date.now();
  let routeTimer = 0;
  const tryBoot = () => {
    if (booted) return true;
    const page = X?.detect();
    if (!page) return false;
    booted = true;
    clearInterval(routeTimer);
    boot(page);
    return true;
  };
  if (!tryBoot()) {
    routeTimer = setInterval(() => {
      if (tryBoot() || Date.now() - started > 60000) clearInterval(routeTimer);
    }, 250);
  }
})();

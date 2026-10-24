// Orchestrates a redesign: panel → extract → generate a renderer → render in the sandbox → bridge → cache.

(() => {
  if (window.top !== window) return;
  const X = window.RemodelExtract;
  const C = window.RemodelCursors;
  const page = X.detect();
  if (!page) return;

  const RENDERER_KEY = `renderer:${page.type}`;
  const SITE_KEY = `site:${page.site}`;
  const MODELS = ["gpt-6-luna", "gpt-5.4-mini", "gpt-6.1-sol", "gpt-6-astra", "gpt-5.5"];
  const PRESETS = ["Cinematic scroll story", "Graphic novel", "Museum exhibition", "Neo-brutalist", "Apple keynote", "90s Malayalam movie poster"];

  const SYSTEM = `You are an award-winning interactive art director and senior front-end engineer. You completely REBUILD web pages: new information architecture, new layout, original components, typography, colour, and motion. The original design must be unrecognisable, while all the real content stays.

You don't write a page. You write a RENDERER: JavaScript that turns content JSON into a page, so the same design works for every page of this type on the site.

OUTPUT FORMAT: exactly one \`\`\`js code block and nothing else. It must define:
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
- No external scripts, no fetch/XHR, no iframes, no alert(). Keep the code under ~600 lines.`;

  // ---------- small helpers ----------
  const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn, { once: true }) : fn());
  const extractCode = (text) => {
    const m = text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/);
    return (m ? m[1] : text).trim();
  };
  const extractStyle = (code) => (code.match(/const\s+STYLE\s*=\s*`([\s\S]*?)`\s*;/) || [])[1]?.slice(0, 5000) || "";

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
    else if (msg.type === "navigate") {
      if (msg.newTab) window.open(msg.href, "_blank");
      else location.href = msg.href;
    } else if (msg.type === "search") {
      location.href = page.site === "wikipedia"
        ? `${location.origin}/w/index.php?search=${encodeURIComponent(msg.q)}`
        : `https://hn.algolia.com/?q=${encodeURIComponent(msg.q)}`;
    }
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
        else if (msg.type === "done") { finish(); resolve(msg.text); }
        else if (msg.type === "error") { finish(); reject(new Error(msg.message)); }
      });
      port.postMessage({ type: "generate", system, user, model, images: options.images, effort: options.effort, maxTokens: options.maxTokens });
    });
  }

  function userPrompt(stylePrompt, data, siblingStyle) {
    let s = `STYLE REQUEST: "${stylePrompt}"
PAGE TYPE: ${page.type}

DATA SCHEMA:
${X.schema(page.type)}

SAMPLE DATA (trimmed; real pages are longer):
${JSON.stringify(X.sample(data, page.type), null, 1)}`;
    if (siblingStyle) {
      s += `

DESIGN SYSTEM TO MATCH: another page type on this site already uses the CSS below. Reuse its fonts, colours and component language so the whole site feels like one product.
${siblingStyle}`;
    }
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
- high: overlapping or illegible text, content cut off or hidden, empty or placeholder content, stray debugging text, elements escaping their containers, huge accidental blank regions, a layout that is clearly broken.
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
      await chrome.storage.local.set({
        [RENDERER_KEY]: { code: fixed, prompt, model, style: extractStyle(fixed), created: Date.now(), reviewed: true },
      });
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

  // ---------- generate ----------
  let busy = false;
  let currentCode = "";
  let currentPrompt = "";

  async function generate(stylePrompt, remix = null) {
    if (busy) return;
    busy = true;
    cancelReview();
    const started = Date.now();
    const { model } = await chrome.storage.local.get("model");
    const useModel = model || MODELS[0];
    try {
      setOverlay(false);
      removeCover();
      const data = X.extract(page.type);
      const all = await chrome.storage.local.get(null);
      const sibling = Object.entries(all).find(([k]) => k.startsWith(`renderer:${page.site}:`) && k !== RENDERER_KEY)?.[1];

      C.start();
      panel.status(remix ? `Remixing “${remix.section.title}” with ${useModel}…` : `Directing with ${useModel}…`);
      const user = remix
        ? remixPrompt(currentPrompt || stylePrompt, remix.instruction, remix.section, data, currentCode)
        : userPrompt(stylePrompt, data, sibling?.style);
      const onDelta = (m) => panel.progress(m.delta, m.length, started);

      let code = extractCode(await stream(SYSTEM, user, useModel, onDelta));
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
        [RENDERER_KEY]: { code, prompt: currentPrompt, model: useModel, style: extractStyle(code), created: Date.now() },
        [SITE_KEY]: { enabled: true, prompt: currentPrompt },
      });
      panel.status(`${remix ? "Remix" : "Design"} done in ${Math.round((Date.now() - started) / 1000)} s. Hover a chapter to remix it. Alt+R toggles.`);
      panel.collapse();
      const { review = true } = await chrome.storage.local.get("review");
      if (review) reviewAndPolish({ code, data, prompt: currentPrompt, model: useModel });
    } catch (err) {
      C.stop();
      removeCover();
      if (remix && currentCode) {
        try {
          await render(currentCode, X.extract(page.type), { focusSection: remix.section.id });
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

  async function applyCached(rec) {
    cancelReview();
    try {
      currentCode = rec.code;
      currentPrompt = rec.prompt || "";
      await render(rec.code, X.extract(page.type));
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
    panel.status("Reset. This site is back to normal.");
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
          * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
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
            <textarea class="prompt" placeholder="Describe the redesign…"></textarea>
            <div class="chips">${PRESETS.map((p) => `<button class="chip">${p}</button>`).join("")}</div>
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

    return { mount, expand, collapse, showKey, openRemix, status, progress, finishProgress, updateToggle, toast, setHidden };
  })();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle-panel") panel.expand();
  });

  // ---------- startup: auto-apply a saved design ----------
  chrome.storage.local.get([RENDERER_KEY, SITE_KEY]).then((s) => {
    const site = s[SITE_KEY];
    const rec = s[RENDERER_KEY];
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
})();

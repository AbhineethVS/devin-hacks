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
  const PRESETS = ["Travel magazine", "Neo-brutalist", "Windows 95", "Apple.com product page", "Newspaper front page", "90s Malayalam movie poster"];

  const SYSTEM = `You are an award-winning art director and senior front-end engineer. You completely REBUILD web pages: new information architecture, new layout, new components, new typography, new colour. The original design must be unrecognisable, while all the real content stays.

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
- Make it striking: a strong hero, a clear grid, real components (cards, stat tiles, timelines, pull quotes, sticky table of contents, galleries — whatever fits the style), a deliberate type scale, generous spacing.
- Use the data's images generously (object-fit, aspect-ratio). Images can fail to load: the layout must not depend on them.
- Body copy stays readable: max ~70ch line length.
- Include one small witty sticker or badge that fits the style and the site.
- No external scripts, no fetch/XHR, no iframes, no alert(). Keep the code under ~500 lines.`;

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

  async function render(code, data) {
    await ensureOverlay();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Render timed out")), 10000);
      pendingRender = { resolve: () => { clearTimeout(timer); resolve(); }, reject: (e) => { clearTimeout(timer); reject(e); } };
      overlay.contentWindow.postMessage({ type: "render", code, data }, "*");
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
    else if (msg.type === "toggle") setOverlay(!overlayVisible);
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
  function stream(system, user, model, onDelta) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: "generate" });
      const ping = setInterval(() => port.postMessage({ type: "ping" }), 20000);
      const finish = () => { clearInterval(ping); port.disconnect(); };
      port.onMessage.addListener((msg) => {
        if (msg.type === "delta") onDelta(msg);
        else if (msg.type === "done") { finish(); resolve(msg.text); }
        else if (msg.type === "error") { finish(); reject(new Error(msg.message)); }
      });
      port.postMessage({ type: "generate", system, user, model });
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

  // ---------- generate ----------
  let busy = false;

  async function generate(stylePrompt) {
    if (busy) return;
    busy = true;
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
      panel.status(`Designing with ${useModel}…`);
      const user = userPrompt(stylePrompt, data, sibling?.style);
      const onDelta = (m) => panel.progress(m.delta, m.length, started);

      let code = extractCode(await stream(SYSTEM, user, useModel, onDelta));
      try {
        await render(code, data);
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
        await render(code, data);
      }

      await C.flourish();
      setOverlay(true);
      await chrome.storage.local.set({
        [RENDERER_KEY]: { code, prompt: stylePrompt, model: useModel, style: extractStyle(code), created: Date.now() },
        [SITE_KEY]: { enabled: true, prompt: stylePrompt },
      });
      panel.status(`Done in ${Math.round((Date.now() - started) / 1000)} s. Every ${page.type} page now renders instantly. Alt+R toggles.`);
      panel.collapse();
    } catch (err) {
      C.stop();
      removeCover();
      panel.status(`Error: ${err.message}`, true);
    } finally {
      busy = false;
    }
  }

  async function applyCached(rec) {
    try {
      await render(rec.code, X.extract(page.type));
      setOverlay(true);
    } catch (err) {
      removeCover();
      panel.status(`Saved design failed on this page: ${err.message.split("\n")[0]}`, true);
      panel.expand();
    }
  }

  async function resetSite() {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(`renderer:${page.site}:`) || k === SITE_KEY));
    setOverlay(false);
    panel.status("Reset. This site is back to normal.");
  }

  // ---------- panel ----------
  const panel = (() => {
    let root = null;
    let codeTail = "";
    const $ = (sel) => root.querySelector(sel);

    function mount() {
      if (root) return;
      const hostEl = document.createElement("div");
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
          .go { flex: 1; background: #111; color: #fff; border: 0; border-radius: 10px; padding: 10px; font-weight: 700; cursor: pointer; }
          .ghost { background: #f2f2f2; border: 0; border-radius: 10px; padding: 8px 10px; font-size: 12px; cursor: pointer; }
          .status { font-size: 12px; color: #555; margin-top: 10px; min-height: 16px; }
          .status.err { color: #c62828; }
          pre { background: #0d0d0d; color: #39ff88; font: 10px/1.35 ui-monospace, monospace; border-radius: 8px; padding: 8px; height: 84px; overflow: hidden; white-space: pre-wrap; word-break: break-all; margin: 8px 0 0; display: none; }
          .meta { font-size: 11px; color: #888; margin-top: 4px; }
        </style>
        <div class="wrap">
          <button class="pill">✦ Remodel</button>
          <div class="card">
            <h1>✦ Remodel <button class="close" title="Close">×</button></h1>
            <div class="keybox" style="display:none">
              <input class="key" type="password" placeholder="OpenAI API key (stored locally)">
              <div class="row"><button class="ghost savekey">Save key</button></div>
            </div>
            <textarea class="prompt" placeholder="Describe the redesign…"></textarea>
            <div class="chips">${PRESETS.map((p) => `<button class="chip">${p}</button>`).join("")}</div>
            <select class="model">${MODELS.map((m) => `<option>${m}</option>`).join("")}</select>
            <div class="row"><button class="go">Remodel this page</button></div>
            <div class="row">
              <button class="ghost toggle">Original ⇄ Remodel (Alt+R)</button>
              <button class="ghost reset">Reset site</button>
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
      $(".model").onchange = () => chrome.storage.local.set({ model: $(".model").value });
      $(".savekey").onclick = async () => {
        await chrome.storage.local.set({ apiKey: $(".key").value.trim() });
        $(".keybox").style.display = "none";
        status("Key saved.");
      };
      chrome.storage.local.get(["apiKey", "model", SITE_KEY]).then((s) => {
        if (!s.apiKey) $(".keybox").style.display = "block";
        if (s.model) $(".model").value = s.model;
        if (s[SITE_KEY]?.prompt) $(".prompt").value = s[SITE_KEY].prompt;
      });
      updateToggle();
    }

    function expand() { mount(); root.querySelector(".wrap").classList.add("open"); }
    function collapse() { mount(); root.querySelector(".wrap").classList.remove("open"); }
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
    function updateToggle() { if (root) $(".toggle").disabled = !overlay; }

    return { mount, expand, collapse, status, progress, updateToggle };
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

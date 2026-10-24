// Decorative "agent" cursors that visibly work on the page while a redesign is generated.
// Every effect is drawn in an overlay; the real page DOM is never modified.
// Exposes window.RemodelCursors = { start(), stop(), flourish() }.

(() => {
  const AGENTS = [
    { name: "Ammu", job: "layout", color: "#ff4d8d" },
    { name: "Kuttan", job: "typography", color: "#2f6bff" },
    { name: "Chinnu", job: "colour", color: "#00b86b" },
    { name: "Meenu", job: "spacing", color: "#ff8a00" },
    { name: "Appu", job: "copy", color: "#8b5cff" },
  ];
  const FILLER = new Set(["very", "really", "just", "basically", "actually", "simply", "quite", "also", "currently", "various", "that", "totally", "literally", "extremely", "highly", "truly", "completely", "perhaps", "somewhat", "rather"]);
  const FACES = [
    ["Georgia, 'Times New Roman', serif", "serif"],
    ["'Trebuchet MS', 'Segoe UI', sans-serif", "humanist"],
    ["ui-monospace, Consolas, monospace", "mono"],
    ["Impact, 'Arial Black', sans-serif", "display"],
    ["'Palatino Linotype', Palatino, serif", "old-style"],
  ];
  const MOVE = 900;

  let host = null;
  let layer = null;
  let run = 0;
  const busy = new Set();

  const spread = (i) => i - (AGENTS.length - 1) / 2;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function visible(el, minW = 40, minH = 12) {
    const r = el.getBoundingClientRect();
    return r.width > minW && r.height > minH && r.top > 8 && r.bottom < innerHeight - 8 && r.left >= 0 && r.right <= innerWidth;
  }

  const recent = [];

  function onScreen(el) {
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 12 && r.top < innerHeight - 60 && r.bottom > 60 && r.left >= 0 && r.right <= innerWidth;
  }

  function target(selector, test = () => true, fits = visible) {
    const els = [...document.querySelectorAll(selector)].filter((el) => !busy.has(el) && fits(el) && test(el));
    const fresh = els.filter((el) => !recent.includes(el));
    const t = fresh.length ? pick(fresh) : els.length ? pick(els) : null;
    if (t) {
      recent.push(t);
      if (recent.length > 8) recent.shift();
    }
    return t;
  }

  function textRect(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  }

  function rgbParts(value) {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }

  const hex = ({ r, g, b }) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

  function backgroundOf(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const c = rgbParts(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.9) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function hsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s, l };
  }

  function el(tag, cls, style = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    Object.assign(node.style, style);
    layer.append(node);
    return node;
  }

  function moveTo(agent, x, y, ms = MOVE) {
    agent.el.style.transitionDuration = `${ms}ms`;
    agent.el.style.transform = `translate(${x}px, ${y}px)`;
    return sleep(ms);
  }

  function say(agent, text) {
    agent.tag.textContent = `${agent.name} · ${text}`;
  }

  function idle(agent, text) {
    say(agent, text);
    return moveTo(agent, 80 + Math.random() * (innerWidth - 260), 80 + Math.random() * (innerHeight - 200), 1200);
  }

  function click(agent, x, y) {
    const p = el("div", "pulse", { left: `${x}px`, top: `${y}px`, background: agent.color });
    setTimeout(() => p.remove(), 700);
  }

  // Typography: drag-select a real heading, then retype it in a new face.
  async function retype(agent, token) {
    const fits = (n) => {
      const text = n.innerText.trim();
      return text.length >= 6 && text.length <= 90 && !text.includes("\n");
    };
    const selector = "h1, h2, h3, h4, .titleline > a, p, li a, a, button";
    const t = target(selector, (n) => fits(n) && parseFloat(getComputedStyle(n).fontSize) >= 18) || target(selector, fits);
    if (!t) return idle(agent, "reading the page");
    busy.add(t);
    try {
      const r = textRect(t);
      const cs = getComputedStyle(t);
      const text = t.innerText.trim();
      const [face, faceName] = pick(FACES);
      say(agent, "selecting text");
      await moveTo(agent, r.left, r.top + r.height / 2);
      if (token !== run) return;
      click(agent, r.left, r.top + r.height / 2);
      const sel = el("div", "sel", { left: `${r.left}px`, top: `${r.top}px`, height: `${r.height}px`, width: "0px", background: `${agent.color}55` });
      requestAnimationFrame(() => (sel.style.width = `${r.width}px`));
      await moveTo(agent, r.right, r.top + r.height / 2, 600);
      if (token !== run) return;
      say(agent, `retyping in ${faceName}`);
      const bg = backgroundOf(t);
      const card = el("div", "type", {
        left: `${r.left - 2}px`, top: `${r.top - 2}px`, minWidth: `${r.width + 4}px`, minHeight: `${r.height + 4}px`,
        background: `rgb(${bg.r},${bg.g},${bg.b})`, color: cs.color, fontFamily: face,
        fontSize: cs.fontSize, fontWeight: faceName === "display" ? "400" : cs.fontWeight, lineHeight: cs.lineHeight,
        letterSpacing: faceName === "display" ? "0.02em" : "normal", outlineColor: agent.color,
      });
      sel.remove();
      const words = el("span", "", {});
      const caret = el("span", "caret", { background: agent.color });
      card.append(words, caret);
      const chars = reduced() ? [text] : [...text];
      const step = Math.max(14, Math.min(45, 1400 / chars.length));
      for (const ch of chars) {
        if (token !== run) return;
        words.textContent += ch;
        const cr = caret.getBoundingClientRect();
        agent.el.style.transitionDuration = "80ms";
        agent.el.style.transform = `translate(${cr.right + 2}px, ${cr.top + cr.height * 0.6}px)`;
        await sleep(step);
      }
      say(agent, `set in ${faceName} ✓`);
      await sleep(900);
      card.classList.add("out");
      setTimeout(() => card.remove(), 500);
    } finally {
      busy.delete(t);
    }
  }

  // Layout: grab a real block, drag it onto a 12-column grid and resize it.
  async function regrid(agent, token) {
    const t = target("img, figure, table, h1, h2, p, ul, ol, form, .athing", (n) => {
      const r = n.getBoundingClientRect();
      return r.width > 80 && r.height > 28 && r.width < innerWidth * 0.95 && r.height < innerHeight * 0.45;
    });
    if (!t) return idle(agent, "measuring the grid");
    busy.add(t);
    const grid = el("div", "grid");
    try {
      const r = t.getBoundingClientRect();
      const gutter = 24;
      const colW = (innerWidth - gutter * 13) / 12;
      for (let i = 0; i < 12; i++) {
        const c = document.createElement("i");
        Object.assign(c.style, { left: `${gutter + i * (colW + gutter)}px`, width: `${colW}px`, background: `${agent.color}08`, borderColor: `${agent.color}30` });
        grid.append(c);
      }
      requestAnimationFrame(() => grid.classList.add("on"));
      say(agent, "grabbing a block");
      await moveTo(agent, r.left + 12, r.top + 12);
      if (token !== run) return;
      click(agent, r.left + 12, r.top + 12);
      const ghost = el("div", "ghost", {
        left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        borderColor: agent.color, background: `${agent.color}18`,
      });
      const label = document.createElement("b");
      label.style.background = agent.color;
      label.textContent = `${t.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)}`;
      ghost.append(label);
      ["nw", "ne", "sw", "se"].forEach((k) => {
        const h = document.createElement("u");
        h.className = k;
        h.style.borderColor = agent.color;
        ghost.append(h);
      });
      await sleep(250);
      const span = pick([4, 5, 6, 7, 8]);
      const startCol = Math.floor(Math.random() * (13 - span));
      const left = gutter + startCol * (colW + gutter);
      const width = span * colW + (span - 1) * gutter;
      const height = Math.max(40, Math.min(r.height * (width / r.width), innerHeight * 0.5));
      const top = Math.max(16, Math.min(innerHeight - height - 16, r.top + pick([-60, -30, 30, 60])));
      say(agent, `snapping to ${span} columns`);
      Object.assign(ghost.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      label.textContent = `${span} col · ${Math.round(width)}px`;
      await moveTo(agent, left + 12, top + 12, 700);
      if (token !== run) return;
      await moveTo(agent, left + width - 4, top + height - 4, 500);
      say(agent, `placed on col ${startCol + 1} ✓`);
      await sleep(800);
      ghost.classList.add("out");
      setTimeout(() => ghost.remove(), 500);
    } finally {
      grid.classList.remove("on");
      setTimeout(() => grid.remove(), 500);
      busy.delete(t);
    }
  }

  // Colour: eyedrop a real colour from the page, then paint a new palette over the element.
  async function repaint(agent, token) {
    const t = target("h1, h2, h3, a, button, nav, header, p, td, th, img", (n) => n.getBoundingClientRect().width > 60);
    if (!t) return idle(agent, "sampling colours");
    busy.add(t);
    try {
      const r = t.getBoundingClientRect();
      const x = r.left + Math.min(r.width - 10, 24 + Math.random() * Math.max(10, r.width - 48));
      const y = r.top + r.height / 2;
      say(agent, "eyedropping");
      await moveTo(agent, x, y);
      if (token !== run) return;
      click(agent, x, y);
      const fg = rgbParts(getComputedStyle(t).color);
      const sampled = t.tagName === "IMG" || !fg ? backgroundOf(t) : fg;
      const { h, s } = hsl(sampled);
      const next = `hsl(${Math.round((h + 140 + Math.random() * 80) % 360)} ${Math.round(Math.max(55, s * 100))}% 52%)`;
      const loupe = el("div", "loupe", { left: `${x + 18}px`, top: `${y - 54}px`, borderColor: agent.color });
      const from = document.createElement("i");
      from.style.background = hex(sampled);
      const to = document.createElement("i");
      to.style.background = next;
      to.style.opacity = "0";
      const code = document.createElement("span");
      code.textContent = hex(sampled);
      loupe.append(from, to, code);
      await sleep(700);
      if (token !== run) return;
      say(agent, "mixing a palette");
      to.style.opacity = "1";
      code.textContent = `${hex(sampled)} → ${next}`;
      await sleep(500);
      say(agent, "painting");
      const wash = el("div", "wash", { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, background: next });
      requestAnimationFrame(() => wash.classList.add("on"));
      await moveTo(agent, r.right - 6, y, 700);
      say(agent, "repainted ✓");
      await sleep(900);
      wash.classList.add("out");
      loupe.classList.add("out");
      setTimeout(() => (wash.remove(), loupe.remove()), 500);
    } finally {
      busy.delete(t);
    }
  }

  function luminance({ r, g, b }) {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function ruler(agent, x1, y1, x2, y2, text) {
    const vertical = x1 === x2;
    const line = el("div", `ruler ${vertical ? "v" : "h"}`, {
      left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`,
      width: vertical ? "0px" : `${Math.abs(x2 - x1)}px`, height: vertical ? `${Math.abs(y2 - y1)}px` : "0px",
      borderColor: agent.color, color: agent.color,
    });
    const tag = document.createElement("b");
    tag.style.background = agent.color;
    tag.textContent = text;
    line.append(tag);
    requestAnimationFrame(() => line.classList.add("on"));
    return line;
  }

  // Spacing and accessibility: redline an element's width and the gap to its neighbour, then check its real contrast.
  async function measure(agent, token) {
    const t = target("h1, h2, h3, p, img, button, li, td, .athing", (n) => n.getBoundingClientRect().width > 60);
    if (!t) return idle(agent, "checking spacing");
    busy.add(t);
    const marks = [];
    try {
      const r = t.getBoundingClientRect();
      say(agent, "measuring");
      await moveTo(agent, r.left, r.top - 8);
      if (token !== run) return;
      click(agent, r.left, r.top - 8);
      const outline = el("div", "spec", { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderColor: agent.color });
      marks.push(outline, ruler(agent, r.left, r.top - 8, r.right, r.top - 8, `${Math.round(r.width)}px`));
      await moveTo(agent, r.right, r.top - 8, 600);
      if (token !== run) return;

      let next = t.nextElementSibling;
      while (next && !next.getBoundingClientRect().height) next = next.nextElementSibling;
      const nr = next?.getBoundingClientRect();
      if (nr && nr.top >= r.bottom && nr.top - r.bottom < innerHeight / 3 && nr.top < innerHeight) {
        const x = Math.min(r.right, nr.right) - 30;
        say(agent, "checking the rhythm");
        await moveTo(agent, x, r.bottom, 500);
        const gap = Math.round(nr.top - r.bottom);
        marks.push(ruler(agent, x, r.bottom, x, Math.max(nr.top, r.bottom + 1), `${gap}px`));
        await moveTo(agent, x, nr.top, 500);
        if (token !== run) return;
      }

      const fg = rgbParts(getComputedStyle(t).color);
      if (fg && t.tagName !== "IMG") {
        const bg = backgroundOf(t);
        const [a, b] = [luminance(fg), luminance(bg)].sort((p, q) => q - p);
        const ratio = (a + 0.05) / (b + 0.05);
        const large = parseFloat(getComputedStyle(t).fontSize) >= 24;
        const pass = ratio >= (large ? 3 : 4.5);
        say(agent, "checking contrast");
        const badge = el("div", `badge ${pass ? "pass" : "fail"}`, { left: `${Math.min(innerWidth - 190, r.right + 10)}px`, top: `${Math.max(8, r.top)}px` });
        badge.textContent = `Contrast ${ratio.toFixed(1)}:1 · ${pass ? "AA ✓" : "fails AA"}`;
        marks.push(badge);
        await moveTo(agent, Math.min(innerWidth - 190, r.right + 10) + 8, Math.max(8, r.top) + 30, 500);
        say(agent, pass ? "spacing logged ✓" : "flagged low contrast");
      } else {
        say(agent, "spacing logged ✓");
      }
      await sleep(1100);
    } finally {
      marks.forEach((m) => m.classList.add("out"));
      setTimeout(() => marks.forEach((m) => m.remove()), 500);
      busy.delete(t);
    }
  }

  function wordRects(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node && out.length < 160; node = walker.nextNode()) {
      for (const m of node.textContent.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.top > 8 && rect.bottom < innerHeight - 8) out.push({ word: m[0], rect });
      }
    }
    return out;
  }

  // Copy: red-pen filler words in a real paragraph and leave a margin note.
  async function edit(agent, token) {
    const t = target("p, li, dd, blockquote, td", (n) => n.innerText.trim().split(/\s+/).length >= 12, onScreen);
    if (!t) return idle(agent, "proofreading");
    busy.add(t);
    const marks = [];
    try {
      const words = wordRects(t);
      if (words.length < 8) return idle(agent, "proofreading");
      let cut = words.filter((w) => FILLER.has(w.word.toLowerCase())).slice(0, 4);
      let why = "filler";
      if (!cut.length) {
        const at = Math.floor(Math.random() * (words.length - 4));
        cut = words.slice(at, at + 3);
        why = "wordy";
      }
      say(agent, "proofreading");
      await moveTo(agent, cut[0].rect.left, cut[0].rect.bottom);
      for (const w of cut) {
        if (token !== run) return;
        await moveTo(agent, w.rect.left, w.rect.top + w.rect.height / 2, 350);
        say(agent, `cutting “${w.word}”`);
        const strike = el("div", "strike", { left: `${w.rect.left - 2}px`, top: `${w.rect.top + w.rect.height * 0.52}px`, background: agent.color });
        const mark = el("div", "hl", { left: `${w.rect.left - 2}px`, top: `${w.rect.top}px`, width: `${w.rect.width + 4}px`, height: `${w.rect.height}px`, background: `${agent.color}22` });
        marks.push(strike, mark);
        requestAnimationFrame(() => (strike.style.width = `${w.rect.width + 4}px`));
        await moveTo(agent, w.rect.right, w.rect.top + w.rect.height / 2, 260);
      }
      if (token !== run) return;
      const r = t.getBoundingClientRect();
      const right = r.right + 190 < innerWidth;
      const note = el("div", "note", { left: `${right ? r.right + 12 : Math.max(8, r.left)}px`, top: `${right ? cut[0].rect.top - 6 : Math.max(8, r.top - 40)}px`, borderColor: agent.color });
      note.innerHTML = `<b style="color:${agent.color}">Appu</b> `;
      note.append(`${why === "filler" ? "cut filler" : "tighten"} · −${cut.length} word${cut.length > 1 ? "s" : ""}`);
      marks.push(note);
      say(agent, "left a note ✓");
      await sleep(1300);
    } finally {
      marks.forEach((m) => m.classList.add("out"));
      setTimeout(() => marks.forEach((m) => m.remove()), 500);
      busy.delete(t);
    }
  }

  const WORK = { typography: retype, layout: regrid, colour: repaint, spacing: measure, copy: edit };

  async function loop(agent, token, delay) {
    await sleep(delay);
    while (token === run) {
      try {
        await WORK[agent.job](agent, token);
      } catch {
        await sleep(800);
      }
      await sleep(300 + Math.random() * 500);
    }
  }

  function build() {
    host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .agent { position: absolute; left: 0; top: 0; z-index: 5; transition: transform 0.9s cubic-bezier(.2,.8,.2,1), opacity .4s; will-change: transform; }
        .agent svg { width: 22px; height: 22px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
        .tag { position: absolute; left: 16px; top: 18px; white-space: nowrap; font: 600 12px/1 "Remodel Sans", system-ui, sans-serif;
               color: #fff; padding: 5px 8px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
        .pulse { position: absolute; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; animation: p .6s ease-out forwards; }
        @keyframes p { from { transform: scale(.2); opacity: .7 } to { transform: scale(1.8); opacity: 0 } }
        .sel { position: absolute; transition: width .6s linear; border-radius: 2px; }
        .type { position: absolute; box-sizing: border-box; padding: 2px; outline: 2px solid; outline-offset: 2px; border-radius: 3px;
                white-space: nowrap; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.18); transition: opacity .4s; }
        .caret { display: inline-block; width: 2px; height: 1em; margin-left: 1px; vertical-align: -0.12em; animation: blink .8s steps(1) infinite; }
        @keyframes blink { 50% { opacity: 0 } }
        .grid { position: absolute; inset: 0; opacity: 0; transition: opacity .4s; }
        .grid.on { opacity: 1; }
        .grid i { position: absolute; top: 0; bottom: 0; border-left: 1px dashed; border-right: 1px dashed; }
        .ghost { position: absolute; box-sizing: border-box; border: 2px solid; border-radius: 4px; transition: all .7s cubic-bezier(.2,.8,.2,1), opacity .4s;
                 box-shadow: 0 12px 30px rgba(0,0,0,.18); }
        .ghost b { position: absolute; left: -2px; top: -22px; font: 600 11px/1 ui-monospace, Consolas, monospace; color: #fff; padding: 4px 6px; border-radius: 4px 4px 4px 0; white-space: nowrap; }
        .ghost u { position: absolute; width: 8px; height: 8px; background: #fff; border: 2px solid; border-radius: 2px; }
        .ghost .nw { left: -6px; top: -6px } .ghost .ne { right: -6px; top: -6px } .ghost .sw { left: -6px; bottom: -6px } .ghost .se { right: -6px; bottom: -6px }
        .loupe { position: absolute; display: flex; align-items: center; gap: 6px; padding: 6px 9px 6px 6px; background: #fff; border: 2px solid; border-radius: 999px;
                 box-shadow: 0 6px 18px rgba(0,0,0,.2); font: 600 11px/1 ui-monospace, Consolas, monospace; color: #111; white-space: nowrap; transition: opacity .4s; }
        .loupe i { width: 18px; height: 18px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); transition: opacity .4s; }
        .wash { position: absolute; mix-blend-mode: multiply; opacity: .45; clip-path: inset(0 100% 0 0); transition: clip-path .7s linear, opacity .4s; border-radius: 3px; }
        .wash.on { clip-path: inset(0 0 0 0); }
        .spec { position: absolute; box-sizing: border-box; border: 1px dashed; transition: opacity .4s; }
        .ruler { position: absolute; transition: opacity .4s, transform .5s cubic-bezier(.2,.8,.2,1); }
        .ruler.h { border-top: 1.5px solid; transform: scaleX(0); transform-origin: left; }
        .ruler.v { border-left: 1.5px solid; transform: scaleY(0); transform-origin: top; }
        .ruler.on { transform: none; }
        .ruler.h::before, .ruler.h::after { content: ""; position: absolute; top: -5px; height: 9px; border-left: 1.5px solid; }
        .ruler.h::before { left: 0 } .ruler.h::after { right: 0 }
        .ruler.v::before, .ruler.v::after { content: ""; position: absolute; left: -5px; width: 9px; border-top: 1.5px solid; }
        .ruler.v::before { top: 0 } .ruler.v::after { bottom: 0 }
        .ruler b { position: absolute; font: 700 10.5px/1 ui-monospace, Consolas, monospace; color: #fff; padding: 3px 5px; border-radius: 4px; white-space: nowrap; }
        .ruler.h b { left: 50%; top: -20px; transform: translateX(-50%); }
        .ruler.v b { top: 50%; left: 8px; transform: translateY(-50%); }
        .badge { position: absolute; font: 700 11px/1 "Remodel Sans", system-ui, sans-serif; padding: 7px 10px; border-radius: 8px; color: #fff; white-space: nowrap;
                 box-shadow: 0 6px 16px rgba(0,0,0,.2); transition: opacity .4s; animation: pop .3s cubic-bezier(.2,.8,.2,1); }
        .badge.pass { background: #0f8a4f; } .badge.fail { background: #d93025; }
        @keyframes pop { from { transform: scale(.7); opacity: 0 } }
        .strike { position: absolute; height: 2px; width: 0; border-radius: 2px; transition: width .25s linear, opacity .4s; }
        .hl { position: absolute; border-radius: 3px; transition: opacity .4s; }
        .note { position: absolute; max-width: 180px; font: 500 11.5px/1.35 "Remodel Sans", system-ui, sans-serif; color: #222; background: #fffdf2; border: 1.5px solid;
                border-radius: 4px 10px 10px 10px; padding: 7px 9px; box-shadow: 0 6px 16px rgba(0,0,0,.15); transition: opacity .4s; animation: pop .3s cubic-bezier(.2,.8,.2,1); }
        .out { opacity: 0 !important; }
      </style>`;
    layer = document.createElement("div");
    shadow.append(layer);
    AGENTS.forEach((a, i) => {
      const node = document.createElement("div");
      node.className = "agent";
      node.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2l17 9-7.5 2L9 21z" fill="${a.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>
                      <div class="tag" style="background:${a.color}">${a.name} · ${a.job}</div>`;
      node.style.transform = `translate(${innerWidth / 2 + spread(i) * 60}px, ${innerHeight + 40}px)`;
      shadow.append(node);
      a.el = node;
      a.tag = node.querySelector(".tag");
    });
    document.documentElement.append(host);
  }

  window.RemodelCursors = {
    start() {
      if (host) return;
      build();
      const token = ++run;
      AGENTS.forEach((a, i) => loop(a, token, 150 + i * 450));
    },
    // Agents converge on the centre, then leave.
    flourish() {
      if (!host) return Promise.resolve();
      run++;
      layer.querySelectorAll("*").forEach((n) => n.classList.add("out"));
      AGENTS.forEach((a, i) => {
        a.el.style.transitionDuration = `${MOVE}ms`;
        a.tag.textContent = `${a.name} · done ✓`;
        a.el.style.transform = `translate(${innerWidth / 2 + spread(i) * 120 - 50}px, ${innerHeight / 2}px)`;
      });
      return new Promise((resolve) =>
        setTimeout(() => {
          AGENTS.forEach((a, i) => (a.el.style.transform = `translate(${innerWidth / 2 + spread(i) * 300}px, ${-80}px)`));
          setTimeout(() => this.stop(), 900);
          resolve();
        }, 1000)
      );
    },
    stop() {
      run++;
      busy.clear();
      recent.length = 0;
      host?.remove();
      host = null;
      layer = null;
    },
  };
})();

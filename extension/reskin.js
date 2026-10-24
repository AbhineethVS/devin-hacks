// Reskin: restyles the live page in place. Colours, fonts and surfaces change; layout never does.
// Only paint properties are written (colours, border colour, radius, shadow, font family, weight,
// letter-spacing, text-transform), so the site's own boxes, sizes and positions stay exactly as laid out.
// The model never writes CSS: it returns a small theme spec, and this engine turns it into rules.
// Exposes window.RemodelReskin = { analyze(), apply(spec, loadFont), remove(), setEnabled(on), applied, enabled }.

(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "IMG", "PICTURE", "OBJECT", "EMBED", "BR", "HR", "svg", "SVG", "MATH", "LINK", "META"]);
  const ICON_FONT = /icon|awesome|material|symbol|glyph|dashicons|octicon|fontello|ionicons/i;
  const MONO = /mono|courier|consolas|menlo|code/i;
  const LIMIT = 12000;

  let styleEl = null;
  let observer = null;
  let state = null;

  // ---------- colour helpers ----------
  const ctx = document.createElement("canvas").getContext("2d");
  function parse(value) {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }
  function normalise(value) {
    if (typeof value !== "string" || !CSS.supports("color", value)) return null;
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    const v = ctx.fillStyle;
    if (v.startsWith("#")) return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 };
    return parse(v);
  }
  const hex = (c) => `#${[c.r, c.g, c.b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
  const keyOf = (c) => `${c.r},${c.g},${c.b}`;
  const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function lum({ r, g, b }) {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function contrast(a, b) {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }
  const chroma = ({ r, g, b }) => Math.max(r, g, b) - Math.min(r, g, b);
  function hue({ r, g, b }) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  const chromatic = (c) => chroma(c) > 40;
  function readable(fg, bg, min) {
    if (contrast(fg, bg) >= min) return fg;
    const black = { r: 12, g: 12, b: 16 }, white = { r: 255, g: 255, b: 255 };
    const target = contrast(black, bg) > contrast(white, bg) ? black : white;
    for (let t = 0.15; t <= 1; t += 0.15) {
      const c = mix(fg, target, t);
      if (contrast(c, bg) >= min) return c;
    }
    return target;
  }

  // ---------- page walk ----------
  function* elements(root = document.body) {
    if (!root) return;
    const stack = [root];
    let n = 0;
    while (stack.length && n < LIMIT) {
      const el = stack.pop();
      if (el.nodeType !== 1 || SKIP.has(el.tagName) || el.hasAttribute("data-remodel-ui")) continue;
      n++;
      yield el;
      for (let i = el.children.length - 1; i >= 0; i--) stack.push(el.children[i]);
    }
  }

  function directText(el) {
    let s = "";
    for (const node of el.childNodes) if (node.nodeType === 3) s += node.textContent;
    return s.trim();
  }

  function ownBackground(cs) {
    if (/url\(/.test(cs.backgroundImage)) return null;
    const c = parse(cs.backgroundColor);
    return c && c.a > 0.35 ? c : null;
  }

  const gradientOf = (cs) => (/gradient\(/.test(cs.backgroundImage) && !/url\(/.test(cs.backgroundImage) ? cs.backgroundImage : null);

  function hasBorder(cs) {
    return ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none");
  }

  function roleOf(el, cs, rect, bg, parentBg, text, bodySize) {
    const tag = el.tagName;
    const roles = [];
    const distinct = bg && (!parentBg || keyOf(bg) !== keyOf(parentBg));
    const fontSize = parseFloat(cs.fontSize);
    if (tag === "INPUT" ? !/^(checkbox|radio|range|color|file|hidden|image)$/i.test(el.type) && !/^(submit|button|reset)$/i.test(el.type) : tag === "TEXTAREA" || tag === "SELECT") roles.push("input");
    else if (tag === "BUTTON" || (tag === "INPUT" && /^(submit|button|reset)$/i.test(el.type)) || el.getAttribute("role") === "button"
      || (tag === "A" && (distinct || hasBorder(cs)) && rect.height <= 64 && el.textContent.trim().length <= 40 && rect.width < 360)) roles.push("button");
    else if (/^H[1-6]$/.test(tag) || el.getAttribute("role") === "heading" || (text && text.length <= 120 && fontSize >= bodySize * 1.5)) roles.push("heading");
    else if (distinct && rect.height <= 30 && rect.width <= 180 && /^\S.{0,23}$/s.test(el.textContent.trim())) roles.push("badge");
    else if ((distinct || cs.boxShadow !== "none" || hasBorder(cs)) && rect.width >= 140 && rect.height >= 60 && rect.width <= innerWidth * 0.92 && el.children.length) roles.push("card");
    if (tag === "A" && !roles.includes("button")) roles.push("link");
    return roles;
  }

  // Reads the page's original look. Must run while no reskin is active.
  function census() {
    const bgArea = new Map(), fgWeight = new Map(), fonts = new Map(), sizes = [];
    const items = [];
    const eff = new WeakMap();
    const htmlBg = ownBackground(getComputedStyle(document.documentElement));
    const bodyBg = document.body ? ownBackground(getComputedStyle(document.body)) : null;
    const pageBg = bodyBg || htmlBg || { r: 255, g: 255, b: 255, a: 1 };
    for (const el of elements()) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const parent = el.parentElement;
      const parentBg = (parent && eff.get(parent)) || pageBg;
      const bg = ownBackground(cs);
      eff.set(el, bg || parentBg);
      const rect = el.getBoundingClientRect();
      const fg = parse(cs.color);
      const text = directText(el);
      const pcs = parent ? getComputedStyle(parent) : null;
      if (bg) bgArea.set(keyOf(bg), (bgArea.get(keyOf(bg)) || 0) + Math.min(rect.width * rect.height, innerWidth * innerHeight * 3));
      if (text && fg) {
        fgWeight.set(keyOf(fg), (fgWeight.get(keyOf(fg)) || 0) + text.length);
        fonts.set(cs.fontFamily, (fonts.get(cs.fontFamily) || 0) + text.length);
        sizes.push([parseFloat(cs.fontSize), text.length]);
      }
      items.push({
        el, cs, rect, text,
        bg, parentBg,
        fg: fg && (!pcs || pcs.color !== cs.color || el === document.body || text) ? fg : null,
        border: hasBorder(cs) ? parse(cs.borderTopColor) : null,
        shadow: cs.boxShadow !== "none",
        gradient: gradientOf(cs),
      });
    }
    let bodySize = 16;
    if (sizes.length) {
      sizes.sort((a, b) => a[0] - b[0]);
      const total = sizes.reduce((s, x) => s + x[1], 0);
      let acc = 0;
      for (const [size, w] of sizes) if ((acc += w) >= total / 2) { bodySize = size; break; }
    }
    const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);
    const fromKey = (k) => { const [r, g, b] = k.split(",").map(Number); return { r, g, b, a: 1 }; };
    const fgRanked = top(fgWeight);
    const readableOnPage = (k) => !chromatic(fromKey(k)) && contrast(fromKey(k), pageBg) >= 3;
    const pageText = fromKey(fgRanked.find(([k]) => readableOnPage(k))?.[0] || (lum(pageBg) > 0.4 ? "17,17,17" : "240,240,240"));
    const headingEl = items.find((it) => /^H[1-3]$/.test(it.el.tagName) && it.text);
    const bodyFont = top(fonts)[0]?.[0] || getComputedStyle(document.body).fontFamily;
    const headingFont = headingEl ? { family: headingEl.cs.fontFamily, weight: headingEl.cs.fontWeight } : { family: bodyFont, weight: "700" };
    // Hue groups of chromatic colours, weighted by area (backgrounds) and text (foregrounds).
    const hues = new Map();
    const addHue = (k, w) => {
      const c = fromKey(k);
      if (!chromatic(c)) return;
      const bucket = Math.round(hue(c) / 30) % 12;
      hues.set(bucket, (hues.get(bucket) || 0) + w);
    };
    for (const [k, w] of bgArea) addHue(k, w / 400);
    for (const [k, w] of fgWeight) addHue(k, w);
    const hueRank = top(hues).map(([b]) => b);
    return { items, pageBg, pageText, bodySize, bgArea: top(bgArea), fgWeight: fgRanked, fonts: top(fonts), hueRank, bodyFont, headingFont };
  }

  function summary(c) {
    const share = (list) => {
      const total = list.reduce((s, x) => s + x[1], 0) || 1;
      return list.slice(0, 8).map(([k, w]) => {
        const [r, g, b] = k.split(",").map(Number);
        return `${hex({ r, g, b })} ${Math.round((w / total) * 100)}%`;
      });
    };
    const roles = {};
    for (const it of c.items) for (const r of roleOf(it.el, it.cs, it.rect, it.bg, it.parentBg, it.text, c.bodySize)) roles[r] = (roles[r] || 0) + 1;
    return {
      pageBackground: hex(c.pageBg),
      bodyText: hex(c.pageText),
      dark: lum(c.pageBg) < 0.2,
      backgrounds: share(c.bgArea),
      textColours: share(c.fgWeight),
      fonts: c.fonts.slice(0, 3).map(([f]) => f.split(",")[0].replace(/["']/g, "").trim()),
      bodyFontSize: c.bodySize,
      elements: roles,
    };
  }

  // ---------- spec ----------
  function sanitise(spec) {
    const p = spec.palette || {};
    const col = (v, fb) => normalise(v) || fb;
    const bg = col(p.bg, { r: 250, g: 250, b: 248, a: 1 });
    const text = col(p.text, lum(bg) > 0.4 ? { r: 20, g: 20, b: 24, a: 1 } : { r: 240, g: 240, b: 236, a: 1 });
    const primary = col(p.primary, { r: 80, g: 70, b: 240, a: 1 });
    const pal = {
      bg, text, primary,
      surface: col(p.surface, mix(bg, text, 0.04)),
      muted: col(p.muted, mix(bg, text, 0.62)),
      border: col(p.border, mix(bg, text, 0.16)),
      accent: col(p.accent, primary),
      link: col(p.link, primary),
    };
    pal.onPrimary = readable(col(p.onPrimary, lum(primary) > 0.45 ? { r: 15, g: 15, b: 20, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }), primary, 4.5);
    const font = (v) => (typeof v === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(v.trim()) ? v.trim() : null);
    const num = (v, lo, hi, fb) => (Number.isFinite(+v) ? clamp(+v, lo, hi) : fb);
    const shadow = (v) => (typeof v === "string" && v.length < 160 && (v === "none" || CSS.supports("box-shadow", v)) ? v : "none");
    const h = spec.heading || {};
    return {
      name: String(spec.name || "Reskin").slice(0, 40),
      thesis: String(spec.thesis || "").slice(0, 300),
      palette: pal,
      fonts: { heading: font(spec.fonts?.heading), body: font(spec.fonts?.body) },
      heading: {
        weight: Math.round(num(h.weight, 100, 900, 700) / 100) * 100,
        case: h.case === "uppercase" ? "uppercase" : "none",
        tracking: typeof h.tracking === "string" && /^-?\d*\.?\d+em$/.test(h.tracking) ? `${clamp(parseFloat(h.tracking), -0.06, 0.2)}em` : "normal",
        style: h.style === "italic" ? "italic" : "normal",
      },
      radius: {
        card: num(spec.radius?.card, 0, 32, 12),
        button: num(spec.radius?.button, 0, 999, 10),
        input: num(spec.radius?.input, 0, 20, 8),
        badge: num(spec.radius?.badge, 0, 999, 999),
      },
      card: { shadow: shadow(spec.card?.shadow), ring: Boolean(spec.card?.ring) },
      button: { shadow: shadow(spec.button?.shadow) },
      link: { underline: spec.link?.underline !== false },
      raw: spec,
    };
  }

  // ---------- colour mapping ----------
  function mapper(c, pal) {
    const Lbg = lum(c.pageBg), Ltx = lum(c.pageText);
    const span = Math.abs(Ltx - Lbg) < 0.05 ? null : Ltx - Lbg;
    const rel = (col) => (span ? (lum(col) - Lbg) / span : 0.5);
    const slots = [pal.primary, pal.accent];
    const hueSlot = (col) => {
      const bucket = Math.round(hue(col) / 30) % 12;
      const i = c.hueRank.indexOf(bucket);
      return i === 0 ? 0 : i === 1 ? 1 : i < 0 ? 1 : (i % 2);
    };
    return {
      bg(col) {
        if (chromatic(col)) {
          const target = slots[hueSlot(col)];
          const L = lum(col);
          if (L > 0.72) return mix(pal.surface, target, 0.14);
          if (L < 0.05) return mix(pal.text, target, 0.22);
          return target;
        }
        const t = rel(col);
        if (t < -0.005) return pal.surface;
        if (t < 0.02) return pal.bg;
        if (t < 0.12) return mix(pal.surface, pal.text, clamp(t * 0.6, 0.02, 0.08));
        return mix(pal.bg, pal.text, clamp(t, 0, 1));
      },
      fg(col) {
        if (chromatic(col)) return hueSlot(col) === 0 ? pal.link : pal.accent;
        const t = clamp(rel(col), 0, 1);
        if (t >= 0.8) return pal.text;
        if (t >= 0.4) return mix(pal.muted, pal.text, (t - 0.4) / 0.4);
        return mix(pal.border, pal.muted, t / 0.4);
      },
      border(col) {
        if (chromatic(col)) return slots[hueSlot(col)];
        const t = clamp(rel(col), 0, 1);
        return t > 0.5 ? mix(pal.border, pal.text, (t - 0.5) * 1.4) : pal.border;
      },
    };
  }

  // ---------- metric-matched fonts ----------
  // A new font is registered a second time with size-adjust and ascent/descent overrides computed so that
  // its average advance width and line metrics equal the font it replaces. Text then wraps where it did.
  const SAMPLE = "The quick brown fox jumps over the lazy dog. Hamburgefonstiv 0123456789, Sphinx of black quartz!";
  function metrics(fontCss) {
    ctx.font = fontCss;
    const m = ctx.measureText(SAMPLE);
    return { width: m.width, ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent };
  }

  let faceSerial = 0;
  async function matchedFamily(faces, rawName, original, weight) {
    for (const f of faces) {
      if (![...document.fonts].some((d) => d.family === rawName && d.weight === f.weight && d.style === f.style)) {
        document.fonts.add(await new FontFace(rawName, f.buffer, { weight: f.weight, style: f.style }).load());
      }
    }
    const before = metrics(`${original.weight} 100px ${original.family}`);
    const after = metrics(`${weight} 100px "${rawName}"`);
    if (!before.width || !after.width) return null;
    const ratio = clamp(before.width / after.width, 0.7, 1.4);
    const name = `${rawName} m${++faceSerial}`;
    const pct = (v) => `${((v / 100 / ratio) * 100).toFixed(2)}%`;
    for (const f of faces) {
      const desc = { weight: f.weight, style: f.style, sizeAdjust: `${(ratio * 100).toFixed(2)}%`, lineGapOverride: "0%" };
      if (before.ascent && before.descent) Object.assign(desc, { ascentOverride: pct(before.ascent), descentOverride: pct(before.descent) });
      document.fonts.add(await new FontFace(name, f.buffer, desc).load());
    }
    return name;
  }

  // ---------- rules ----------
  function css(spec, families) {
    const r = spec.radius;
    const pal = spec.palette;
    const ring = spec.card.ring ? `0 0 0 1px ${hex(pal.border)}` : "";
    const cardShadow = [ring, spec.card.shadow !== "none" ? spec.card.shadow : ""].filter(Boolean).join(", ") || "none";
    // Weight, tracking and case would change text widths, so headings only get them with a matched font
    // whose metrics were measured at that weight; tracking and case are left alone to keep wrapping identical.
    const bodyRule = families.body ? `[data-rm-font] { font-family: "${families.body}", ${state.originalBody} !important; }` : "";
    const headRule = families.heading
      ? `[data-rm-role~="heading"] { font-family: "${families.heading}", ${state.originalHeading} !important; font-weight: ${spec.heading.weight} !important; font-style: ${spec.heading.style} !important; }`
      : "";
    return `
      html.rm-reskin-anim, html.rm-reskin-anim * { transition: background-color .7s ease, color .7s ease, border-color .7s ease, border-radius .7s ease, box-shadow .7s ease !important; }
      html[data-rm-skin] ::selection { background: ${hex(mix(pal.primary, pal.bg, 0.55))}; color: ${hex(pal.text)}; }
      ${bodyRule}
      ${headRule}
      [data-rm-role~="card"] { border-radius: ${r.card}px !important; box-shadow: ${cardShadow} !important; }
      [data-rm-role~="button"] { border-radius: ${r.button}px !important; box-shadow: ${spec.button.shadow} !important; }
      [data-rm-role~="button"]:hover { filter: brightness(1.08) saturate(1.05); }
      [data-rm-role~="input"] { border-radius: ${r.input}px !important; }
      [data-rm-role~="input"]:focus { outline: 2px solid ${hex(pal.primary)} !important; outline-offset: 1px; }
      [data-rm-role~="badge"] { border-radius: ${r.badge}px !important; }
      a[data-rm-role~="link"] { text-decoration-line: ${spec.link.underline ? "underline" : "none"} !important; text-decoration-thickness: 1px; text-underline-offset: .18em; }
      a[data-rm-role~="link"]:hover { text-decoration-line: underline !important; }
    `;
  }

  function tag(items, map, pal, bodySize, rules, combos, eff, pageBgNew) {
    let count = 0;
    for (const it of items) {
      const { el, cs, rect, text } = it;
      if (!el.isConnected) continue;
      const parentNew = (el.parentElement && eff.get(el.parentElement)) || pageBgNew;
      const bgNew = it.bg ? map.bg(it.bg) : null;
      const effNew = bgNew || parentNew;
      eff.set(el, effNew);
      const roles = roleOf(el, cs, rect, it.bg, it.parentBg, text, bodySize);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      let fgNew = null;
      if (it.fg) {
        const onBrand = bgNew && (keyOf(bgNew) === keyOf(pal.primary) || keyOf(bgNew) === keyOf(pal.accent));
        fgNew = readable(onBrand ? pal.onPrimary : map.fg(it.fg), effNew, large ? 3 : 4.5);
      }
      const bdNew = it.border ? map.border(it.border) : null;
      const decls = [];
      if (bgNew) decls.push(`background-color:${hex(bgNew)}!important`);
      if (it.gradient) {
        // Keep each stop's alpha so fades and overlays stay fades.
        const g = it.gradient.replace(/rgba?\([^)]+\)/g, (m) => {
          const c = parse(m);
          const n = map.bg(c);
          return `rgba(${Math.round(n.r)}, ${Math.round(n.g)}, ${Math.round(n.b)}, ${c.a})`;
        });
        if (g.length < 600) decls.push(`background-image:${g}!important`);
      }
      if (fgNew) decls.push(`color:${hex(fgNew)}!important`, `-webkit-text-fill-color:${hex(fgNew)}!important`);
      if (bdNew) decls.push(`border-color:${hex(bdNew)}!important`);
      if (roles.includes("input") && !bgNew) decls.push(`background-color:${hex(pal.surface)}!important`);
      if (decls.length) {
        const combo = decls.join(";");
        let id = combos.get(combo);
        if (id === undefined) {
          id = combos.size;
          combos.set(combo, id);
          rules.push(`[data-rm-k="${id}"]{${combo}}`);
        }
        el.setAttribute("data-rm-k", id);
        count++;
      }
      if (roles.length) el.setAttribute("data-rm-role", roles.join(" "));
      if (text && !ICON_FONT.test(cs.fontFamily) && !ICON_FONT.test(el.className?.baseVal ?? el.className) && !MONO.test(cs.fontFamily) && !/[\uE000-\uF8FF]/.test(text)) {
        el.setAttribute("data-rm-font", "");
      }
    }
    return count;
  }

  function render() {
    styleEl.textContent = state.base + state.rules.join("\n");
  }

  // ---------- public ----------
  async function apply(rawSpec, loadFont) {
    remove();
    const spec = sanitise(rawSpec);
    const c = census();
    const families = {};
    const originals = { body: { family: c.bodyFont, weight: "400" }, heading: c.headingFont };
    await Promise.all(["heading", "body"].map(async (k) => {
      const name = spec.fonts[k];
      if (!name || !loadFont) return;
      try {
        const faces = await loadFont(name);
        if (faces?.length) families[k] = await matchedFamily(faces, `RM ${name}`, originals[k], k === "heading" ? spec.heading.weight : 400);
      } catch {}
    }));
    const map = mapper(c, spec.palette);
    const pageBgNew = map.bg(c.pageBg);
    state = { spec, map, bodySize: c.bodySize, rules: [], combos: new Map(), eff: new WeakMap(), pageBgNew, families, originalBody: c.bodyFont, originalHeading: c.headingFont.family };
    state.base = css(spec, families);
    // The page itself and the root element.
    const rootDecl = `html[data-rm-skin], html[data-rm-skin] body { background-color: ${hex(pageBgNew)} !important; color: ${hex(readable(map.fg(c.pageText), pageBgNew, 4.5))} !important; }`;
    state.base += rootDecl;
    styleEl = document.createElement("style");
    styleEl.setAttribute("data-remodel-ui", "");
    const count = tag(c.items, map, spec.palette, c.bodySize, state.rules, state.combos, state.eff, pageBgNew);
    document.documentElement.classList.add("rm-reskin-anim");
    document.documentElement.setAttribute("data-rm-skin", "");
    render();
    (document.head || document.documentElement).append(styleEl);
    setTimeout(() => document.documentElement.classList.remove("rm-reskin-anim"), 900);
    watch();
    api.applied = true;
    api.enabled = true;
    return { count, roles: c.items.length, spec };
  }

  // New content (infinite scroll, single-page-app navigation) is styled as it arrives. Inherited colours
  // already match the new skin, so only elements with their own explicit colours are remapped.
  function watch() {
    let pending = [];
    let timer = 0;
    observer = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.hasAttribute("data-remodel-ui")) pending.push(n);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const roots = pending.filter((n) => n.isConnected);
        pending = [];
        if (!state || !roots.length) return;
        const items = [];
        for (const root of roots) {
          for (const el of elements(root)) {
            if (el.hasAttribute("data-rm-k") || el.hasAttribute("data-rm-role")) continue;
            const cs = getComputedStyle(el);
            if (cs.display === "none") continue;
            const parent = el.parentElement;
            const pcs = parent ? getComputedStyle(parent) : null;
            const fg = parse(cs.color);
            const text = directText(el);
            items.push({
              el, cs, rect: el.getBoundingClientRect(), text,
              bg: ownBackground(cs), parentBg: null,
              fg: fg && pcs && pcs.color !== cs.color ? fg : null,
              border: hasBorder(cs) ? parse(cs.borderTopColor) : null,
              gradient: gradientOf(cs),
            });
          }
        }
        const before = state.rules.length;
        tag(items, state.map, state.spec.palette, state.bodySize, state.rules, state.combos, state.eff, state.pageBgNew);
        if (state.rules.length !== before) render();
      }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function remove() {
    observer?.disconnect();
    observer = null;
    styleEl?.remove();
    styleEl = null;
    state = null;
    document.documentElement.removeAttribute("data-rm-skin");
    document.querySelectorAll("[data-rm-k], [data-rm-role], [data-rm-font]").forEach((el) => {
      el.removeAttribute("data-rm-k");
      el.removeAttribute("data-rm-role");
      el.removeAttribute("data-rm-font");
    });
    api.applied = false;
    api.enabled = false;
  }

  function setEnabled(on) {
    if (!styleEl) return;
    styleEl.media = on ? "all" : "not all";
    document.documentElement.toggleAttribute("data-rm-skin", on);
    api.enabled = on;
  }

  const api = {
    analyze() { return summary(census()); },
    apply, remove, setEnabled,
    applied: false,
    enabled: false,
  };
  window.RemodelReskin = api;
})();

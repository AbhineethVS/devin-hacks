// Runs AI-written renderer code. This page is an MV3 sandbox: eval is allowed, extension APIs are not.

const root = document.getElementById("rm");
const styleEl = document.getElementById("rm-style");
const runtimeStyle = document.getElementById("rm-runtime-style");
const director = document.getElementById("rm-director");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const send = (msg) => parent.postMessage({ source: "remodel-sandbox", ...msg }, "*");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let cleanupRuntime = () => {};
let lastData = null;
let reviewScrollY = 0;

runtimeStyle.textContent = `
  #rm { overflow-x: clip; }
  :where([data-rm-section]) { scroll-margin-top: 88px; }
  [data-rm-reveal]:not(.rm-seen) { opacity: 0; }
  #rm-director { position: fixed; z-index: 2147483647; display: none; align-items: center; gap: 7px; max-width: 280px;
    border: 1px solid rgba(255,255,255,.28); border-radius: 999px; padding: 8px 12px; background: #111; color: #fff;
    box-shadow: 0 8px 30px rgba(0,0,0,.28); font: 700 12px/1 system-ui,sans-serif; cursor: pointer; }
  #rm-director.on { display: flex; }
  #rm-director span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-rm-section].rm-target { outline: 2px dashed color-mix(in srgb, currentColor 55%, transparent); outline-offset: -3px; }
  .rm-leaving #rm { opacity: 0; transition: opacity .18s ease; }
  .rm-capturing #rm-director { display: none !important; }
  .rm-capturing [data-rm-section].rm-target { outline: none !important; }
  @keyframes rm-scrub-zoom { from { scale: 1.18; } to { scale: 1; } }
  @keyframes rm-scrub-rise { from { translate: 0 80px; opacity: .3; } to { translate: 0 0; opacity: 1; } }
  @keyframes rm-scrub-drift { from { translate: -4% 0; } to { translate: 4% 0; } }
  @keyframes rm-scrub-fade { from { opacity: .15; } to { opacity: 1; } }
  @keyframes rm-scrub-unmask { from { clip-path: inset(16% 16% 16% 16%); } to { clip-path: inset(0 0 0 0); } }
  @media (prefers-reduced-motion: no-preference) {
    html:not(.rm-capturing) { scroll-behavior: smooth; }
    @supports (animation-timeline: view()) {
      [data-rm-scrub] { animation-timing-function: linear; animation-fill-mode: both; animation-timeline: view(); }
      [data-rm-scrub="zoom"] { animation-name: rm-scrub-zoom; animation-range: entry 0% cover 60%; }
      [data-rm-scrub="rise"] { animation-name: rm-scrub-rise; animation-range: entry 0% cover 40%; }
      [data-rm-scrub="drift"] { animation-name: rm-scrub-drift; animation-range: cover 0% cover 100%; }
      [data-rm-scrub="fade"] { animation-name: rm-scrub-fade; animation-range: entry 0% cover 35%; }
      [data-rm-scrub="unmask"] { animation-name: rm-scrub-unmask; animation-range: entry 0% cover 45%; }
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-rm-reveal] { opacity: 1 !important; }
    [data-rm-parallax] { translate: none !important; }
  }
`;

// ---------- hard validation: a render that fails these is rejected and repaired ----------
function validate(data) {
  const visibleText = root.textContent.replace(/\s+/g, " ").trim();
  if (visibleText.length < 160) throw new Error("render(data) produced almost no visible text.");
  if (data.site === "Wikipedia" && data.sections?.length) {
    const rendered = new Set([...root.querySelectorAll("[data-rm-section]")].map((el) => el.dataset.rmSection));
    const missing = data.sections.filter((section) => !rendered.has(section.id));
    if (missing.length) throw new Error(`Renderer omitted ${missing.length} article section(s): ${missing.slice(0, 4).map((s) => s.title).join(", ")}`);
  }
  if (data.site === "IRCTC") {
    const form = root.querySelector('[data-bound-form="train-search"]');
    if (!form) throw new Error('IRCTC renderer must include <form data-bound-form="train-search">.');
    const rendered = new Set([...form.querySelectorAll("[data-bind]")].map((el) => el.dataset.bind));
    const required = [data.booking?.from, data.booking?.to, data.booking?.date, data.booking?.submit].filter(Boolean);
    const missing = required.filter((control) => !rendered.has(control.id));
    if (missing.length) throw new Error(`IRCTC booking form omitted: ${missing.map((control) => control.label).join(", ")}.`);
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 24) {
    throw new Error("Renderer causes horizontal page overflow.");
  }
}

// ---------- soft audit: findings are handed to the AI reviewer, not thrown ----------
function parseRgb(value) {
  const m = value.match(/^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)$/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

function luminance({ r, g, b }) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Background colour behind an element; null when an image or gradient makes it unknowable.
function backgroundOf(el) {
  for (let node = el; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== "none") return null;
    const bg = parseRgb(style.backgroundColor);
    if (bg && bg.a > 0.9) return bg;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function textElements(limit) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && out.length < limit; node = walker.nextNode()) {
    const el = node.parentElement;
    if (el && node.textContent.trim().length >= 15 && out[out.length - 1] !== el) out.push(el);
  }
  return out;
}

async function settleImages(timeout) {
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  await Promise.race([Promise.all(pending.map((img) => img.decode().catch(() => {}))), wait(timeout)]);
}

async function audit() {
  await Promise.race([document.fonts?.ready, wait(1500)]);
  await settleImages(2500);
  const issues = [];
  const add = (severity, where, problem, fix) => issues.length < 14 && issues.push({ severity, where, problem, fix, source: "automated check" });

  const placeholders = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (/^(undefined|null|NaN)$/.test(text) || /\[object Object\]|lorem ipsum/i.test(text)) placeholders.push(text.slice(0, 40));
  }
  if (placeholders.length) {
    add("high", `${placeholders.length} text node(s)`, `Placeholder or debugging text is visible: ${[...new Set(placeholders)].slice(0, 4).join(", ")}.`, "Guard missing fields and never print undefined, null, NaN or objects.");
  }

  const sectionWords = new Map((lastData?.sections || []).map((s) => [s.id, s.wordCount || 0]));
  root.querySelectorAll("[data-rm-section]").forEach((section) => {
    const title = section.dataset.rmTitle || section.dataset.rmSection;
    const style = getComputedStyle(section);
    if (section.textContent.replace(/\s+/g, " ").trim().length < 40 && (sectionWords.get(section.dataset.rmSection) || 0) > 20) {
      add("high", `Section "${title}"`, "The section renders almost none of its article text.", "Render every block of the section.");
    } else if (style.display === "none" || style.visibility === "hidden" || section.getBoundingClientRect().height < 24) {
      add("medium", `Section "${title}"`, "The section is not visible by default.", "If this is a tab or collapsible, make it obvious how to open it; otherwise show it.");
    }
  });

  if (lastData?.generic && lastData.sections?.length) {
    const rendered = new Set([...root.querySelectorAll("[data-rm-section]")].map((el) => el.dataset.rmSection));
    const missing = lastData.sections.filter((s) => !rendered.has(s.id));
    if (missing.length) {
      add(missing.length > lastData.sections.length / 2 ? "high" : "medium", `${missing.length} section(s)`,
        `Sections are missing or lack data-rm-section: ${missing.slice(0, 4).map((s) => s.title || s.id).join(", ")}.`,
        "Render every section with id, data-rm-section and data-rm-title.");
    }
  }

  // Tall stretches where all content sits to one side of a wide page, leaving a large empty band.
  if (innerWidth >= 1100) {
    const content = [...root.querySelectorAll("img, p, h1, h2, h3, h4, li, a, button, td, figure")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const tall = [...root.querySelectorAll("[data-rm-section], section, article, main")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height > 500);
    for (const { el, r: band } of tall) {
      const inBand = content.filter((r) => Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top) > r.height * 0.5);
      if (inBand.length < 4) continue;
      const left = Math.min(...inBand.map((r) => r.left));
      const right = Math.max(...inBand.map((r) => r.right));
      const used = (right - left) / innerWidth;
      if (used < 0.62 && Math.abs(left - (innerWidth - right)) > innerWidth * 0.25) {
        add("high", `Section "${el.dataset.rmTitle || el.id || el.tagName.toLowerCase()}"`,
          `Its content only spans ${Math.round(used * 100)}% of the ${innerWidth}px-wide page (x ${Math.round(left)}–${Math.round(right)}px), leaving a large empty band beside it.`,
          "Check grid-template-columns and grid-column placement so content fills the layout, or centre a deliberate reading column.");
        break;
      }
    }
  }

  root.querySelectorAll("img").forEach(capImage);
  if (shrunkImages) {
    add(shrunkImages >= 3 ? "high" : "medium", `${shrunkImages} small image(s)`,
      "Icons, badges, logos or avatars were drawn far larger than their real size; the runtime shrank them, which can leave empty frames or odd gaps.",
      "Render icon/thumb images near their w (at most 1.5×), show icons blocks as an inline wrapped row, and give icon-role card images a small avatar slot instead of a cover.");
  }

  const broken = [...root.querySelectorAll("img[src]")].filter((img) => img.complete && img.naturalWidth === 0);
  if (broken.length) add("medium", `${broken.length} image(s)`, "Images failed to load and may leave empty frames.", "Collapse image frames or show a designed fallback when an image is missing.");

  const elements = textElements(400);
  const tiny = elements.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11);
  if (tiny.length >= 3) add("medium", `${tiny.length} text element(s)`, `Text is smaller than 11px, e.g. "${tiny[0].textContent.trim().slice(0, 50)}".`, "Raise small text to at least 12px.");

  const lowContrast = elements.filter((el) => {
    const fg = parseRgb(getComputedStyle(el).color);
    const bg = backgroundOf(el);
    if (!fg || !bg || fg.a < 0.5) return false;
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05) < 3;
  });
  if (lowContrast.length >= 3) add("medium", `${lowContrast.length} text element(s)`, `Text contrast is below 3:1, e.g. "${lowContrast[0].textContent.trim().slice(0, 50)}".`, "Darken or lighten text so it reads clearly against its background.");

  const insideScroller = (el) => {
    for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
    }
    return false;
  };
  const clipped = elements.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -4 || rect.right > innerWidth + 4) && !insideScroller(el);
  });
  if (clipped.length) add("medium", `${clipped.length} text element(s)`, `Text runs past the edge of the page, e.g. "${clipped[0].textContent.trim().slice(0, 50)}".`, "Constrain widths so text stays inside the viewport, unless it is purely decorative.");

  return issues;
}

// ---------- motion runtime ----------
const REVEALS = {
  up: { transform: ["translateY(42px)", "none"] },
  down: { transform: ["translateY(-42px)", "none"] },
  left: { transform: ["translateX(-42px)", "none"] },
  right: { transform: ["translateX(42px)", "none"] },
  scale: { transform: ["scale(.94)", "none"] },
  mask: { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"] },
  blur: { filter: ["blur(14px)", "blur(0)"] },
};

// Web Animations keep reveals independent of the renderer's own CSS transitions. Transforms are
// composited additively so a rotated or scaled element keeps its own transform.
function playReveal(el) {
  el.classList.add("rm-seen");
  if (reducedMotion()) return;
  const spec = REVEALS[el.dataset.rmReveal] || REVEALS.up;
  const delay = Number(el.dataset.rmDelay) || 0;
  const timing = { duration: 850, delay, easing: "cubic-bezier(.2,.75,.2,1)", fill: "backwards" };
  el.animate({ opacity: [0, 1] }, { ...timing, duration: 700 });
  for (const [property, frames] of Object.entries(spec)) {
    el.animate({ [property]: frames }, { ...timing, composite: property === "transform" ? "add" : "replace" });
  }
}

function countUp(el) {
  if (el.dataset.rmCounted) return;
  el.dataset.rmCounted = "1";
  if (reducedMotion()) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !/\d/.test(node.textContent)) node = walker.nextNode();
  if (!node) return;
  const original = node.textContent;
  const match = original.match(/-?\d[\d,]*(?:\.\d+)?/);
  const raw = match[0];
  const target = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(target) || (/^\d{4}$/.test(raw) && target >= 1500 && target <= 2100)) return;
  const decimals = (raw.split(".")[1] || "").length;
  const grouped = raw.includes(",");
  const format = (v) => (grouped ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals));
  const before = original.slice(0, match.index);
  const after = original.slice(match.index + raw.length);
  const started = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - started) / 1200);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = t < 1 ? before + format(target * eased) + after : original;
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  el._rmFinish = () => (node.textContent = original);
  requestAnimationFrame(tick);
}

function mountRuntime(data, options = {}) {
  cleanupRuntime();
  const cleanups = [];
  const reduced = reducedMotion();

  root.querySelectorAll("[data-rm-stagger]").forEach((container) => {
    [...container.children].slice(0, 24).forEach((child, i) => {
      if (!child.dataset.rmReveal) child.dataset.rmReveal = container.dataset.rmStagger || "up";
      child.dataset.rmDelay = String(Math.min(i, 10) * 70);
    });
  });

  const reveals = [...root.querySelectorAll("[data-rm-reveal]")];
  const counters = [...root.querySelectorAll("[data-rm-count]")];
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("rm-seen"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (entry.target.hasAttribute("data-rm-reveal")) playReveal(entry.target);
        if (entry.target.hasAttribute("data-rm-count")) countUp(entry.target);
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    new Set([...reveals, ...counters]).forEach((el) => observer.observe(el));
    cleanups.push(() => observer.disconnect());
  }

  const parallax = reduced ? [] : [...root.querySelectorAll("[data-rm-parallax]")];
  const progress = [...root.querySelectorAll("[data-rm-progress]")];
  const sections = [...root.querySelectorAll("[data-rm-section]")];
  const chapterLabels = [...root.querySelectorAll("[data-rm-chapter-label]")];
  const sectionTitles = new Map((data.sections || []).map((section) => [section.id, section.title]));
  const titleOf = (section) => section.dataset.rmTitle || sectionTitles.get(section.dataset.rmSection) || "";
  let activeChapter = null;
  let frame = 0;

  const setActiveChapter = (section) => {
    if (section === activeChapter) return;
    activeChapter?.removeAttribute("data-rm-active");
    activeChapter = section;
    section?.setAttribute("data-rm-active", "");
    const ids = section ? new Set([section.id, section.dataset.rmSection].filter(Boolean)) : new Set();
    root.querySelectorAll('a[href^="#"]').forEach((link) => {
      const on = ids.has(link.getAttribute("href").slice(1));
      link.classList.toggle("rm-active", on);
      if (on) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    chapterLabels.forEach((label) => (label.textContent = section ? titleOf(section) : ""));
  };

  const updateMotion = () => {
    frame = 0;
    const scrollMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ratio = clamp(scrollY / scrollMax, 0, 1);
    progress.forEach((el) => el.style.setProperty("--rm-progress", String(ratio)));
    parallax.forEach((el) => {
      const speed = clamp(Number(el.dataset.rmParallax) || 0.12, 0.05, 0.35);
      const rect = el.getBoundingClientRect();
      el.style.translate = `0 ${((rect.top + rect.height / 2 - innerHeight / 2) * -speed).toFixed(1)}px`;
    });
    let current = null;
    const line = innerHeight * 0.35;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      section.style.setProperty("--rm-section-progress", clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1).toFixed(3));
      if (rect.top <= line && rect.bottom > line) current = section;
    });
    setActiveChapter(current);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(updateMotion);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  cleanups.push(() => {
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    if (frame) cancelAnimationFrame(frame);
  });

  let activeSection = null;
  const leaveSection = () => {
    activeSection?.classList.remove("rm-target");
    activeSection = null;
    director.classList.remove("on");
  };
  const onPointerOver = (event) => {
    const section = event.target.closest?.("[data-rm-section]");
    if (!section || section === activeSection) return;
    activeSection?.classList.remove("rm-target");
    activeSection = section;
    section.classList.add("rm-target");
    const rect = section.getBoundingClientRect();
    director.querySelector("span").textContent = `Remix · ${titleOf(section) || "this chapter"}`;
    director.style.top = `${clamp(rect.top + 12, 12, innerHeight - 48)}px`;
    director.style.right = "18px";
    director.classList.add("on");
  };
  root.addEventListener("pointerover", onPointerOver);
  cleanups.push(() => root.removeEventListener("pointerover", onPointerOver));
  director.onclick = () => {
    if (!activeSection) return;
    send({ type: "select-section", section: { id: activeSection.dataset.rmSection, title: titleOf(activeSection) || "Selected chapter" } });
    leaveSection();
  };
  cleanups.push(() => {
    director.onclick = null;
    leaveSection();
  });

  cleanupRuntime = () => cleanups.splice(0).forEach((fn) => fn());

  if (options.keepScroll != null) {
    scrollTo({ top: options.keepScroll * Math.max(0, document.documentElement.scrollHeight - innerHeight), behavior: "instant" });
  } else if (options.focusSection) {
    scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => root.querySelector(`[data-rm-section="${CSS.escape(options.focusSection)}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }));
  } else {
    scrollTo({ top: 0, behavior: "instant" });
  }
  updateMotion();
}

// ---------- capture mode for the screenshot review ----------
function beginReview() {
  reviewScrollY = scrollY;
  document.documentElement.classList.add("rm-capturing");
  root.querySelectorAll("[data-rm-reveal]").forEach((el) => {
    el.classList.add("rm-seen");
    el.getAnimations().forEach((animation) => animation.finish());
  });
  root.querySelectorAll("[data-rm-count]").forEach((el) => {
    el.dataset.rmCounted = "1";
    el._rmFinish?.();
  });
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const count = max === 0 ? 1 : Math.min(4, 1 + Math.ceil(max / innerHeight));
  const positions = count === 1 ? [0] : Array.from({ length: count }, (_, i) => Math.round((max * i) / (count - 1)));
  return { positions, pageHeight: document.documentElement.scrollHeight, viewport: [innerWidth, innerHeight] };
}

async function reviewScroll(y) {
  scrollTo({ top: y, behavior: "instant" });
  await nextFrame();
  const visible = [...root.querySelectorAll("img")].filter((img) => {
    const rect = img.getBoundingClientRect();
    return !img.complete && rect.bottom > 0 && rect.top < innerHeight;
  });
  await Promise.race([Promise.all(visible.map((img) => img.decode().catch(() => {}))), wait(1500)]);
  await wait(350);
  return true;
}

function endReview() {
  document.documentElement.classList.remove("rm-capturing");
  scrollTo({ top: reviewScrollY, behavior: reducedMotion() ? "instant" : "smooth" });
  return true;
}

// ---------- image scale guard: small images are never blown up, whatever the renderer does ----------
let imageLimits = new Map();
let shrunkImages = 0;

function collectImageLimits(data) {
  const limits = new Map();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value.src === "string" && (value.role === "icon" || value.role === "thumb") && value.w) limits.set(value.src, value.w * 1.5);
    if (value.type === "icons") value.items.forEach((item) => item.src && limits.set(item.src, (value.size || 64) * 1.5));
    if (typeof value.image === "string" && value.imageRole === "icon") limits.set(value.image, 96);
    Object.values(value).forEach(visit);
  };
  visit(data);
  return limits;
}

function capImage(img) {
  if (img.dataset.rmCapped) return;
  const rect = img.getBoundingClientRect();
  if (!rect.width) return;
  const hinted = imageLimits.get(img.currentSrc) ?? imageLimits.get(img.getAttribute("src"));
  // Without a hint, only small source files are capped, so large photos keep the renderer's sizing.
  const limit = Math.max(32, hinted ?? (img.naturalWidth && img.naturalWidth < 200 ? img.naturalWidth * 1.5 : Infinity));
  if (rect.width <= limit * 1.15) return;
  img.dataset.rmCapped = "1";
  img.style.setProperty("width", `${Math.round(limit)}px`, "important");
  img.style.setProperty("max-width", `${Math.round(limit)}px`, "important");
  img.style.setProperty("height", "auto", "important");
  img.style.setProperty("object-fit", "contain", "important");
  // Centre the shrunk image in whatever frame the renderer drew for it.
  if (getComputedStyle(img).display !== "inline") {
    img.style.setProperty("margin-left", "auto", "important");
    img.style.setProperty("margin-right", "auto", "important");
    if (getComputedStyle(img.parentElement).display === "flex") img.style.setProperty("align-self", "center", "important");
  }
  shrunkImages++;
}

root.addEventListener("load", (event) => {
  if (event.target.tagName === "IMG") capImage(event.target);
}, true);

// ---------- messages from the host ----------
function renderPage(msg) {
  try {
    cleanupRuntime();
    const factory = new Function(
      "esc",
      `${msg.code}
       ;return {
         STYLE: typeof STYLE !== "undefined" ? STYLE : "",
         render: typeof render === "function" ? render : null,
         mount: typeof mount === "function" ? mount : null,
       };`
    );
    const mod = factory(esc);
    if (!mod.render) throw new Error("The code does not define render(data).");
    const colors = msg.data?.brand?.colors || {};
    for (const name of ["primary", "accent", "bg", "text"]) {
      const value = colors[name];
      if (typeof value === "string" && CSS.supports("color", value)) document.documentElement.style.setProperty(`--brand-${name}`, value);
      else document.documentElement.style.removeProperty(`--brand-${name}`);
    }
    const html = mod.render(msg.data);
    const options = { ...msg.options };
    if (options.keepScroll) options.keepScroll = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    else delete options.keepScroll;
    styleEl.textContent = mod.STYLE;
    root.innerHTML = html;
    lastData = msg.data;
    validate(msg.data);
    let mountWarning = "";
    try {
      if (mod.mount) mod.mount(root);
    } catch (err) {
      mountWarning = `Optional mount() failed: ${String(err)}`;
    }
    mountRuntime(msg.data, options);
    imageLimits = collectImageLimits(msg.data);
    shrunkImages = 0;
    root.querySelectorAll("img").forEach(capImage);
    send({ type: "rendered", warning: mountWarning });
  } catch (err) {
    send({ type: "render-error", message: String((err && err.stack) || err).slice(0, 1500) });
  }
}

const CALLS = {
  audit: () => audit(),
  "review-begin": () => beginReview(),
  "review-scroll": (msg) => reviewScroll(msg.y),
  "review-end": () => endReview(),
};

window.addEventListener("message", async (event) => {
  const msg = event.data;
  if (event.source !== parent || !msg) return;
  if (msg.type === "render") return renderPage(msg);
  if (msg.type === "bound-status") {
    let targets = [...root.querySelectorAll("[data-rm-form-status]")];
    if (!targets.length) {
      const form = root.querySelector("[data-bound-form]");
      if (form) {
        const status = document.createElement("p");
        status.dataset.rmFormStatus = "";
        status.setAttribute("role", "status");
        form.append(status);
        targets = [status];
      }
    }
    targets.forEach((el) => {
      el.textContent = msg.text || "";
      el.toggleAttribute("data-error", Boolean(msg.isError));
    });
    return;
  }
  const call = CALLS[msg.type];
  if (!call || !msg.id) return;
  try {
    send({ type: "reply", id: msg.id, result: await call(msg) });
  } catch (err) {
    send({ type: "reply", id: msg.id, error: String((err && err.message) || err) });
  }
});

// Bridge: links and search go back to the real page.
const sendBoundInput = (event) => {
  const control = event.target.closest?.("[data-bind]");
  if (!control || !control.closest("[data-bound-form]")) return;
  send({
    type: "bound-input",
    id: control.dataset.bind,
    event: event.type,
    key: event.inputType || "",
    value: control.value,
    checked: control.checked,
  });
};
document.addEventListener("input", sendBoundInput);
document.addEventListener("change", sendBoundInput);

document.addEventListener("click", (event) => {
  const control = event.target.closest?.("[data-bind]");
  if (control && !control.closest("[data-bound-form]") && !control.matches("input, select, textarea")) {
    event.preventDefault();
    send({ type: "bound-click", id: control.dataset.bind });
    return;
  }
  const a = event.target.closest("a[href]");
  if (!a) return;
  const raw = a.getAttribute("href");
  if (raw.startsWith("#")) return; // in-page anchor, let it scroll
  event.preventDefault();
  if (!/^https?:/.test(a.href)) return;
  const newTab = event.ctrlKey || event.metaKey;
  if (newTab || reducedMotion()) return send({ type: "navigate", href: a.href, newTab });
  document.documentElement.classList.add("rm-leaving");
  setTimeout(() => send({ type: "navigate", href: a.href, newTab: false }), 180);
  setTimeout(() => document.documentElement.classList.remove("rm-leaving"), 1500);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.matches("[data-search]")) {
    event.preventDefault();
    const q = new FormData(form).get("q");
    if (q) send({ type: "search", q: String(q) });
  } else if (form.matches("[data-bound-form]")) {
    event.preventDefault();
    const controls = [...form.querySelectorAll("[data-bind]")];
    const fields = controls.filter((el) => !el.matches('[type="submit"],button')).map((el) => ({
      id: el.dataset.bind,
      value: el.value,
      checked: el.checked,
    }));
    const stationIds = controls.filter((el) => /^(from|to)$/i.test(el.name)).map((el) => el.dataset.bind);
    const submit = event.submitter?.dataset.bind
      ? event.submitter
      : form.querySelector('button[type="submit"][data-bind],input[type="submit"][data-bind]');
    send({ type: "bound-submit", form: form.dataset.boundForm, fields, stationIds, submitId: submit?.dataset.bind || "" });
  }
});

window.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "r") send({ type: "toggle" });
});

send({ type: "ready" });

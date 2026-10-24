// Throwaway test: can screenshot + URL + generic outline produce a good redesign of an unknown site?
// usage: node generic-test.mjs <model> "<style prompt>" <url> <tag>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { OPENAI_API_KEY } from "./env.mjs";

const [model, stylePrompt, url, tag] = process.argv.slice(2);
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out/generic");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- generic extractor (runs in the page) ----------
function genericExtract() {
  const T = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  let nextId = 1;
  const control = (el, kind) => { el.dataset.rmId = `el_${nextId}`; return { type: "control", id: `el_${nextId++}`, kind, label: T(el) || el.getAttribute("aria-label") || el.placeholder || el.value || "", href: el.href || null }; };

  const nav = [...document.querySelectorAll("header a, nav a")].filter(visible).map((a) => ({ text: T(a), href: abs(a.getAttribute("href")) })).filter((l) => l.text && l.href).slice(0, 20);
  const footer = [...document.querySelectorAll("footer a")].filter(visible).map((a) => ({ text: T(a), href: abs(a.getAttribute("href")) })).filter((l) => l.text).slice(0, 20);

  const blocks = [];
  const seen = new Set();
  const sig = (el) => el.tagName + "." + [...el.classList].filter((c) => !/active|selected|hover/.test(c)).sort().join(".");

  // Repeated sibling patterns become card lists (event listings, product grids, post lists).
  function cardList(parent) {
    const kids = [...parent.children].filter(visible);
    if (kids.length < 3) return null;
    const counts = {};
    kids.forEach((k) => (counts[sig(k)] = (counts[sig(k)] || 0) + 1));
    const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (n < 3 || n < kids.length * 0.6) return null;
    const items = kids.filter((k) => sig(k) === best).map((k) => {
      const h = k.querySelector("h1,h2,h3,h4,h5,strong,b");
      const img = k.querySelector("img");
      const a = k.matches("a") ? k : k.querySelector("a[href]");
      const parts = [...k.querySelectorAll("p,span,small,time,li")].map(T).filter((t) => t && t.length < 160 && t !== T(h));
      return { title: T(h) || T(k).slice(0, 80), text: parts.slice(0, 6), image: img ? abs(img.currentSrc || img.src) : null, href: a ? abs(a.getAttribute("href")) : null };
    });
    if (items.filter((i) => i.title).length < 3) return null;
    kids.forEach((k) => k.querySelectorAll("*").forEach((d) => seen.add(d)));
    kids.forEach((k) => seen.add(k));
    return { type: "cards", items: items.slice(0, 40) };
  }

  const root = document.querySelector("main") || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (seen.has(el) || el.closest("header, nav, footer, script, style, noscript, svg") || !visible(el)) continue;
    const cards = el.children.length >= 3 ? cardList(el) : null;
    if (cards) { blocks.push(cards); continue; }
    const tag = el.tagName;
    if (/^H[1-4]$/.test(tag)) { blocks.push({ type: "heading", level: +tag[1], text: T(el) }); el.querySelectorAll("*").forEach((d) => seen.add(d)); }
    else if (tag === "P" && T(el).length > 2) { blocks.push({ type: "text", text: T(el) }); el.querySelectorAll("*").forEach((d) => seen.add(d)); }
    else if (tag === "IMG" && el.naturalWidth > 80) blocks.push({ type: "image", src: abs(el.currentSrc || el.src), alt: el.alt || "" });
    else if ((tag === "UL" || tag === "OL") && !el.closest("nav")) { const items = [...el.children].map(T).filter(Boolean); if (items.length) blocks.push({ type: "list", items: items.slice(0, 20) }); el.querySelectorAll("*").forEach((d) => seen.add(d)); }
    else if (tag === "BUTTON" || (tag === "A" && /btn|button|cta/i.test(el.className))) { blocks.push(control(el, tag === "A" ? "link-button" : "button")); seen.add(el); }
    else if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") blocks.push(control(el, "input"));
  }
  return {
    url: location.href, title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || "",
    nav, blocks: blocks.filter((b) => b.type !== "text" || b.text.length > 1).slice(0, 200), footer,
  };
}

const SCHEMA = `type Data = {
  url: string; title: string; description: string;
  nav: { text: string; href: string }[];
  blocks: (                                   // the page content in reading order
    | { type: "heading"; level: 1|2|3|4; text: string }
    | { type: "text"; text: string }
    | { type: "image"; src: string; alt: string }
    | { type: "list"; items: string[] }
    | { type: "cards"; items: { title: string; text: string[]; image: string|null; href: string|null }[] }  // repeated items: listings, products, posts
    | { type: "control"; id: string; kind: "button"|"link-button"|"input"; label: string; href: string|null }
  )[];
  footer: { text: string; href: string }[];
};
Controls: render them as <button data-bind="ID"> (or <input data-bind="ID">); the host forwards clicks/values to the real element.`;

const SYSTEM = `You are an award-winning art director and senior front-end engineer. You completely REBUILD web pages: new layout, new components, new typography, new colour, while keeping the real content and keeping the site's identity recognisable (its name and purpose).

You receive a SCREENSHOT of the original page (to understand what the site is, what matters and its brand), its URL, and its content as JSON.

You write a RENDERER: JavaScript that turns the content JSON into a page, so the same design works for other pages of this site.

OUTPUT FORMAT: exactly one \`\`\`js code block and nothing else, defining:
  const STYLE = \`...\`;   // all CSS; may @import Google Fonts; scope selectors under #rm
  function render(data) {...}  // returns ONE HTML string for the whole page; pure function
  function mount(root) {...}   // optional: scroll reveal, counters, tabs; no network

RULES
- esc(value) for every text field. Never hard-code content from the sample; loop over arrays; handle empty fields.
- Group the blocks intelligently (e.g. a heading + following text = a section; cards = a grid/list component).
- Make it striking and complete top to bottom. Use images when present; the layout must survive missing images.
- Add tasteful scroll motion in mount() if it fits the style.
- Include one small witty sticker or badge that fits the style and site.
- No external scripts, no fetch, no iframes.`;

// ---------- run ----------
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await sleep(2500);
await page.screenshot({ path: `${out}/${tag}_0_original.png` });
await page.screenshot({ path: `${out}/${tag}_0_original_full.png`, fullPage: true });
const shot = (await page.screenshot({ type: "jpeg", quality: 70 })).toString("base64");
const data = await page.evaluate(genericExtract);
fs.writeFileSync(`${out}/${tag}_data.json`, JSON.stringify(data, null, 1));
console.log(`[${tag}] extracted: nav=${data.nav.length} blocks=${data.blocks.length} (${[...new Set(data.blocks.map((b) => b.type))].join(",")}) cards=${data.blocks.filter((b) => b.type === "cards").map((b) => b.items.length).join("/") || 0}`);

const sample = { ...data, blocks: data.blocks.slice(0, 60).map((b) => (b.type === "cards" ? { ...b, items: b.items.slice(0, 4) } : b)) };
const t0 = Date.now();
const res = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model, instructions: SYSTEM, reasoning: { effort: "low" }, max_output_tokens: 24000,
    input: [{ role: "user", content: [
      { type: "input_text", text: `STYLE REQUEST: "${stylePrompt}"\nURL: ${url}\n\nDATA SCHEMA:\n${SCHEMA}\n\nCONTENT (trimmed sample):\n${JSON.stringify(sample, null, 1)}` },
      { type: "input_image", image_url: `data:image/jpeg;base64,${shot}` },
    ] }],
  }),
});
const json = await res.json();
if (!res.ok) { console.log("API error", JSON.stringify(json).slice(0, 400)); process.exit(1); }
const text = json.output.filter((o) => o.type === "message").flatMap((o) => o.content).map((c) => c.text || "").join("");
const code = (text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/) || [, text])[1];
fs.writeFileSync(`${out}/${tag}_renderer.js`, code);
console.log(`[${tag}] ${model} wrote ${code.length} chars in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// Render in a blank page with the same contract as the sandbox.
const r = await browser.newPage();
await r.setContent('<!doctype html><html><head><style>html,body{margin:0}</style><style id="rm-style"></style></head><body><div id="rm"></div></body></html>');
const err = await r.evaluate((code, data) => {
  try {
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const mod = new Function("esc", `${code}\n;return {STYLE: typeof STYLE!=="undefined"?STYLE:"", render, mount: typeof mount==="function"?mount:null};`)(esc);
    document.getElementById("rm-style").textContent = mod.STYLE;
    document.getElementById("rm").innerHTML = mod.render(data);
    mod.mount?.(document.getElementById("rm"));
    return null;
  } catch (e) { return String(e.stack || e); }
}, code, data);
if (err) console.log(`[${tag}] RENDER ERROR: ${err.slice(0, 300)}`);
await sleep(2500);
// Trigger scroll-reveal animations before the full-page capture.
await r.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 120)); } window.scrollTo(0, 0); });
await sleep(1200);
await r.screenshot({ path: `${out}/${tag}_1_remodel.png` });
await r.screenshot({ path: `${out}/${tag}_1_remodel_full.png`, fullPage: true });
await browser.close();

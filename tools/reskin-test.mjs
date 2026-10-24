// Applies a hand-written theme spec with the Reskin engine (no API calls) and checks that layout is unchanged.
// usage: node reskin-test.mjs <url> [fonts=1]
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://books.toscrape.com/";
const withFonts = process.argv[3] !== "0";
const name = new URL(url).hostname.replace(/^www\./, "");
const outDir = path.join(here, "../out/reskin");
await fs.mkdir(outDir, { recursive: true });

const spec = {
  name: "Midnight Press",
  thesis: "A dark editorial press look with warm amber accents.",
  palette: { bg: "#14120f", surface: "#1e1b17", text: "#f3ece0", muted: "#b5ab9b", border: "#3a342c", primary: "#f0a63a", onPrimary: "#1a1207", accent: "#e2574c", link: "#f3b961" },
  fonts: { heading: "Fraunces", body: "Source Serif 4" },
  heading: { weight: 600, case: "none", tracking: "-0.01em", style: "normal" },
  radius: { card: 14, button: 999, input: 10, badge: 999 },
  card: { shadow: "0 10px 30px rgba(0,0,0,.35)", ring: true },
  button: { shadow: "none" },
  link: { underline: false },
};

async function googleFont(family) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;600;700&display=swap`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" },
  })).text();
  const faces = [];
  for (const block of css.split("/*").slice(1)) {
    if (block.slice(0, block.indexOf("*/")).trim() !== "latin") continue;
    const src = block.match(/url\((https:[^)]+)\)/)?.[1];
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
    faces.push({ weight: block.match(/font-weight:\s*([\d ]+);/)?.[1] || "400", style: "normal", data: buf.toString("base64") });
  }
  return faces;
}

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", defaultViewport: { width: 1366, height: 860 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.exposeFunction("__font", googleFont);
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await page.screenshot({ path: path.join(outDir, `${name}-before.png`) });

const layout = () => [...document.body.querySelectorAll("*")].slice(0, 1500).map((el) => {
  const r = el.getBoundingClientRect();
  const inline = getComputedStyle(el).display.startsWith("inline");
  return [Math.round(r.left), Math.round(r.top), inline ? 0 : Math.round(r.width), Math.round(r.height), `${el.tagName}.${String(el.className?.baseVal ?? el.className).slice(0, 20)} ${el.getAttribute("data-rm-role") || ""} "${(el.textContent || "").trim().slice(0, 30)}"`];
});
const before = await page.evaluate(layout);
await page.evaluate(await fs.readFile(path.join(here, "../extension/reskin.js"), "utf8"));
const census = await page.evaluate(() => RemodelReskin.analyze());
const result = await page.evaluate(async (spec, withFonts) => {
  const load = async (family) => (await window.__font(family)).map((f) => ({
    weight: f.weight, style: f.style, buffer: Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0)).buffer,
  }));
  const r = await RemodelReskin.apply(spec, withFonts ? load : null);
  return { count: r.count, scanned: r.roles, roles: document.querySelectorAll("[data-rm-role]").length };
}, spec, withFonts);
await new Promise((r) => setTimeout(r, 1200));
const after = await page.evaluate(layout);
let moved = 0, maxShift = 0;
const examples = [];
for (let i = 0; i < Math.min(before.length, after.length); i++) {
  // Inline runs may change width by a few pixels with a new typeface; only block boxes and vertical positions count.
  const d = Math.max(...[1, 2, 3].map((j) => Math.abs(before[i][j] - after[i][j])));
  if (d > 1) {
    moved++;
    if (examples.length < 8) examples.push(`${d}px ${after[i][4]} ${before[i].slice(0, 4)} -> ${after[i].slice(0, 4)}`);
  }
  if (d > maxShift) examples.worst = `${d}px ${after[i][4]} ${before[i].slice(0, 4)} -> ${after[i].slice(0, 4)}`;
  maxShift = Math.max(maxShift, d);
}
if (examples.length) console.log([...examples, `worst: ${examples.worst}`].join("\n"));
await page.screenshot({ path: path.join(outDir, `${name}-after${withFonts ? "" : "-nofonts"}.png`) });
const toggled = await page.evaluate(() => { RemodelReskin.setEnabled(false); const bg = getComputedStyle(document.body).backgroundColor; RemodelReskin.setEnabled(true); return bg; });
await page.evaluate(() => RemodelReskin.remove());
const restored = await page.evaluate(() => document.querySelectorAll("[data-rm-k],[data-rm-role],[data-rm-font]").length);
console.log(JSON.stringify({ url, census: { bg: census.pageBackground, text: census.bodyText, fonts: census.fonts, elements: census.elements }, result, layout: { compared: before.length, moved, maxShift }, toggledOffBodyBg: toggled, leftoverAttrs: restored, errors }));
await browser.close();

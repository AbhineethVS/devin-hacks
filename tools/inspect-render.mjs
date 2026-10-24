// Re-applies a saved renderer to a page (no API calls) and reports image scale problems.
// usage: node inspect-render.mjs <url> <renderer.js> <archetype> "<prompt>" [text to scroll to]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const [url, file, archetype, prompt, find = ""] = process.argv.slice(2);
// Same key scheme as genericKey() in extension/content.js.
const promptHash = (s) => {
  let h = 5381;
  for (const c of s.trim().toLowerCase()) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};
const key = `renderer:generic:${archetype}:${promptHash(prompt)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [path.resolve(here, "../extension")],
  defaultViewport: { width: 1440, height: 900 },
});
const sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const worker = await sw.worker();
const host = new URL(url).hostname;
await worker.evaluate((key, code, host, prompt) => chrome.storage.local.set({
  [key]: { code, prompt, host: "elsewhere.example", created: Date.now() },
  [`site:${host}`]: { enabled: true, prompt },
  review: false,
}), key, fs.readFileSync(file, "utf8"), host, prompt);

const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => [...document.querySelectorAll("iframe")].some((f) => f.src.includes("sandbox.html") && f.style.opacity === "1"), { timeout: 30000 });
await sleep(2500);
const frame = page.frames().find((f) => f.url().includes("sandbox.html"));
const report = await frame.evaluate(async (find) => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise((r) => setTimeout(r, 1500));
  const imgs = [...document.querySelectorAll("#rm img")].map((img) => ({
    alt: (img.alt || img.src.split("/").pop()).slice(0, 40),
    shown: Math.round(img.getBoundingClientRect().width),
    natural: img.naturalWidth,
    capped: !!img.dataset.rmCapped,
  }));
  const target = find && [...document.querySelectorAll("#rm *")].find((el) => el.children.length === 0 && el.textContent.includes(find))
    || [...document.querySelectorAll("#rm img")].find((img) => img.alt.includes(find));
  window.scrollTo(0, target ? target.getBoundingClientRect().top + scrollY - 120 : 0);
  return imgs;
});
await sleep(1200);
await page.screenshot({ path: path.resolve(here, "../out/inspect.png") });
const issues = await frame.evaluate(() => audit());
for (const i of issues) console.log(`AUDIT [${i.severity}] ${i.where}: ${i.problem}`);
for (const i of report) console.log(`${i.capped ? "CAPPED " : "       "}${String(i.shown).padStart(5)}px shown / ${String(i.natural).padStart(4)}px natural · ${i.alt}`);
await browser.close();

// Runs the working-agent cursors on a live page and saves screenshots while they work.
// Usage: node cursors-test.mjs [url]
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://en.wikipedia.org/wiki/Kochi";
const outDir = path.join(here, "../out/cursors");
await fs.mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await page.evaluate(await fs.readFile(path.join(here, "../extension/cursors.js"), "utf8"));
await page.evaluate(() => window.RemodelCursors.start());

for (let i = 1; i <= 6; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outDir, `work-${i}.png`) });
}
const before = await page.evaluate(() => document.body.innerHTML.length);
await page.evaluate(() => window.RemodelCursors.flourish());
await new Promise((r) => setTimeout(r, 2200));
const after = await page.evaluate(() => ({ len: document.body.innerHTML.length, overlays: document.documentElement.children.length }));
console.log(JSON.stringify({ errors, pageUnchanged: before === after.len, rootChildren: after.overlays }));
await browser.close();

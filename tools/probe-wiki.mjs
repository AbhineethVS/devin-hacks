import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await b.newPage();
await p.goto("https://en.wikipedia.org/wiki/Kerala", { waitUntil: "domcontentloaded" });
console.log(await p.evaluate(() => {
  const c = document.querySelector("#mw-content-text .mw-parser-output");
  const counts = {};
  for (const el of c.children) { const k = el.tagName + (el.className ? "." + el.className.split(" ")[0] : ""); counts[k] = (counts[k] || 0) + 1; }
  const sec = c.querySelector(":scope > section");
  return JSON.stringify({ counts, firstSectionChildren: sec ? [...sec.children].slice(0, 8).map((e) => e.tagName + "." + e.className) : null }, null, 1);
}));
await b.close();

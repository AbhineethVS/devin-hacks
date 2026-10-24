// Runs the generic extractor on arbitrary URLs and prints a summary; no API calls.
// usage: node probe-generic.mjs <url> [more urls...]
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const src = fs.readFileSync(new URL("../extension/extractors.js", import.meta.url), "utf8");
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1440, height: 900 } });
const p = await b.newPage();
for (const url of process.argv.slice(2)) {
  try {
    await p.goto(url, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
    await p.evaluate(src); // evaluate, not a script tag, so strict page CSPs don't block it
    const out = await p.evaluate(() => {
      const t0 = performance.now();
      const d = RemodelExtract.extract("generic");
      const ms = Math.round(performance.now() - t0);
      const blocks = d.sections.flatMap((s) => s.blocks);
      const count = (type) => blocks.filter((b) => b.type === type).length;
      return [
        `${d.archetype.toUpperCase()} · "${d.title.slice(0, 60)}" · brand=${d.brand.name} logo=${!!d.brand.logo} colors=${JSON.stringify(d.brand.colors)}`,
        `  ${ms} ms · ${JSON.stringify(d).length} chars · words=${d.stats.wordCount} sections=${d.sections.length} nav=${d.nav.length} footer=${d.footer.length} search=${!!d.search} hero=${!!d.heroImage}`,
        `  blocks: p=${count("p")} list=${count("list")} img=${count("image")} cards=${count("cards")}(${d.stats.cardCount}) table=${count("table")} form=${count("form")} button=${count("button")} link=${count("link")}`,
        `  sections: ${d.sections.slice(0, 8).map((s) => `"${s.title.slice(0, 30)}"[${s.blocks.length}]`).join(" ")}`,
        ...blocks.filter((b) => b.type === "cards").slice(0, 2).map((b) => `  card: ${JSON.stringify(b.items[0]).slice(0, 220)}`),
        ...blocks.filter((b) => b.type === "icons").slice(0, 3).map((b) => `  icons(${b.size}px × ${b.items.length}): ${b.items.map((i) => i.alt || i.label).join(" | ").slice(0, 160)}`),
        `  images: ${blocks.filter((b) => b.type === "image").map((b) => `${b.role}:${b.w}x${b.h}`).join(" ").slice(0, 200)}`,
      ].join("\n");
    });
    console.log(`${url}\n${out}\n`);
  } catch (err) {
    console.log(`${url}\n  FAILED: ${String(err).slice(0, 200)}\n`);
  }
}
await b.close();

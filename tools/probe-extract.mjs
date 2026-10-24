import fs from "node:fs";
import puppeteer from "puppeteer-core";
const src = fs.readFileSync(new URL("../extension/extractors.js", import.meta.url), "utf8");
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await b.newPage();
for (const url of process.argv.slice(2)) {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.addScriptTag({ content: src });
  console.log(await p.evaluate(() => {
    const t = RemodelExtract.detect(); const d = RemodelExtract.extract(t.type);
    if (t.type !== "wikipedia:article") return `${t.type}: ${JSON.stringify(d).length} chars, items=${d.items?.length ?? "-"} comments=${d.comments?.length ?? "-"}`;
    const blocks = d.sections.flatMap((s) => s.blocks);
    return `${d.title}: lead=${d.lead.length} sections=${d.sections.length} [${d.sections.slice(0, 6).map((s) => s.title).join(", ")}…] p=${blocks.filter((x) => x.type === "p").length} img=${d.images.length} infobox=${d.infobox ? d.infobox.rows.length + " rows, title=" + d.infobox.title : "none"} seeAlso=${d.seeAlso.length} hero=${!!d.heroImage}`;
  }));
}
await b.close();

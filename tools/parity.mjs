import fs from "node:fs";
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await b.newPage();
await p.goto("file:///C:/Users/Abhineeth/Desktop/devin-hacks/music-test/index.html", { waitUntil: "networkidle0" });
const proto = await p.evaluate(() => {
  const T = window.__test, map = { "bubble-sort": "bubble", quicksort: "quick", "c-for-loop": "cfor", "infinite-loop": "bug" }, out = {};
  const name = { snare: "snare", kick: "kick", hat: "hat", rim: "rim", lead: "lead", bell: "bell", bass: "bass" };
  for (const [k, v] of Object.entries(map)) out[k] = T.fileSteps(T.PRESETS[v]).map((s) => s.evs.map((e) => `${name[e.i]}${e.n ? ":" + e.n : ""}`).sort().join("+"));
  return out;
});
await b.close();
const eng = JSON.parse(fs.readFileSync("C:/Users/Abhineeth/AppData/Local/Temp/engine-steps.json", "utf8"));
for (const k of Object.keys(proto)) {
  const a = proto[k], e = eng[k];
  let diff = 0, firstDiff = null;
  for (let i = 0; i < Math.max(a.length, e.length); i++) if (a[i] !== e[i]) { diff++; firstDiff ??= `#${i}: prototype "${a[i]}" vs engine "${e[i]}"`; }
  console.log(`${k.padEnd(14)} steps proto=${a.length} engine=${e.length}  differing steps=${diff}${firstDiff ? "  first: " + firstDiff : ""}`);
}

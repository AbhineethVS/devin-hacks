// End-to-end run: load the extension in Chrome, remodel a page, then visit more pages of the same type.
// usage: node run.mjs <model> "<style prompt>" <first url> [more urls...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { OPENAI_API_KEY } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const extPath = path.resolve(here, "../extension");
const outDir = path.resolve(here, "../out");
fs.mkdirSync(outDir, { recursive: true });

const [model, prompt, firstUrl, ...moreUrls] = process.argv.slice(2);
const tag = model.replace(/[^a-z0-9.-]/gi, "_");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [extPath],
  defaultViewport: { width: 1440, height: 900 },
  userDataDir: path.resolve(here, `../out/profile-${tag}`),
});

// Put the key and model into extension storage via the service worker.
const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const worker = await swTarget.worker();
await worker.evaluate((key, m) => chrome.storage.local.clear().then(() => chrome.storage.local.set({ apiKey: key, model: m })), OPENAI_API_KEY, model);

const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.log("  [page error]", m.text().slice(0, 200)));

const panelEval = (fn, arg) =>
  page.evaluate((src, arg) => {
    const host = [...document.documentElement.children].find((el) => el.shadowRoot?.querySelector(".pill"));
    return new Function("root", "arg", src)(host.shadowRoot, arg);
  }, `return (${fn})(root, arg)`, arg);

await page.goto(firstUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => [...document.documentElement.children].some((el) => el.shadowRoot?.querySelector(".pill")), { timeout: 20000 });
await page.screenshot({ path: `${outDir}/${tag}_0_original.png` });

const t0 = Date.now();
await panelEval((root, p) => {
  root.querySelector(".pill").click();
  root.querySelector(".prompt").value = p;
  root.querySelector(".go").click();
}, prompt);

await sleep(6000);
await page.screenshot({ path: `${outDir}/${tag}_1_generating.png` });

let status = "";
for (let i = 0; i < 120; i++) {
  status = await panelEval((root) => root.querySelector(".status").textContent);
  if (/done in|^Error/i.test(status)) break;
  await sleep(2000);
}
console.log(`[${model}] ${((Date.now() - t0) / 1000).toFixed(0)}s → ${status.slice(0, 300)}`);
await sleep(1500);
await page.screenshot({ path: `${outDir}/${tag}_2_remodelled.png` });

// The AI visual review runs after the design appears; wait for its verdict.
if (/done in/i.test(status)) {
  const r0 = Date.now();
  for (let i = 0; i < 150; i++) {
    status = await panelEval((root) => root.querySelector(".status").textContent);
    if (/^(AI review|Polish attempt)/.test(status)) break;
    await sleep(2000);
  }
  console.log(`  review ${((Date.now() - r0) / 1000).toFixed(0)}s → ${status.slice(0, 400)}`);
  await sleep(1500);
  await page.screenshot({ path: `${outDir}/${tag}_2b_reviewed.png` });
}

// Scroll inside the overlay iframe to capture more of the redesign.
const frame = page.frames().find((f) => f.url().includes("sandbox.html"));
if (frame) {
  for (const [i, y] of [[3, 1800], [4, 4200]]) {
    await frame.evaluate((y) => window.scrollTo(0, y), y);
    await sleep(700);
    await page.screenshot({ path: `${outDir}/${tag}_${i}_scrolled.png` });
  }
}

// Other pages of the same type should render from the saved renderer.
for (const [i, url] of moreUrls.entries()) {
  const t = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => {
      const f = [...document.querySelectorAll("iframe")].find((x) => x.src.includes("sandbox.html"));
      return f && f.style.opacity === "1";
    }, { timeout: 20000 });
    console.log(`  next page ${i + 1}: rendered in ${Date.now() - t} ms → ${url}`);
  } catch {
    const s = await panelEval((root) => root.querySelector(".status").textContent).catch(() => "?");
    console.log(`  next page ${i + 1}: NOT rendered (${s.slice(0, 200)}) → ${url}`);
  }
  await sleep(1200);
  await page.screenshot({ path: `${outDir}/${tag}_next${i + 1}.png` });
}

// Keep the generated code for inspection.
const saved = await worker.evaluate(() => chrome.storage.local.get(null));
for (const [k, v] of Object.entries(saved)) if (k.startsWith("renderer:")) fs.writeFileSync(`${outDir}/${tag}_${k.replace(/[:]/g, "_")}.js`, v.code);

await browser.close();

// End-to-end generic run: remodel the first URL, then apply the same style on the other URLs
// (same archetype ⇒ the cached renderer should be reused instantly with each site's branding).
// usage: node run-generic.mjs <model> "<style prompt>" <first url> [more urls...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { OPENAI_API_KEY } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const extPath = path.resolve(here, "../extension");
const outDir = path.resolve(here, "../out/generic-e2e");
fs.mkdirSync(outDir, { recursive: true });

const [model, prompt, ...urls] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// HEADLESS=0 opens a visible window for sites such as IRCTC that block headless Chrome.
const headful = process.env.HEADLESS === "0";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: !headful,
  ...(headful && { ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled", "--window-size=1440,1000"] }),
  pipe: true,
  enableExtensions: [extPath],
  defaultViewport: { width: 1440, height: 900 },
  userDataDir: path.resolve(here, `../out/profile-generic-${process.pid}`),
});
const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const worker = await swTarget.worker();
const review = process.env.REVIEW === "1";
await worker.evaluate((key, m, review) => chrome.storage.local.clear().then(() => chrome.storage.local.set({ apiKey: key, model: m, review })), OPENAI_API_KEY, model, review);

const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.log("  [page error]", m.text().slice(0, 200)));
const panelEval = (fn, arg) =>
  page.evaluate((src, arg) => {
    const host = [...document.documentElement.children].find((el) => el.shadowRoot?.querySelector(".pill"));
    return host ? new Function("root", "arg", src)(host.shadowRoot, arg) : null;
  }, `return (${fn})(root, arg)`, arg);
const status = () => panelEval((root) => root.querySelector(".status").textContent).then((s) => s || "");

for (const [i, url] of urls.entries()) {
  const tag = `${i}_${new URL(url).hostname.replace(/^www\./, "")}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
  await sleep(Number(process.env.WAIT || 1500));
  // CLICK_TEXT dismisses a welcome dialog (for example IRCTC's "English" language choice) before the first shot.
  if (process.env.CLICK_TEXT) {
    await page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t)?.click(), process.env.CLICK_TEXT);
    await sleep(1500);
  }
  await page.screenshot({ path: `${outDir}/${tag}_original.png` });
  // Simulate the toolbar button.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" });
  });
  await page.waitForFunction(() => [...document.documentElement.children].some((el) => el.shadowRoot?.querySelector(".pill")), { timeout: 10000 });
  await panelEval((root, p) => {
    root.querySelector(".prompt").value = p;
    root.querySelector(".go").click();
  }, prompt);

  const t0 = Date.now();
  let s = "";
  for (let k = 0; k < 150; k++) {
    s = await status();
    if (/done in|applied in|^Error|^Reused|failed/i.test(s)) break;
    await sleep(2000);
  }
  console.log(`[${tag}] ${((Date.now() - t0) / 1000).toFixed(1)}s → ${s.slice(0, 260)}`);
  if (review && /done in/i.test(s)) {
    for (let k = 0; k < 90; k++) {
      s = await status();
      if (/AI review (passed|fixed|skipped)|Polish attempt failed/i.test(s)) break;
      await sleep(2000);
    }
    console.log(`  review → ${s.slice(0, 300)}`);
  }
  await sleep(2500);
  await page.screenshot({ path: `${outDir}/${tag}_remodel.png` });
  const frame = page.frames().find((f) => f.url().includes("sandbox.html"));
  if (frame) {
    const h = await frame.evaluate(() => document.documentElement.scrollHeight);
    await frame.evaluate((y) => window.scrollTo(0, y), Math.round(h * 0.4));
    await sleep(1200);
    await page.screenshot({ path: `${outDir}/${tag}_remodel_mid.png` });
    // Optional bridge check: search through the redesign and confirm the real site handles it.
    if (process.env.SEARCH) {
      const before = page.url();
      const ok = await frame.evaluate((q) => {
        const form = document.querySelector("form[data-search]");
        if (!form) return false;
        form.querySelector('[name="q"]').value = q;
        form.requestSubmit();
        return true;
      }, process.env.SEARCH);
      await sleep(5000);
      console.log(`  search bridge: form=${ok} ${before} → ${page.url()}`);
    }
  }
}

const saved = await worker.evaluate(() => chrome.storage.local.get(null));
for (const [k, v] of Object.entries(saved)) {
  if (k.startsWith("renderer:")) fs.writeFileSync(`${outDir}/${k.replace(/[:]/g, "_")}.js`, v.code);
}
console.log("renderers:", Object.keys(saved).filter((k) => k.startsWith("renderer:")).join(", "));
await browser.close();

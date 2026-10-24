// Runs the panel's prompt writer on a URL and prints the suggested directions.
// usage: node suggest-test.mjs <model> <url> ["optional notes"]
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { OPENAI_API_KEY } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [model, url, notes = ""] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [path.resolve(here, "../extension")],
  defaultViewport: { width: 1440, height: 900 },
  userDataDir: path.resolve(here, "../out/profile-suggest"),
});
const sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const worker = await sw.worker();
await worker.evaluate((key, m) => chrome.storage.local.clear().then(() => chrome.storage.local.set({ apiKey: key, model: m })), OPENAI_API_KEY, model);

const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await worker.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" });
});
await page.waitForFunction(() => [...document.documentElement.children].some((el) => el.shadowRoot?.querySelector(".pill")), { timeout: 10000 });
const panelEval = (fn, arg) => page.evaluate((src, arg) => {
  const host = [...document.documentElement.children].find((el) => el.shadowRoot?.querySelector(".pill"));
  return new Function("root", "arg", src)(host.shadowRoot, arg);
}, `return (${fn})(root, arg)`, arg);

const t0 = Date.now();
await panelEval((root, n) => {
  root.querySelector(".prompt").value = n;
  root.querySelector(".suggest").click();
}, notes);
let status = "";
for (let i = 0; i < 90; i++) {
  status = await panelEval((root) => root.querySelector(".status").textContent);
  if (/^Pick a direction|failed/i.test(status)) break;
  await sleep(2000);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s → ${status}`);
console.log(await panelEval((root) => [...root.querySelectorAll(".ideasite, .idea")].map((el) => el.textContent).join("\n\n")));
await page.screenshot({ path: path.resolve(here, "../out/suggest-panel.png") });
await browser.close();

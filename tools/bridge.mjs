// Reuses a profile that already has a saved Wikipedia renderer; tests link clicks and search from inside the redesign.
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../out");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, pipe: true,
  enableExtensions: [path.resolve(here, "../extension")], defaultViewport: { width: 1440, height: 900 },
  userDataDir: path.resolve(out, "profile-gpt-6-luna"),
});
const page = await browser.newPage();
const overlayShown = () => page.waitForFunction(() => {
  const f = [...document.querySelectorAll("iframe")].find((x) => x.src.includes("sandbox.html"));
  return f && f.style.opacity === "1";
}, { timeout: 20000 });
const sandbox = () => page.frames().find((f) => f.url().includes("sandbox.html"));

await page.goto("https://en.wikipedia.org/wiki/Kerala", { waitUntil: "domcontentloaded" });
await overlayShown();
console.log("1. Kerala rendered from cache");

// Click an in-article link inside the redesign.
const link = await sandbox().evaluate(() => {
  const a = [...document.querySelectorAll("a[href*='/wiki/']")].find((x) => /Thiruvananthapuram|Kochi|Malayalam/.test(x.textContent));
  if (!a) return null; a.click(); return a.textContent;
});
await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
await overlayShown();
console.log(`2. clicked "${link}" → ${page.url()} (redesigned)`);
await sleep(1000);
await page.screenshot({ path: `${out}/bridge_1_link.png` });

// Search from the redesign's search box.
const searched = await sandbox().evaluate(() => {
  const f = document.querySelector("form[data-search]"); if (!f) return false;
  f.querySelector("input[name=q]").value = "Kathakali"; f.requestSubmit(); return true;
});
await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
await overlayShown().catch(() => {});
console.log(`3. search form found=${searched} → ${page.url()}`);
await sleep(1200);
await page.screenshot({ path: `${out}/bridge_2_search.png` });

// Before/after toggle.
await page.keyboard.down("Alt"); await page.keyboard.press("r"); await page.keyboard.up("Alt");
await sleep(900);
await page.screenshot({ path: `${out}/bridge_3_toggled_original.png` });
console.log("4. Alt+R toggled");
await browser.close();

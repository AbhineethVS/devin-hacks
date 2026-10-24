// Types into the Remodel prompt on a site with single-key shortcuts and checks the page did not react.
// usage: node key-test.mjs [url]
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://github.com/AbhineethVS/devin-hacks";
const text = "s/tgk? Quiet slate tones, sharp type. 123";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [path.resolve(here, "../extension")],
  defaultViewport: { width: 1280, height: 860 },
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
const shadow = `[...document.documentElement.children].find((el) => el.shadowRoot?.querySelector(".pill"))?.shadowRoot`;
await page.waitForFunction(shadow, { timeout: 15000 });
await page.evaluate(`(${shadow}).querySelector(".pill").click()`);
await new Promise((r) => setTimeout(r, 400));
const focused = await page.evaluate(`(${shadow}).activeElement?.className || "none"`);
await page.keyboard.type("sk-test/gs", { delay: 25 });
const keyBox = await page.evaluate(`(${shadow}).querySelector(".key").value`);
console.log("key box received:", JSON.stringify(keyBox));
await page.evaluate(`(${shadow}).querySelector(".prompt").value = ""; (${shadow}).querySelector(".prompt").focus()`);
await page.keyboard.type(text, { delay: 25 });
await new Promise((r) => setTimeout(r, 800));
const result = await page.evaluate(`({
  value: (${shadow}).querySelector(".prompt").value,
  url: location.href,
  pageModalOpen: Boolean(document.querySelector("qbsearch-input[data-expanded], dialog[open], .Overlay--visibilityVisible, [data-target='qbsearch-input.searchSuggestionsDialog'][open]")),
  panelOpen: (${shadow}).querySelector(".wrap").classList.contains("open"),
})`);
await page.keyboard.press("Escape");
const closedByEsc = await page.evaluate(`!(${shadow}).querySelector(".wrap").classList.contains("open")`);
await page.screenshot({ path: path.resolve(here, "../out/key-test.png") });
console.log(JSON.stringify({ focusedOnOpen: focused, typedCorrectly: result.value === text, ...result, urlUnchanged: result.url === url, closedByEsc }));
await browser.close();

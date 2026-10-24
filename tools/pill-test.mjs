// Checks that the Remodel pill appears on each URL without any toolbar click.
// usage: node pill-test.mjs <url> [more urls...]
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [path.resolve(here, "../extension")],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
for (const url of process.argv.slice(2)) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  const found = await page.waitForFunction(
    () => [...document.documentElement.children].filter((el) => el.shadowRoot?.querySelector(".pill")).length,
    { timeout: 15000 }
  ).then((h) => h.jsonValue()).catch(() => 0);
  const name = new URL(url).hostname;
  await page.screenshot({ path: path.resolve(here, `../out/pill-${name}.png`) });
  console.log(`${found ? `pill x${found}` : "NO PILL"} · ${url}`);
}
await browser.close();

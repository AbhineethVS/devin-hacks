// Opens the Remodel panel with the real extension and screenshots it in light, dark and narrow layouts.
// usage: node panel-test.mjs [url]
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://books.toscrape.com/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [path.resolve(here, "../extension")],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));

const shadow = () => [...document.documentElement.children].find((el) => el.shadowRoot?.querySelector(".pill"))?.shadowRoot;

async function shoot(name, viewport, scheme, settings = false, target = url) {
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.goto(target, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
  await page.waitForFunction(`(${shadow})()`, { timeout: 15000 });
  await page.evaluate(`(${shadow})().querySelector(".pill").click()`);
  if (settings) await page.evaluate(`(${shadow})().querySelector(".settings").open = true`);
  await page.evaluate(`(${shadow})().querySelector(".prompt").value = "A calm editorial bookshop with oversized serif titles"`);
  await new Promise((r) => setTimeout(r, 900));
  const info = await page.evaluate(`(() => {
    const s = (${shadow})();
    const card = s.querySelector(".card").getBoundingClientRect();
    return {
      fonts: ["Remodel Sans", "Remodel Serif", "Remodel Mono"].map((f) => document.fonts.check("16px '" + f + "'")),
      card: [Math.round(card.left), Math.round(card.top), Math.round(card.width), Math.round(card.height)],
      fitsViewport: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight,
      bg: getComputedStyle(s.querySelector(".card")).backgroundColor,
    };
  })()`);
  await page.screenshot({ path: path.resolve(here, `../out/panel-${name}.png`) });
  console.log(name, JSON.stringify(info));
}

await shoot("light", { width: 1280, height: 860 }, "light", true);
await shoot("dark", { width: 1280, height: 860 }, "dark");
await shoot("narrow", { width: 390, height: 720 }, "light");
await shoot("github-dark", { width: 1280, height: 860 }, "dark", false, "https://github.com/AbhineethVS").catch((e) => console.log("github skipped", e.message));
console.log(JSON.stringify({ errors }));
await browser.close();

// Dev helper: open a URL in headless Edge/Chrome (real time, no virtual clock), wait for an
// element's text to match, then print that text plus any console errors and page exceptions.
// Usage: node scripts/browser-check.mjs <url> [selector] [waitForRegex] [timeoutMs] [clickSelector] [listenMs]
// With clickSelector, it clicks that element with a real (trusted) mouse event, which counts as a
// user gesture so audio can start, then keeps collecting errors for listenMs.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, selector = "body", waitFor = ".", timeoutMs = "20000", clickSelector, listenMs = "0"] =
  process.argv.slice(2);
if (!url) {
  console.error(
    "Usage: node scripts/browser-check.mjs <url> [selector] [waitForRegex] [timeoutMs]",
  );
  process.exit(2);
}

const browsers = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const exe = browsers.find((b) => existsSync(b));
if (!exe) {
  console.error("No Edge or Chrome found.");
  process.exit(2);
}

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "syntune-check-"));
const browser = spawn(
  exe,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let exitCode = 1;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      // browser still starting
    }
  }
  if (!target) throw new Error("Could not connect to the browser.");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const problems = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (
      msg.method === "Runtime.consoleAPICalled" &&
      ["error", "warning"].includes(msg.params.type)
    ) {
      problems.push(
        `console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`,
      );
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      problems.push(`exception: ${d.exception?.description ?? d.text}`);
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ""}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url });

  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true }))?.result?.value;

  if (clickSelector) {
    let box;
    for (let i = 0; i < 40 && !box; i++) {
      await sleep(250);
      box = await evaluate(
        `(() => { if (document.readyState !== "complete") return null; const r = document.querySelector(${JSON.stringify(clickSelector)})?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
      );
    }
    if (!box) throw new Error(`Could not find ${clickSelector} to click.`);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type,
        x: box.x,
        y: box.y,
        button: "left",
        clickCount: 1,
      });
    }
    console.log(`clicked ${clickSelector}; listening for ${listenMs} ms`);
    await sleep(Number(listenMs));
  }

  const re = new RegExp(waitFor);
  const deadline = Date.now() + Number(timeoutMs);
  let text = "";
  while (Date.now() < deadline) {
    await sleep(250);
    const res = await send("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(selector)})?.innerText ?? ""`,
      returnByValue: true,
    });
    text = res?.result?.value ?? "";
    if (re.test(text)) break;
  }
  console.log(`--- ${selector} ---\n${text}`);
  console.log(`--- console errors/warnings and exceptions: ${problems.length} ---`);
  for (const p of problems) console.log(p);
  exitCode = re.test(text) ? 0 : 1;
  if (exitCode) console.log(`(timed out waiting for /${waitFor}/)`);
  ws.close();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
} finally {
  browser.kill();
}
process.exit(exitCode);

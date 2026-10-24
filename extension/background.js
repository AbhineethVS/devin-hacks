// Streams renderer generation from the OpenAI Responses API to the content script over a port.

const DEFAULT_MODEL = "gpt-6-luna";

// Design knowledge from UI UX Pro Max (MIT). Kept in the worker so it is not loaded into every page.
importScripts("design-kb.js");

const STOP = new Set("the and for with that this from into your page site make like very more less some what them they then than just only also into onto over under about style design website web redesign www com org net http https html".split(" "));
// Light stemming so "brutalist" finds "brutalism"; short words stay whole to avoid false matches.
const stem = (t) => (t.length > 7 ? t.slice(0, t.length - 3) : t);
const tokens = (s) => [...new Set((String(s || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((t) => !STOP.has(t)).map(stem))];
const hits = (row, t) => (new RegExp(`\\b${t}`).test(row.keys) ? 1 : 0) + (new RegExp(`\\b${t}`).test(row.name.toLowerCase()) ? 2 : 0);

function rank(rows, styleWords, siteWords, styleWeight) {
  return rows
    .map((row) => {
      let score = 0;
      for (const t of styleWords) score += styleWeight * hits(row, t);
      for (const t of siteWords) score += (1 - styleWeight) * hits(row, t);
      return { row, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Picks the few library entries that match this style request and this site, like the skill's own search.
function designReference({ style, site }) {
  const kb = self.RemodelDesignKB;
  const styleWords = tokens(style);
  const siteWords = tokens(site);
  const pick = (rows, weight, n, min = 0) => rank(rows, styleWords, siteWords, weight).filter((r) => r.score >= min).slice(0, n).map((r) => r.row.text);
  const parts = [
    ...pick(kb.styles, 0.85, 2, 1.5),
    ...pick(kb.fonts, 0.6, 3, 0.6),
    ...pick(kb.products, 0.1, 1, 0.9),
    ...pick(kb.patterns, 0.2, 1, 0.8),
  ];
  return `${parts.join("\n")}\nUX RULES (high severity):\n${kb.ux.slice(0, 14).map((r) => `- ${r}`).join("\n")}`;
}

// Tabs opened before the extension was (re)loaded have no content script; inject it on demand.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extractors.js", "cursors.js", "content.js"] });
      await new Promise((resolve) => setTimeout(resolve, 300));
      await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" });
    } catch {
      // chrome:// pages, the Web Store and similar pages cannot be scripted.
    }
  }
});

// Screenshots for the visual review. captureVisibleTab captures whichever tab is visible in the window,
// so it refuses when the requesting tab is not the active one.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "design-ref") {
    try {
      sendResponse({ text: designReference(msg) });
    } catch (err) {
      sendResponse({ text: "", error: String(err) });
    }
    return;
  }
  if (msg.type !== "capture") return;
  capture(sender.tab).then(sendResponse, (err) => sendResponse({ error: String(err?.message || err) }));
  return true;
});

async function capture(tab) {
  if (!tab?.id) throw new Error("No tab to capture.");
  const current = await chrome.tabs.get(tab.id);
  if (!current.active) throw new Error("The tab is not visible.");
  const raw = await chrome.tabs.captureVisibleTab(current.windowId, { format: "jpeg", quality: 80 });
  return { dataUrl: await shrink(raw, 1280) };
}

async function shrink(dataUrl, maxWidth) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "generate") return;
  const abort = new AbortController();
  port.onDisconnect.addListener(() => abort.abort());

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "generate") return; // "ping" messages only keep the worker alive
    const { apiKey, model } = await chrome.storage.local.get(["apiKey", "model"]);
    if (!apiKey) return port.postMessage({ type: "error", message: "No OpenAI API key set. Paste it in the panel." });

    try {
      const request = (tools) => fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: abort.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: msg.model || model || DEFAULT_MODEL,
          instructions: msg.system,
          input: msg.images?.length
            ? [{ role: "user", content: [{ type: "input_text", text: msg.user }, ...msg.images.map((url) => ({ type: "input_image", image_url: url }))] }]
            : msg.user,
          stream: true,
          reasoning: { effort: msg.effort || "low" },
          max_output_tokens: msg.maxTokens || 24000,
          ...(tools ? { tools } : {}),
        }),
      });
      let res = await request(msg.tools);
      // Not every model supports hosted tools such as web search; retry without them.
      if (!res.ok && msg.tools && res.status === 400) {
        port.postMessage({ type: "note", text: "Web research is unavailable for this model; using the page only." });
        res = await request(null);
      }
      if (!res.ok) {
        const body = await res.text();
        return port.postMessage({ type: "error", message: `OpenAI HTTP ${res.status}: ${body.slice(0, 300)}` });
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let cut;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const line = event.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "response.output_text.delta") {
            text += data.delta;
            port.postMessage({ type: "delta", delta: data.delta, length: text.length });
          } else if (data.type === "response.failed" || data.type === "error") {
            return port.postMessage({ type: "error", message: JSON.stringify(data).slice(0, 300) });
          }
        }
      }
      port.postMessage({ type: "done", text });
    } catch (err) {
      if (!abort.signal.aborted) port.postMessage({ type: "error", message: String(err) });
    }
  });
});

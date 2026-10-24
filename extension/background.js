// Streams renderer generation from the OpenAI Responses API to the content script over a port.

const DEFAULT_MODEL = "gpt-6-luna";

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" }).catch(() => {});
});

// Screenshots for the visual review. captureVisibleTab captures whichever tab is visible in the window,
// so it refuses when the requesting tab is not the active one.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
      const res = await fetch("https://api.openai.com/v1/responses", {
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
        }),
      });
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

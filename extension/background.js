// Streams renderer generation from the OpenAI Responses API to the content script over a port.

const DEFAULT_MODEL = "gpt-6-luna";

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" }).catch(() => {});
});

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
          input: msg.user,
          stream: true,
          reasoning: { effort: msg.effort || "low" },
          max_output_tokens: 24000,
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

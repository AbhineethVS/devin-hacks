// Stream a fixed HTML-writing prompt through several models; report time to first token and tokens/sec.
import { OPENAI_API_KEY } from "./env.mjs";
const models = process.argv.slice(2);
const prompt = "Write a self-contained HTML page (inline CSS, no JS) for a neo-brutalist travel magazine article about Kochi, Kerala, with a hero, 4 sections, a stats card grid and a footer. Output only HTML.";
for (const model of models) {
  const t0 = Date.now(); let first = null, chars = 0, usage = null, err = null;
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, stream: true, reasoning: { effort: "low" } }),
    });
    if (!r.ok) { err = `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`; }
    else {
      const dec = new TextDecoder(); let buf = "";
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let i; while ((i = buf.indexOf("\n\n")) >= 0) {
          const ev = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = ev.split("\n").find((l) => l.startsWith("data: ")); if (!line) continue;
          const d = JSON.parse(line.slice(6));
          if (d.type === "response.output_text.delta") { if (!first) first = Date.now(); chars += d.delta.length; }
          if (d.type === "response.completed") usage = d.response.usage;
          if (d.type === "error" || d.type === "response.failed") err = JSON.stringify(d).slice(0, 200);
        }
      }
    }
  } catch (e) { err = String(e); }
  const total = (Date.now() - t0) / 1000;
  const out = usage?.output_tokens, gen = first ? (Date.now() - first) / 1000 : 0;
  console.log(`${model.padEnd(14)} ${err ? "ERR " + err : `first=${((first - t0) / 1000).toFixed(1)}s total=${total.toFixed(1)}s chars=${chars} out_tokens=${out} ~${gen ? Math.round(chars / 4 / gen) : "?"} tok/s(text)`}`);
}

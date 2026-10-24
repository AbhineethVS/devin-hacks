// Runs AI-written renderer code. This page is an MV3 sandbox: eval is allowed, extension APIs are not.

const root = document.getElementById("rm");
const styleEl = document.getElementById("rm-style");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const send = (msg) => parent.postMessage({ source: "remodel-sandbox", ...msg }, "*");

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "render") return;
  try {
    const factory = new Function(
      "esc",
      `${msg.code}
       ;return {
         STYLE: typeof STYLE !== "undefined" ? STYLE : "",
         render: typeof render === "function" ? render : null,
         mount: typeof mount === "function" ? mount : null,
       };`
    );
    const mod = factory(esc);
    if (!mod.render) throw new Error("The code does not define render(data).");
    const html = mod.render(msg.data);
    styleEl.textContent = mod.STYLE;
    root.innerHTML = html;
    if (root.textContent.trim().length < 80) throw new Error("render(data) produced almost no visible text.");
    if (mod.mount) mod.mount(root);
    window.scrollTo(0, 0);
    send({ type: "rendered" });
  } catch (err) {
    send({ type: "render-error", message: String((err && err.stack) || err).slice(0, 1500) });
  }
});

// Bridge: links and search go back to the real page.
document.addEventListener("click", (event) => {
  const a = event.target.closest("a[href]");
  if (!a) return;
  const raw = a.getAttribute("href");
  if (raw.startsWith("#")) return; // in-page anchor, let it scroll
  event.preventDefault();
  if (/^https?:/.test(a.href)) send({ type: "navigate", href: a.href, newTab: event.ctrlKey || event.metaKey });
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.matches("[data-search]")) {
    const q = new FormData(form).get("q");
    if (q) send({ type: "search", q: String(q) });
  }
});

window.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "r") send({ type: "toggle" });
});

send({ type: "ready" });

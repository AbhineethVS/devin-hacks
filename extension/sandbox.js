// Runs AI-written renderer code. This page is an MV3 sandbox: eval is allowed, extension APIs are not.

const root = document.getElementById("rm");
const styleEl = document.getElementById("rm-style");
const runtimeStyle = document.getElementById("rm-runtime-style");
const director = document.getElementById("rm-director");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const send = (msg) => parent.postMessage({ source: "remodel-sandbox", ...msg }, "*");
let cleanupRuntime = () => {};

runtimeStyle.textContent = `
  [data-rm-reveal] { transition: opacity .75s ease, transform .85s cubic-bezier(.2,.75,.2,1); }
  [data-rm-reveal]:not(.rm-seen) { opacity: 0; }
  [data-rm-reveal="up"]:not(.rm-seen) { transform: translateY(42px); }
  [data-rm-reveal="left"]:not(.rm-seen) { transform: translateX(-42px); }
  [data-rm-reveal="right"]:not(.rm-seen) { transform: translateX(42px); }
  [data-rm-reveal="scale"]:not(.rm-seen) { transform: scale(.94); }
  #rm-director { position: fixed; z-index: 2147483647; display: none; align-items: center; gap: 7px; max-width: 280px;
    border: 1px solid rgba(255,255,255,.28); border-radius: 999px; padding: 8px 12px; background: #111; color: #fff;
    box-shadow: 0 8px 30px rgba(0,0,0,.28); font: 700 12px/1 system-ui,sans-serif; cursor: pointer; }
  #rm-director.on { display: flex; }
  #rm-director span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-rm-section].rm-target { outline: 2px dashed color-mix(in srgb, currentColor 55%, transparent); outline-offset: -3px; }
  @media (prefers-reduced-motion: reduce) {
    [data-rm-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
    [data-rm-parallax] { transform: none !important; }
  }
`;

function validate(data) {
  const visibleText = root.textContent.replace(/\s+/g, " ").trim();
  if (visibleText.length < 160) throw new Error("render(data) produced almost no visible text.");
  if (data.site === "Wikipedia" && data.sections?.length) {
    const rendered = new Set([...root.querySelectorAll("[data-rm-section]")].map((el) => el.dataset.rmSection));
    const missing = data.sections.filter((section) => !rendered.has(section.id));
    if (missing.length) throw new Error(`Renderer omitted ${missing.length} article section(s): ${missing.slice(0, 4).map((s) => s.title).join(", ")}`);
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 24) {
    throw new Error("Renderer causes horizontal page overflow.");
  }
}

function mountRuntime(data, options = {}) {
  cleanupRuntime();
  const cleanups = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = [...root.querySelectorAll("[data-rm-reveal]")];

  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("rm-seen"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("rm-seen")),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach((el) => observer.observe(el));
    cleanups.push(() => observer.disconnect());
  }

  const parallax = reduced ? [] : [...root.querySelectorAll("[data-rm-parallax]")];
  const progress = [...root.querySelectorAll("[data-rm-progress]")];
  let frame = 0;
  const updateMotion = () => {
    frame = 0;
    const scrollMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ratio = Math.min(1, Math.max(0, scrollY / scrollMax));
    progress.forEach((el) => el.style.setProperty("--rm-progress", String(ratio)));
    parallax.forEach((el) => {
      const speed = Math.min(.35, Math.max(.05, Number(el.dataset.rmParallax) || .12));
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - innerHeight / 2) * -speed;
      el.style.setProperty("--rm-parallax-y", `${offset.toFixed(1)}px`);
      el.style.transform = `translate3d(0,var(--rm-parallax-y),0)`;
    });
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(updateMotion);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  cleanups.push(() => {
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    if (frame) cancelAnimationFrame(frame);
  });
  updateMotion();

  const sectionTitles = new Map((data.sections || []).map((section) => [section.id, section.title]));
  let activeSection = null;
  const leaveSection = () => {
    activeSection?.classList.remove("rm-target");
    activeSection = null;
    director.classList.remove("on");
  };
  const onPointerOver = (event) => {
    const section = event.target.closest?.("[data-rm-section]");
    if (!section || section === activeSection) return;
    activeSection?.classList.remove("rm-target");
    activeSection = section;
    section.classList.add("rm-target");
    const rect = section.getBoundingClientRect();
    const title = section.dataset.rmTitle || sectionTitles.get(section.dataset.rmSection) || "this chapter";
    director.querySelector("span").textContent = `Remix · ${title}`;
    director.style.top = `${Math.max(12, Math.min(innerHeight - 48, rect.top + 12))}px`;
    director.style.right = "18px";
    director.classList.add("on");
  };
  root.addEventListener("pointerover", onPointerOver);
  cleanups.push(() => root.removeEventListener("pointerover", onPointerOver));
  director.onclick = () => {
    if (!activeSection) return;
    send({
      type: "select-section",
      section: {
        id: activeSection.dataset.rmSection,
        title: activeSection.dataset.rmTitle || sectionTitles.get(activeSection.dataset.rmSection) || "Selected chapter",
      },
    });
    leaveSection();
  };
  cleanups.push(() => {
    director.onclick = null;
    leaveSection();
  });

  cleanupRuntime = () => cleanups.splice(0).forEach((fn) => fn());
  if (options.focusSection) {
    requestAnimationFrame(() => root.querySelector(`[data-rm-section="${CSS.escape(options.focusSection)}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }));
  }
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (event.source !== parent || !msg || msg.type !== "render") return;
  try {
    cleanupRuntime();
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
    validate(msg.data);
    let mountWarning = "";
    try {
      if (mod.mount) mod.mount(root);
    } catch (err) {
      mountWarning = `Optional mount() failed: ${String(err)}`;
    }
    mountRuntime(msg.data, msg.options);
    window.scrollTo(0, 0);
    send({ type: "rendered", warning: mountWarning });
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

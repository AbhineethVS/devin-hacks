/* THESIS: deliberately broken test renderer: every image is stretched to full width, one per row. */
const STYLE = `#rm { font: 16px system-ui; padding: 24px; } #rm img { display: block; width: 100%; margin: 12px 0; }`;
function render(data) {
  const imgs = [];
  const visit = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v.src === "string") imgs.push(v);
    Object.values(v).forEach(visit);
  };
  visit(data.sections);
  return `<h1>${esc(data.title)}</h1>
${data.sections.map((s) => `<section id="${esc(s.id)}" data-rm-section="${esc(s.id)}" data-rm-title="${esc(s.title)}"><h2>${esc(s.title)}</h2>${s.blocks.map((b) => esc(b.text || (b.html || "").replace(/<[^>]+>/g, "") || "")).join(" ")}</section>`).join("")}
${imgs.map((i) => `<img src="${esc(i.src)}" alt="${esc(i.alt)}">`).join("")}`;
}

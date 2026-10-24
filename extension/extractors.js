// Turns supported pages into content JSON with a fixed schema per page type.
// Exposes window.RemodelExtract = { detect(), extract(type), schema(type), sample(data, type) }.

(() => {
  const escText = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const escAttr = (s) => s.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);
  const DROP = "sup.reference, sup.noprint, .mw-ref, style, script, .noprint, .mw-editsection, .mw-cite-backlink, .reference, .IPA";
  function text(el) {
    if (!el) return "";
    let out = "";
    const walk = (node) => node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
      else if (n.nodeType === Node.ELEMENT_NODE && !n.matches(DROP)) {
        const block = n.matches("br, div, p, li, tr");
        if (block) out += " ";
        walk(n);
        if (block) out += " ";
      }
    });
    walk(el);
    return out.replace(/\[(\d+|[a-z]|note \d+)\]/g, "").replace(/\s+/g, " ").trim();
  }

  // Keep only text, links, bold and italic. Output is safe to inject.
  function clean(node) {
    let out = "";
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += escText(n.textContent);
      else if (n.nodeType === Node.ELEMENT_NODE && !n.matches(DROP)) {
        const inner = clean(n);
        const tag = n.tagName.toLowerCase();
        if (tag === "a" && /^https?:/.test(n.href) && !n.getAttribute("href").startsWith("#")) out += `<a href="${escAttr(n.href)}">${inner}</a>`;
        else if (tag === "b" || tag === "strong") out += `<b>${inner}</b>`;
        else if (tag === "i" || tag === "em") out += `<i>${inner}</i>`;
        else if (tag === "br") out += " ";
        else out += inner;
      }
    });
    return out.replace(/\s+/g, " ");
  }

  // Largest version of a Wikimedia image from srcset, falling back to src.
  function bestSrc(img) {
    const set = (img.getAttribute("srcset") || "").split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
    const url = set.length ? set[set.length - 1] : img.getAttribute("src");
    return url ? new URL(url, location.href).href : null;
  }

  const absoluteUrl = (value) => {
    try { return new URL(value, location.href).href; } catch { return null; }
  };
  const visible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 2 && rect.height > 2 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  };
  let nextBindId = 1;
  function bindControl(el, fields) {
    if (!el) return null;
    if (!el.dataset.rmId) el.dataset.rmId = `rm-${nextBindId++}`;
    return {
      id: el.dataset.rmId,
      kind: fields.kind,
      name: fields.name,
      label: fields.label,
      placeholder: fields.placeholder || "",
      value: fields.value ?? el.value ?? "",
      options: fields.options || [],
      inputType: fields.inputType || el.type || "text",
    };
  }

  // ---------- IRCTC public train-search homepage ----------
  const TRAIN_CLASSES = [
    "All Classes", "Anubhuti Class (EA)", "AC First Class (1A)", "Vistadome AC (EV)",
    "Exec. Chair Car (EC)", "AC 2 Tier (2A)", "First Class (FC)", "AC 3 Tier (3A)",
    "AC 3 Economy (3E)", "Vistadome Chair Car (VC)", "AC Chair car (CC)", "Sleeper (SL)",
    "Vistadome Non AC (VS)", "Second Sitting (2S)",
  ];
  const TRAIN_QUOTAS = [
    "GENERAL", "LADIES", "LOWER BERTH/SR.CITIZEN", "PERSON WITH DISABILITY",
    "DUTY PASS", "TATKAL", "PREMIUM TATKAL",
  ];

  function irctcHome() {
    const fromEl = document.querySelector(
      'input[placeholder^="From" i], p-autocomplete#origin input, input[aria-label^="From" i], input[formcontrolname*="origin" i], input[name*="origin" i]'
    );
    const toEl = document.querySelector(
      'input[placeholder^="To" i], p-autocomplete#destination input, input[aria-label^="To" i], input[formcontrolname*="destination" i], input[name*="destination" i]'
    );
    const dateEl = document.querySelector(
      'input[placeholder*="Date" i], p-calendar input, input[formcontrolname*="date" i], input[name*="date" i]'
    );
    const dropdowns = [...document.querySelectorAll("p-dropdown")].filter(visible);
    const dropdownText = (el) => text(el.querySelector(".ui-dropdown-label, .p-dropdown-label, label") || el);
    const classEl = dropdowns.find((el) => /class|1a|2a|3a|sleeper|second sitting/i.test(dropdownText(el))) || dropdowns[0] || null;
    const quotaEl = dropdowns.find((el) => /general|ladies|tatkal|quota/i.test(dropdownText(el))) || dropdowns.find((el) => el !== classEl) || null;
    const buttonCandidates = [...document.querySelectorAll("button")].filter(visible);
    const searchEl = buttonCandidates.find((el) => /^(search|find trains?)$/i.test(text(el)) || /find trains?/i.test(el.getAttribute("label") || "")) || document.querySelector("button.search_btn");

    const checks = [...document.querySelectorAll('input[type="checkbox"]')].filter(visible).map((el, index) => {
      const label = text(el.closest("label") || document.querySelector(`label[for="${CSS.escape(el.id)}"]`) || el.parentElement) || `Option ${index + 1}`;
      return bindControl(el, { kind: "checkbox", name: el.name || `option-${index + 1}`, label, value: el.checked });
    }).filter(Boolean).slice(0, 8);

    const nav = [...document.querySelectorAll("header a, nav a, app-header a")].filter(visible).map((a) => ({
      text: text(a), href: absoluteUrl(a.getAttribute("href")),
    })).filter((item) => item.text && item.href && !/^javascript:/i.test(item.href)).slice(0, 24);

    const servicePattern = /^(flights?|hotels?|rail drishti|e-?catering|bus|holiday packages?|tourist train|hill railways?|charter train|gallery)$/i;
    const services = [];
    for (const el of [...document.querySelectorAll("a, button, li, span")].filter(visible)) {
      const label = text(el);
      if (!servicePattern.test(label) || services.some((item) => item.title.toLowerCase() === label.toLowerCase())) continue;
      const owner = el.closest("a") || el;
      const img = owner.querySelector("img") || owner.parentElement?.querySelector("img");
      services.push({ title: label, href: owner.href ? absoluteUrl(owner.getAttribute("href")) : null, image: img ? bestSrc(img) : null });
    }

    const holidays = [];
    for (const img of [...document.images].filter((el) => visible(el) && el.naturalWidth >= 160 && el.naturalHeight >= 90)) {
      const card = img.closest("article, .card, [class*='package'], [class*='tour'], .col-md-4, .col-sm-6") || img.parentElement?.parentElement;
      if (!card) continue;
      const heading = card.querySelector("h2,h3,h4,h5,strong");
      const title = text(heading);
      const description = text(card.querySelector("p"));
      if (!title || /^holidays?$/i.test(title) || card.matches("main,body") || title.length > 100 || holidays.some((item) => item.title === title)) continue;
      const a = card.closest("a") || card.querySelector("a[href]");
      holidays.push({ title, description: description.slice(0, 500), image: bestSrc(img), href: a ? absoluteUrl(a.getAttribute("href")) : null });
    }

    const largeImages = [...document.images].filter((img) => visible(img) && img.naturalWidth >= 500).sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
    const notices = [...document.querySelectorAll("[role=alert], .alert, [class*='notice'], [class*='announcement']")]
      .filter(visible).map((el) => text(el)).filter((value) => value.length > 15 && value.length < 500).slice(0, 6);
    const footer = [...document.querySelectorAll("footer a, app-footer a")].filter(visible).map((a) => ({
      text: text(a), href: absoluteUrl(a.getAttribute("href")),
    })).filter((item) => item.text && item.href).slice(0, 30);

    return {
      site: "IRCTC",
      pageTitle: document.title || "IRCTC – Indian Railways",
      url: location.href,
      tagline: "Safety · Security · Punctuality",
      heroImage: largeImages[0] ? { src: bestSrc(largeImages[0]), alt: largeImages[0].alt || "Indian Railways" } : null,
      nav,
      booking: {
        from: bindControl(fromEl, { kind: "station", name: "from", label: "From", placeholder: fromEl?.placeholder || "From station" }),
        to: bindControl(toEl, { kind: "station", name: "to", label: "To", placeholder: toEl?.placeholder || "To station" }),
        date: bindControl(dateEl, { kind: "date", name: "date", label: "Journey date", placeholder: dateEl?.placeholder || "DD-MM-YYYY" }),
        travelClass: bindControl(classEl, { kind: "dropdown", name: "class", label: "Travel class", value: dropdownText(classEl) || "All Classes", options: TRAIN_CLASSES }),
        quota: bindControl(quotaEl, { kind: "dropdown", name: "quota", label: "Quota", value: dropdownText(quotaEl) || "GENERAL", options: TRAIN_QUOTAS }),
        checks,
        submit: bindControl(searchEl, { kind: "submit", name: "submit", label: text(searchEl) || "Search trains" }),
      },
      services: services.slice(0, 14),
      holidays: holidays.slice(0, 12),
      notices,
      footer,
    };
  }

  const IRCTC_SCHEMA = `type Data = {
  site: "IRCTC"; pageTitle: string; url: string; tagline: string;
  heroImage: { src: string; alt: string } | null;
  nav: { text: string; href: string }[];
  booking: {
    from: Control | null; to: Control | null; date: Control | null;
    travelClass: Control | null; quota: Control | null; checks: Control[]; submit: Control | null;
  };
  services: { title: string; href: string | null; image: string | null }[];
  holidays: { title: string; description: string; image: string; href: string | null }[];
  notices: string[];
  footer: { text: string; href: string }[];
};
type Control = {
  id: string; kind: "station"|"date"|"dropdown"|"checkbox"|"submit";
  name: string; label: string; placeholder: string; value: string|boolean;
  options: string[]; inputType: string;
};

IRCTC BOOKING CONTRACT:
- Render ONE prominent <form data-bound-form="train-search">.
- For from/to/date, render <input data-bind="CONTROL_ID" name="CONTROL_NAME"> with current value and placeholder.
- Keep the date as type="text" with inputmode="numeric" because IRCTC expects DD-MM-YYYY.
- For travelClass/quota, render <select data-bind="CONTROL_ID" name="CONTROL_NAME"> using every supplied option.
- For checks, render labelled <input type="checkbox" data-bind="CONTROL_ID" name="CONTROL_NAME">.
- The submit button must be <button type="submit" data-bind="SUBMIT_CONTROL_ID">Search trains</button>.
- Include a visible <p data-rm-form-status role="status"></p> for validation and handoff messages.
- data-bind values must come from the data. Never invent IDs. The host syncs these controls to the real IRCTC form and submits it.
- Keep booking functional and immediately understandable. Do not hide it behind tabs or animation.`;

  // ---------- Wikipedia article ----------
  const WIKI_SKIP = /^(see also|references|notes|external links|further reading|bibliography|sources|citations|footnotes|explanatory notes)$/i;

  function wikipediaArticle() {
    const content = document.querySelector("#mw-content-text .mw-parser-output");
    const data = {
      site: "Wikipedia",
      title: text(document.querySelector("#firstHeading")),
      url: location.href,
      description: text(document.querySelector(".shortdescription")),
      stats: null,
      heroImage: null,
      lead: [],
      infobox: null,
      sections: [],
      seeAlso: [],
      images: [],
    };

    const infobox = content.querySelector("table.infobox");
    if (infobox) {
      const rows = [];
      infobox.querySelectorAll("tr").forEach((tr) => {
        const th = tr.querySelector("th");
        const td = tr.querySelector("td");
        if (th && td) {
          const value = text(td);
          if (value && value.length < 220) rows.push({ label: text(th), value });
        }
      });
      const img = infobox.querySelector("img");
      data.infobox = { title: text(infobox.querySelector("caption, .infobox-above")) || data.title, rows: rows.slice(0, 24) };
      if (img && img.width >= 100) data.heroImage = { src: bestSrc(img), caption: text(infobox.querySelector(".infobox-caption")) };
    }

    let section = null;
    let skipping = false;
    const pushImage = (fig) => {
      const img = fig.querySelector("img");
      if (!img || (img.getAttribute("width") && +img.getAttribute("width") < 80)) return;
      const image = { src: bestSrc(img), caption: text(fig.querySelector("figcaption, .thumbcaption")) };
      data.images.push(image);
      if (section) section.blocks.push({ type: "image", ...image });
      if (!data.heroImage) data.heroImage = image;
    };

    // Wikipedia's Parsoid output nests content in <section> elements; flatten them in document order.
    const flat = [];
    const collect = (parent) => {
      for (const el of parent.children) {
        if (el.tagName === "SECTION") collect(el);
        else flat.push(el);
      }
    };
    collect(content);

    for (const el of flat) {
      if (el.matches(".mw-heading, h2, h3, h4")) {
        const h = el.matches("h2, h3, h4") ? el : el.querySelector("h2, h3, h4");
        const level = h ? Number(h.tagName[1]) : 2;
        const title = text(h || el);
        if (level === 2) {
          skipping = WIKI_SKIP.test(title);
          if (/^see also$/i.test(title)) {
            const list = flat.slice(flat.indexOf(el) + 1).find((n) => n.matches("ul, div.div-col, .div-col")) || null;
            list?.querySelectorAll("a").forEach((a) => /^https?:/.test(a.href) && data.seeAlso.push({ text: text(a), href: a.href }));
          }
          if (!skipping) {
            section = { id: `s${data.sections.length + 1}`, title, blocks: [] };
            data.sections.push(section);
          }
        } else if (!skipping && section) {
          section.blocks.push({ type: "subheading", text: title });
        }
        continue;
      }
      if (skipping) continue;
      if (el.matches("p")) {
        const html = clean(el).trim();
        if (html.replace(/<[^>]+>/g, "").length > 30) (section ? section.blocks : data.lead).push(section ? { type: "p", html } : html);
      } else if (el.matches("figure, .thumb, [typeof~='mw:File/Thumb']")) {
        pushImage(el);
      } else if (el.matches("ul, ol") && section) {
        const items = [...el.querySelectorAll(":scope > li")].map((li) => clean(li).trim()).filter(Boolean).slice(0, 14);
        if (items.length) section.blocks.push({ type: "list", items });
      } else if (el.matches("blockquote") && section) {
        section.blocks.push({ type: "quote", html: clean(el).trim() });
      } else if (el.matches(".gallery, ul.gallery")) {
        el.querySelectorAll("li.gallerybox, .gallerybox").forEach(pushImage);
      }
    }
    data.sections = data.sections.filter((s) => s.blocks.length).map((s, index) => {
      const prose = s.blocks.map((block) => block.html || block.text || block.items?.join(" ") || block.caption || "").join(" ");
      const plain = prose.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const years = [...new Set((plain.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g) || []))].slice(0, 12);
      return {
        ...s,
        index: index + 1,
        wordCount: plain ? plain.split(/\s+/).length : 0,
        imageCount: s.blocks.filter((block) => block.type === "image").length,
        years,
      };
    });
    data.seeAlso = data.seeAlso.slice(0, 12);
    data.images = data.images.slice(0, 30);
    const articleText = [data.lead.join(" "), ...data.sections.map((s) => s.blocks.map((b) => b.html || b.text || b.items?.join(" ") || "").join(" "))].join(" ");
    const wordCount = articleText.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    data.stats = {
      wordCount,
      readingMinutes: Math.max(1, Math.round(wordCount / 220)),
      sectionCount: data.sections.length,
      imageCount: data.images.length,
    };
    return data;
  }

  const WIKI_SCHEMA = `type Data = {
  site: "Wikipedia"; title: string; url: string; description: string;   // description may be ""
  stats: { wordCount: number; readingMinutes: number; sectionCount: number; imageCount: number };
  heroImage: { src: string; caption: string } | null;
  lead: string[];                       // intro paragraphs, sanitized HTML (may contain <a>, <b>, <i>)
  infobox: { title: string; rows: { label: string; value: string }[] } | null;
  sections: {
    id: string; title: string; index: number; wordCount: number; imageCount: number;
    years: string[];                    // distinct years found in the section; useful for timelines, may be empty
    blocks: (
      | { type: "p"; html: string }               // sanitized HTML
      | { type: "subheading"; text: string }
      | { type: "list"; items: string[] }         // sanitized HTML items
      | { type: "quote"; html: string }
      | { type: "image"; src: string; caption: string }
    )[];
  }[];                                  // can be 1 or 40 sections; some have no images
  seeAlso: { text: string; href: string }[];   // may be empty
  images: { src: string; caption: string }[];  // all images in the article, may be empty
};
Wikipedia search: a form with data-search and an input named "q" searches Wikipedia.`;

  // ---------- Hacker News list ----------
  function hnList() {
    const items = [...document.querySelectorAll("tr.athing:not(.comtr)")].map((row) => {
      const a = row.querySelector(".titleline > a");
      const sub = row.nextElementSibling?.querySelector(".subtext");
      const links = sub ? [...sub.querySelectorAll("a")] : [];
      const comments = links.find((l) => /comment|discuss/.test(l.textContent));
      return {
        rank: parseInt(text(row.querySelector(".rank")), 10) || null,
        title: text(a),
        url: a ? a.href : null,
        site: text(row.querySelector(".sitestr")),
        points: parseInt(text(sub?.querySelector(".score")), 10) || 0,
        user: text(sub?.querySelector(".hnuser")),
        age: text(sub?.querySelector(".age")),
        comments: comments ? parseInt(comments.textContent, 10) || 0 : 0,
        commentsUrl: `https://news.ycombinator.com/item?id=${row.id}`,
      };
    });
    const nav = [...document.querySelectorAll(".pagetop a")].filter((a) => !a.closest("#me, .hnname")).map((a) => ({ text: text(a), href: a.href }));
    return { site: "Hacker News", pageTitle: document.title, url: location.href, nav, items, moreUrl: document.querySelector("a.morelink")?.href || null };
  }

  const HN_LIST_SCHEMA = `type Data = {
  site: "Hacker News"; pageTitle: string; url: string;
  nav: { text: string; href: string }[];          // e.g. new, past, comments, ask, show, jobs
  items: { rank: number | null; title: string; url: string | null; site: string;   // site may be "" (Ask HN posts)
           points: number; user: string; age: string; comments: number; commentsUrl: string }[];  // usually 30, may be fewer
  moreUrl: string | null;                         // next page
};`;

  // ---------- Hacker News item (story + comments) ----------
  function hnItem() {
    const top = document.querySelector("table.fatitem");
    const a = top?.querySelector(".titleline > a");
    const sub = top?.querySelector(".subtext");
    const story = {
      title: text(a) || text(top?.querySelector(".commtext")).slice(0, 80),
      url: a ? a.href : null,
      site: text(top?.querySelector(".sitestr")),
      points: parseInt(text(sub?.querySelector(".score")), 10) || 0,
      user: text(sub?.querySelector(".hnuser")),
      age: text(sub?.querySelector(".age")),
      html: top?.querySelector(".toptext") ? clean(top.querySelector(".toptext")).trim() : "",
    };
    const comments = [...document.querySelectorAll("tr.comtr")].slice(0, 250).map((row) => ({
      depth: parseInt(row.querySelector("td.ind")?.getAttribute("indent") || "0", 10),
      user: text(row.querySelector(".hnuser")),
      age: text(row.querySelector(".age")),
      html: row.querySelector(".commtext") ? clean(row.querySelector(".commtext")).trim() : "",
    })).filter((c) => c.html);
    return { site: "Hacker News", url: location.href, story, comments };
  }

  const HN_ITEM_SCHEMA = `type Data = {
  site: "Hacker News"; url: string;
  story: { title: string; url: string | null; site: string; points: number; user: string; age: string; html: string }; // html may be "" (link posts)
  comments: { depth: number; user: string; age: string; html: string }[];  // flat list in thread order; depth 0 = top level; may be empty
};`;

  // ---------- Any other website: best-effort generic extraction ----------
  const GENERIC_SKIP = "script, style, noscript, template, svg, canvas, iframe, object, embed, video, audio, dialog, [role=dialog], [aria-modal=true], [aria-hidden=true], [hidden]";
  const CHROME = "header, nav, footer, [role=banner], [role=navigation], [role=contentinfo]";
  const INLINE = /^(A|B|I|EM|STRONG|SPAN|SMALL|BR|CODE|TIME|ABBR|MARK|SUP|SUB|U|S|Q|CITE|LABEL|WBR)$/;

  const colorCtx = document.createElement("canvas").getContext("2d");
  function parseColor(value) {
    if (!value || value === "transparent") return null;
    colorCtx.fillStyle = "#000";
    colorCtx.fillStyle = value;
    const v = colorCtx.fillStyle;
    if (v.startsWith("#")) return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 };
    const m = v.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const chromatic = (c) => c && c.a > 0.6 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 40;
  const colorDistance = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

  function brandOf() {
    const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";
    const host = location.hostname.replace(/^www\./, "");
    const titleParts = document.title.split(/\s[|–—\-·:]\s/).map((s) => s.trim()).filter(Boolean);
    const label = host.split(".")[0];
    const fromHost = label.length <= 4 ? label.toUpperCase() : label.replace(/^./, (c) => c.toUpperCase());
    const letters = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const titleMatch = titleParts.find((part) => part.length < 40 && letters(part) && (letters(host).includes(letters(part)) || letters(part).includes(letters(label))));
    const name = meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || titleMatch
      || (titleParts.length > 1 && titleParts.at(-1).length < 40 ? titleParts.at(-1) : "") || fromHost;

    const logoImg = [...document.querySelectorAll('img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i], [class*="logo" i] img, [id*="logo" i] img, header img')]
      .find((img) => visible(img) && img.naturalWidth >= 16);
    const icon = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel~="icon"]');

    const candidates = [parseColor(meta('meta[name="theme-color"]'))];
    const sample = (sel, prop, n) => [...document.querySelectorAll(sel)].slice(0, n).filter(visible)
      .forEach((el) => candidates.push(parseColor(getComputedStyle(el)[prop])));
    sample("header, [role=banner], nav", "backgroundColor", 4);
    sample("button, [class*=btn], [class*=button]", "backgroundColor", 30);
    sample("a[href]", "color", 40);
    const colorful = candidates.filter(chromatic);
    const primary = colorful[0] || null;
    const accent = primary ? colorful.find((c) => colorDistance(c, primary) > 90) || null : null;
    const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
    const htmlBg = parseColor(getComputedStyle(document.documentElement).backgroundColor);
    const bg = [bodyBg, htmlBg].find((c) => c && c.a > 0.6);
    const fg = parseColor(getComputedStyle(document.body).color);

    return {
      name: name.slice(0, 60),
      logo: logoImg ? absoluteUrl(logoImg.currentSrc || logoImg.src) : null,
      favicon: absoluteUrl(icon?.getAttribute("href") || "/favicon.ico"),
      colors: {
        primary: primary ? hex(primary) : null,
        accent: accent ? hex(accent) : null,
        bg: bg ? hex(bg) : "#ffffff",
        text: fg ? hex(fg) : null,
      },
    };
  }

  function genericPage() {
    const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";
    const brand = brandOf();
    const root = document.querySelector("main, [role=main]") || document.body;
    const linkOf = (a) => {
      const href = a && absoluteUrl(a.getAttribute("href") || "");
      return href && /^https?:/.test(href) ? href : null;
    };
    const imageOf = (img) => {
      // Lazy images often carry a placeholder src until scrolled into view; prefer srcset and data-* sources.
      const lazySet = (img.dataset.srcset || "").split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).at(-1);
      const loaded = img.complete && img.naturalWidth > 40 ? img.currentSrc : "";
      const src = [loaded, img.getAttribute("srcset") ? bestSrc(img) : "", lazySet, img.dataset.src, img.dataset.lazySrc, img.dataset.original, img.currentSrc, img.src]
        .find((s) => s && !s.startsWith("data:") && !/placeholder|blank|spacer|grey-placeholder|transparent\.(gif|png)/i.test(s));
      return src ? absoluteUrl(src) : null;
    };
    // Displayed size on the original page, so the redesign can keep badges badge-sized.
    const sizeOf = (img) => {
      const rect = img.getBoundingClientRect();
      const w = Math.round(rect.width || img.width || +img.getAttribute("width") || img.naturalWidth || 0);
      const h = Math.round(rect.height || img.height || +img.getAttribute("height") || img.naturalHeight || 0);
      return { w, h };
    };
    const roleOf = ({ w, h }) => Math.max(w, h) <= 96 ? "icon" : Math.max(w, h) <= 240 ? "thumb" : w >= innerWidth * 0.6 ? "hero" : "photo";

    // A run of small images (badges, partner logos, avatars, skill icons) stays a row of small images.
    function iconsOf(parent) {
      const kids = [...parent.children].filter(visible);
      if (kids.length < 2) return null;
      const items = [];
      let size = 0;
      for (const k of kids) {
        const imgs = k.matches("img") ? [k] : [...k.querySelectorAll("img")];
        if (imgs.length !== 1) return null;
        const dims = sizeOf(imgs[0]);
        if (!dims.w || Math.max(dims.w, dims.h) > 96 || text(k).length > 40) return null;
        size = Math.max(size, dims.w, dims.h);
        const a = k.matches("a[href]") ? k : k.querySelector("a[href]") || k.closest("a[href]");
        items.push({ src: imageOf(imgs[0]), alt: (imgs[0].alt || "").slice(0, 80), label: text(k).slice(0, 40), href: linkOf(a) });
      }
      const valid = items.filter((i) => i.src);
      return valid.length >= 2 ? { type: "icons", size, items: valid.slice(0, 40) } : null;
    }

    const labelOf = (el) => text(el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null)
      || text(el.closest("label")) || el.getAttribute("aria-label") || el.placeholder || el.name || "";

    function fieldOf(el) {
      const tag = el.tagName;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (tag === "INPUT" && /^(hidden|submit|button|image|reset|file|radio)$/.test(type)) return null;
      if (type !== "checkbox" && !visible(el)) return null;
      const kind = tag === "SELECT" ? "select" : tag === "TEXTAREA" ? "textarea" : type === "checkbox" ? "checkbox" : "text";
      return bindControl(el, {
        kind,
        name: el.name || el.id || kind,
        label: labelOf(el).slice(0, 80),
        placeholder: el.placeholder || "",
        value: kind === "checkbox" ? el.checked : kind === "select" ? (el.selectedOptions[0]?.text || "").trim() : type === "password" ? "" : el.value,
        options: kind === "select" ? [...el.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 60) : [],
        inputType: tag === "INPUT" ? type || "text" : kind,
      });
    }

    function buttonOf(el) {
      const label = (text(el) || el.getAttribute("aria-label") || el.value || "").slice(0, 60);
      if (label.length < 2 || el.disabled) return null;
      return { id: bindControl(el, { kind: "button", name: "button", label }).id, label };
    }

    function formOf(form) {
      const fields = [...form.querySelectorAll("input, select, textarea")].map(fieldOf).filter(Boolean).slice(0, 16);
      if (!fields.length) return null;
      const submitEl = [...form.querySelectorAll('button:not([type]), button[type="submit"], input[type="submit"]')].find(visible);
      const submitLabel = submitEl ? (text(submitEl) || submitEl.value || "Submit").slice(0, 60) : "";
      const ctl = bindControl(form, { kind: "form", name: form.getAttribute("name") || form.id || "form", label: text(form.querySelector("legend, h2, h3, h4")).slice(0, 100) });
      return {
        type: "form",
        id: ctl.id,
        title: ctl.label,
        fields,
        submit: submitEl ? { id: bindControl(submitEl, { kind: "submit", name: "submit", label: submitLabel }).id, label: submitLabel } : null,
      };
    }

    // Repeated sibling patterns become card lists: products, posts, results, events.
    const sig = (el) => el.tagName + "." + [...el.classList].filter((c) => !/active|selected|current|hover|first|last|odd|even/i.test(c)).sort().join(".");
    function cardsOf(parent) {
      const kids = [...parent.children].filter(visible);
      if (kids.length < 3) return null;
      const counts = new Map();
      kids.forEach((k) => counts.set(sig(k), (counts.get(sig(k)) || 0) + 1));
      const [best, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (n < 3 || n < kids.length * 0.6) return null;
      const same = kids.filter((k) => sig(k) === best);
      if (same.filter((k) => k.matches("a[href]") || k.querySelector("img, a[href]")).length < same.length * 0.6) return null;
      const avg = same.reduce((sum, k) => sum + text(k).length, 0) / same.length;
      if (avg > 500 || avg < 3) return null;
      const items = same.slice(0, 40).map((k) => {
        const h = k.querySelector("h1, h2, h3, h4, h5, h6, [class*=title i], strong, b");
        const a = k.matches("a[href]") ? k : k.querySelector("a[href]");
        const img = k.querySelector("img");
        const title = (text(h) || text(a) || text(k).slice(0, 80)).slice(0, 160);
        const bits = [...new Set([...k.querySelectorAll("p, span, small, time, li, div")]
          .filter((d) => !d.querySelector("p, div, li"))
          .map(text)
          .filter((t) => t && t.length < 200 && !title.includes(t)))].slice(0, 6);
        const actions = [...k.querySelectorAll("button")].filter(visible).map(buttonOf).filter(Boolean).slice(0, 2);
        const image = img ? imageOf(img) : null;
        return { title, text: bits, image, imageRole: image ? roleOf(sizeOf(img)) : null, href: linkOf(a), actions };
      }).filter((item) => item.title);
      return items.length >= 3 ? { type: "cards", items } : null;
    }

    const searchInput = [...document.querySelectorAll('input[type="search"], [role="search"] input, input[name="q"], input[name="query"], input[name="search"], input[name="s"], input[name="k"], input[aria-label*="search" i], input[placeholder*="search" i]')]
      .find((el) => visible(el) && !/^(hidden|submit|checkbox|radio|button)$/.test(el.type));
    const searchForm = searchInput?.form || null;

    const sections = [];
    let section = null;
    let budget = 8000;
    const seenText = new Set();
    const open = (title) => {
      section = { id: `s${sections.length + 1}`, title, blocks: [] };
      sections.push(section);
    };
    const push = (block) => {
      if (!section) open("");
      if (section.blocks.length < 30) section.blocks.push(block);
    };
    const isLeafText = (el) => [...el.children].every((c) => INLINE.test(c.tagName));

    // Returns true when the element was consumed and its subtree should not be walked.
    function handle(el) {
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const t = text(el).slice(0, 160);
        if (t) tag <= "H3" ? open(t) : push({ type: "subheading", text: t });
        return true;
      }
      if (tag === "FORM") {
        if (el !== searchForm) {
          const form = formOf(el);
          if (form) push(form);
        }
        return true;
      }
      if (el.children.length >= 2 && tag !== "P" && tag !== "TABLE") {
        const icons = iconsOf(el);
        if (icons) {
          push(icons);
          return true;
        }
      }
      if (el.children.length >= 3 && tag !== "P" && tag !== "TABLE") {
        const cards = cardsOf(el);
        if (cards) {
          push(cards);
          return true;
        }
      }
      if (tag === "UL" || tag === "OL") {
        const items = [...el.children].map((li) => clean(li).trim()).filter(Boolean);
        if (!items.length || items.join("").length / items.length > 600) return false;
        push({ type: "list", items: items.slice(0, 20) });
        return true;
      }
      if (tag === "IMG" || tag === "PICTURE" || tag === "FIGURE") {
        const img = tag === "IMG" ? el : el.querySelector("img");
        const dims = img ? sizeOf(img) : { w: 0, h: 0 };
        const role = roleOf(dims);
        // Lone small images are usually decoration; keep them only when they carry meaning.
        if (img && dims.w >= 16 && (role !== "icon" || img.alt)) {
          const src = imageOf(img);
          if (src) push({ type: "image", src, alt: (img.alt || "").slice(0, 200), caption: text(el.querySelector("figcaption")).slice(0, 300), w: dims.w, h: dims.h, role });
        }
        return tag !== "FIGURE" || !el.querySelector("p, ul, table");
      }
      if (tag === "TABLE") {
        if (el.querySelector("table") || text(el).length > 4000) return false;
        const rows = [...el.rows].slice(0, 14).map((tr) => [...tr.cells].slice(0, 6).map((c) => text(c).slice(0, 120)));
        if (rows.length > 1) push({ type: "table", rows });
        return true;
      }
      if (tag === "BUTTON") {
        const button = buttonOf(el);
        if (button) push({ type: "button", ...button });
        return true;
      }
      if (tag === "A" && !el.querySelector("img, h1, h2, h3, h4, p, div")) {
        const href = linkOf(el);
        const t = text(el);
        if (href && t.length >= 2 && t.length <= 80) push({ type: "link", text: t, href });
        return true;
      }
      if (tag === "P" || tag === "BLOCKQUOTE" || (isLeafText(el) && text(el).length >= 20)) {
        const plain = text(el);
        if (plain.length < 2 || seenText.has(plain)) return true;
        seenText.add(plain);
        const html = clean(el).trim().slice(0, 3000);
        push(tag === "BLOCKQUOTE" ? { type: "quote", html } : { type: "p", html });
        return true;
      }
      return false;
    }

    const walk = (parent) => {
      for (const el of parent.children) {
        if (--budget < 0 || sections.length > 40) return;
        if (el.matches(GENERIC_SKIP)) continue;
        if (root === document.body && el.matches(CHROME) && !el.closest("article")) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        if (/cookie|consent|gdpr/i.test(`${el.id} ${el.getAttribute("class") || ""}`) && /fixed|sticky/.test(style.position)) continue;
        if (!handle(el)) walk(el);
      }
    };
    walk(root);

    const linksIn = (sel, n) => {
      const out = [];
      const seen = new Set();
      for (const a of document.querySelectorAll(sel)) {
        if (out.length >= n) break;
        const t = text(a).slice(0, 60);
        const href = linkOf(a);
        if (!t || !href || seen.has(href) || !visible(a)) continue;
        seen.add(href);
        out.push({ text: t, href });
      }
      return out;
    };

    const finalSections = sections.filter((s) => s.blocks.length).slice(0, 40).map((s, i) => {
      const plain = s.blocks.map((b) => b.html || b.text || b.items?.map((x) => x.title || x).join(" ") || "").join(" ").replace(/<[^>]+>/g, " ");
      return { ...s, index: i + 1, wordCount: plain.split(/\s+/).filter(Boolean).length };
    });
    const blocks = finalSections.flatMap((s) => s.blocks);
    const wordCount = finalSections.reduce((sum, s) => sum + s.wordCount, 0);
    const cardCount = blocks.filter((b) => b.type === "cards").reduce((sum, b) => sum + b.items.length, 0);
    const largestList = Math.max(0, ...blocks.filter((b) => b.type === "cards").map((b) => b.items.length));
    const bigForm = blocks.some((b) => b.type === "form" && b.fields.length >= 3);
    const archetype = bigForm && wordCount < 400 ? "form"
      : largestList >= 8 && wordCount <= 1500 ? "listing"
      : wordCount > 700 ? "article"
      : largestList >= 8 ? "listing"
      : "landing";
    const firstImage = blocks.find((b) => b.type === "image" && (b.role === "hero" || b.role === "photo"))
      || blocks.find((b) => b.type === "cards")?.items.find((i) => i.image && i.imageRole !== "icon");
    const ogImage = meta('meta[property="og:image"]');

    return {
      generic: true,
      archetype,
      site: brand.name,
      url: location.href,
      title: (meta('meta[property="og:title"]') || text(root.querySelector("h1") || document.querySelector("h1")) || document.title).slice(0, 200),
      description: (meta('meta[name="description"]') || meta('meta[property="og:description"]')).slice(0, 400),
      brand,
      heroImage: ogImage ? { src: absoluteUrl(ogImage), alt: "" } : firstImage ? { src: firstImage.src || firstImage.image, alt: firstImage.alt || firstImage.title || "" } : null,
      nav: linksIn("header a[href], nav a[href], [role=banner] a[href], [role=navigation] a[href]", 24),
      search: searchInput ? {
        inputId: bindControl(searchInput, { kind: "search", name: "q", label: "Search", placeholder: searchInput.placeholder || "Search" }).id,
        placeholder: searchInput.placeholder || `Search ${brand.name}`,
      } : null,
      sections: finalSections,
      footer: linksIn("footer a[href], [role=contentinfo] a[href]", 30),
      stats: { wordCount, sectionCount: finalSections.length, imageCount: blocks.filter((b) => b.type === "image").length, cardCount },
    };
  }

  const GENERIC_SCHEMA = `type Data = {
  generic: true;
  archetype: "article" | "listing" | "form" | "landing";
  site: string;                  // brand name
  url: string; title: string; description: string;   // description may be ""
  brand: {
    name: string; logo: string | null; favicon: string | null;
    colors: { primary: string | null; accent: string | null; bg: string | null; text: string | null };
  };                             // the host also sets CSS variables --brand-primary, --brand-accent, --brand-bg, --brand-text (any may be unset)
  heroImage: { src: string; alt: string } | null;
  nav: { text: string; href: string }[];             // may be empty
  search: { inputId: string; placeholder: string } | null;
  sections: {
    id: string; title: string;   // title may be "" (untitled intro or block run)
    index: number; wordCount: number;
    blocks: (
      | { type: "p"; html: string }                  // sanitized HTML (a, b, i only)
      | { type: "subheading"; text: string }
      | { type: "list"; items: string[] }            // sanitized HTML items
      | { type: "quote"; html: string }
      | { type: "image"; src: string; alt: string; caption: string;
          w: number; h: number;                      // size in px on the ORIGINAL page
          role: "icon" | "thumb" | "photo" | "hero" }  // icon ≤96px, thumb ≤240px: keep them near w, never more than 1.5×
      | { type: "icons"; size: number; items: { src: string; alt: string; label: string; href: string | null }[] }
                                                     // a row of small images (badges, logos, avatars) about size px each: render inline, wrapped, at that size
      | { type: "table"; rows: string[][] }          // first row is usually the header
      | { type: "link"; text: string; href: string } // standalone call-to-action link
      | { type: "button"; id: string; label: string }  // a real button on the page
      | { type: "cards"; items: { title: string; text: string[]; image: string | null;
          imageRole: "icon" | "thumb" | "photo" | "hero" | null;   // icon = avatar/logo-sized: show it small, never as a cover
          href: string | null; actions: { id: string; label: string }[] }[] }  // products, posts, results, events; up to 40
      | { type: "form"; id: string; title: string; fields: Field[]; submit: { id: string; label: string } | null }
    )[];
  }[];                           // 1 to 40 sections of very uneven size
  footer: { text: string; href: string }[];
  stats: { wordCount: number; sectionCount: number; imageCount: number; cardCount: number };
};
type Field = { id: string; kind: "text" | "select" | "checkbox" | "textarea"; name: string; label: string;
               placeholder: string; value: string | boolean; options: string[]; inputType: string };

CONTROLS CONTRACT (the host forwards these to the real page, so the site keeps working):
- form: <form data-bound-form="FORM.id"> containing every field as <input|select|textarea data-bind="FIELD.id" name="FIELD.name">
  (selects list FIELD.options as <option>, checkboxes use checked, text inputs keep FIELD.inputType) and, when present,
  <button type="submit" data-bind="SUBMIT.id">SUBMIT.label</button>. Include <p data-rm-form-status role="status"></p>.
- button blocks and card actions: <button type="button" data-bind="ID">LABEL</button>.
- search: when data.search exists, render <form data-search><input name="q" placeholder="..."></form>.
- data-bind values must come from the data. Never invent IDs.`;

  const TYPES = {
    "irctc:home": { extract: irctcHome, schema: IRCTC_SCHEMA },
    "wikipedia:article": { extract: wikipediaArticle, schema: WIKI_SCHEMA },
    "hn:list": { extract: hnList, schema: HN_LIST_SCHEMA },
    "hn:item": { extract: hnItem, schema: HN_ITEM_SCHEMA },
    generic: { extract: genericPage, schema: GENERIC_SCHEMA },
  };

  function detect() {
    const host = location.hostname;
    if (host.endsWith("wikipedia.org") && location.pathname.startsWith("/wiki/")) {
      const page = decodeURIComponent(location.pathname.slice(6));
      if (!page.includes(":") || page.startsWith("Main_Page")) return { site: "wikipedia", type: "wikipedia:article" };
    }
    if (host === "news.ycombinator.com") {
      if (location.pathname === "/item") return { site: "hn", type: "hn:item" };
      if (/^\/(news|newest|front|ask|show|best|active)?$/.test(location.pathname)) return { site: "hn", type: "hn:list" };
    }
    if ((host === "www.irctc.co.in" || host === "irctc.co.in") && location.pathname.startsWith("/nget/train-search")) {
      return { site: "irctc", type: "irctc:home" };
    }
    // Other IRCTC routes return null so the content script keeps watching for Angular routing to the search page.
    if (/^https?:$/.test(location.protocol) && !/(^|\.)irctc\.co\.in$/.test(host)) {
      return { site: host, type: "generic", generic: true };
    }
    return null;
  }

  // A trimmed copy for the prompt: the model needs the shape, not the whole article.
  function sample(data, type) {
    const copy = JSON.parse(JSON.stringify(data));
    const cut = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "…" : s);
    if (type === "wikipedia:article") {
      copy.lead = copy.lead.slice(0, 2).map((p) => cut(p, 500));
      copy.sections = copy.sections.slice(0, 5).map((s) => ({ ...s, blocks: s.blocks.slice(0, 4).map((b) => ({ ...b, html: cut(b.html, 400), items: b.items?.slice(0, 3) })) }));
      copy.images = copy.images.slice(0, 4);
      if (copy.infobox) copy.infobox.rows = copy.infobox.rows.slice(0, 8);
      copy.seeAlso = copy.seeAlso.slice(0, 4);
    } else if (type === "hn:list") {
      copy.items = copy.items.slice(0, 6);
    } else if (type === "hn:item") {
      copy.comments = copy.comments.slice(0, 8).map((c) => ({ ...c, html: cut(c.html, 300) }));
    } else if (type === "irctc:home") {
      copy.nav = copy.nav.slice(0, 12);
      copy.services = copy.services.slice(0, 10);
      copy.holidays = copy.holidays.slice(0, 6).map((item) => ({ ...item, description: cut(item.description, 260) }));
      copy.notices = copy.notices.slice(0, 4).map((item) => cut(item, 220));
      copy.footer = copy.footer.slice(0, 12);
    } else if (type === "generic") {
      copy.outline = data.sections.map((s) => `${s.id} "${cut(s.title, 60)}": ${s.blocks.map((b) => b.type).join(", ")}`);
      copy.nav = copy.nav.slice(0, 10);
      copy.footer = copy.footer.slice(0, 8);
      copy.sections = copy.sections.slice(0, 8).map((s) => ({
        ...s,
        blocks: s.blocks.slice(0, 6).map((b) => {
          if (b.type === "cards") return { ...b, items: b.items.slice(0, 4).map((i) => ({ ...i, text: i.text.slice(0, 3) })) };
          if (b.type === "list") return { ...b, items: b.items.slice(0, 4).map((i) => cut(i, 160)) };
          if (b.type === "table") return { ...b, rows: b.rows.slice(0, 4) };
          if (b.type === "icons") return { ...b, items: b.items.slice(0, 4) };
          if (b.type === "form") return { ...b, fields: b.fields.map((f) => ({ ...f, value: typeof f.value === "string" ? "" : f.value, options: f.options.slice(0, 6) })) };
          return { ...b, html: cut(b.html, 300) };
        }),
      }));
    }
    return copy;
  }

  window.RemodelExtract = {
    detect,
    extract: (type) => TYPES[type].extract(),
    schema: (type) => TYPES[type].schema,
    sample,
  };
})();

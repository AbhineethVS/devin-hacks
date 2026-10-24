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

  const TYPES = {
    "wikipedia:article": { extract: wikipediaArticle, schema: WIKI_SCHEMA },
    "hn:list": { extract: hnList, schema: HN_LIST_SCHEMA },
    "hn:item": { extract: hnItem, schema: HN_ITEM_SCHEMA },
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

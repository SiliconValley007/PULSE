// PULSE live news snapshot. Node 20+, zero dependencies.
import { writeFile } from "node:fs/promises";

const OUT_JSON = new URL("../data/fallback-feed.json", import.meta.url);
const OUT_JS = new URL("../data/fallback-feed.js", import.meta.url);
const UA = {
  "user-agent": "Mozilla/5.0 (compatible; PulseBot/4.0; +https://github.com)",
  accept: "text/html,application/xml,application/rss+xml,*/*",
};
const GN = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

// [url, category, publisher label (null = from item)]
const FEEDS = [
  [
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "india",
    "The Hindu",
  ],
  [
    "https://www.thehindu.com/news/cities/feeder/default.rss",
    "local",
    "The Hindu",
  ],
  ["https://www.thehindu.com/sport/feeder/default.rss", "sports", "The Hindu"],
  [
    "https://www.thehindu.com/business/feeder/default.rss",
    "business",
    "The Hindu",
  ],
  [
    "https://www.thehindu.com/sci-tech/science/feeder/default.rss",
    "science",
    "The Hindu",
  ],
  ["https://indianexpress.com/feed/", "top", "The Indian Express"],
  [
    "https://indianexpress.com/section/cities/feed/",
    "local",
    "The Indian Express",
  ],
  [
    "https://indianexpress.com/section/sports/feed/",
    "sports",
    "The Indian Express",
  ],
  [
    "https://indianexpress.com/section/technology/feed/",
    "tech",
    "The Indian Express",
  ],
  ["https://feeds.feedburner.com/ndtvnews-top-stories", "top", "NDTV"],
  ["https://feeds.feedburner.com/ndtvnews-india-news", "india", "NDTV"],
  ["https://feeds.bbci.co.uk/news/world/rss.xml", "world", "BBC News"],
  ["https://feeds.bbci.co.uk/news/business/rss.xml", "business", "BBC News"],
  [
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "science",
    "BBC News",
  ],
  ["https://feeds.bbci.co.uk/news/technology/rss.xml", "tech", "BBC News"],
  ["https://www.aljazeera.com/xml/rss/all.xml", "world", "Al Jazeera"],
  ["https://techcrunch.com/feed/", "tech", "TechCrunch"],
  [
    "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
    "business",
    "Economic Times",
  ],
  [GN("site:reuters.com when:2d"), "world", "Reuters"],
  [GN("site:reuters.com business when:2d"), "business", "Reuters"],
  [GN("site:reuters.com technology when:2d"), "tech", "Reuters"],
];

const POOL = {
  top: [
    "1504711434969-e33886168f5c",
    "1495020689067-958852a7765e",
    "1585829365295-ab7cd400c167",
    "1499364615650-ec38552f4f34",
    "1557804506-669a67965ba0",
    "1488646953014-85cb44e25828",
  ],
  local: [
    "1477959858617-67f85cf4f1df",
    "1449824913935-59a10b8d2000",
    "1514525253161-7a46d19cd819",
    "1470229722913-7c0e2dbbafd3",
    "1507676184212-d03ab07a01bf",
    "1503095396549-807759245b35",
  ],
  india: [
    "1524492412937-b28074a5d7da",
    "1532375810709-75b1da00537c",
    "1587474260584-136574528ed5",
    "1477587458883-47145ed94245",
    "1564507592333-c60657eea523",
    "1514222134-b57cbb8ce073",
  ],
  world: [
    "1451187580459-43490279c0fa",
    "1480714378408-67cf0d13bc1b",
    "1521295121783-8a321d551ad2",
    "1569025743873-ea3a9ade89f9",
    "1526778548025-fa2f459cd5c1",
    "1488085061387-422e29b40080",
  ],
  tech: [
    "1550751827-4bd374c3f58b",
    "1485827404703-89b55fcc595e",
    "1488590528505-98d2b5aba04b",
    "1531297484001-80022131f5a1",
    "1518770660439-4636190af475",
    "1526374965328-7f61d4dc18c5",
  ],
  business: [
    "1460925895917-afdab827c52f",
    "1590283603385-17ffb3a7f29f",
    "1611974789855-9c2a0a7236a3",
    "1507679799987-c73779587ccf",
    "1554224155-6726b3ff858f",
    "1486406146926-c627a92ad1ab",
  ],
  sports: [
    "1517649763962-0c623066013b",
    "1517836357463-d25dfeac3438",
    "1546519638-68e109498ffc",
    "1574629810360-7efbbe195018",
    "1461896836934-ffe607ba8211",
    "1540747913346-19e32dc3e97e",
  ],
  science: [
    "1576086213369-97a306d36557",
    "1530026405186-ed1f139313f8",
    "1507413245164-6160d8298b31",
    "1532094349884-543bc11b234d",
    "1446776811953-b23d57bd21aa",
    "1581093458791-9d15482442f7",
  ],
};
const hash = (s) => {
  let h = 5381;
  for (const c of String(s)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const stock = (cat, seed, k = 0) => {
  const a = POOL[cat] || POOL.top;
  return `https://images.unsplash.com/photo-${a[(parseInt(hash(seed), 36) + k) % a.length]}?auto=format&fit=crop&w=720&h=1280&q=70`;
};

const ENT = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&amp;": "&",
};
const dec = (s) =>
  s.replace(/&(lt|gt|quot|#39|apos|nbsp|amp);/g, (m) => ENT[m]);
const strip = (h) =>
  dec(
    dec(String(h || "").replace(/<!\[CDATA\[|\]\]>/g, "")).replace(
      /<[^>]*>/g,
      " ",
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
const tag = (x, t) => {
  const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i"));
  return m ? m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim() : "";
};
const attr = (x, t, a) => {
  const m = x.match(new RegExp(`<${t}\\b[^>]*\\b${a}=["']([^"']+)["']`, "i"));
  return m ? dec(m[1]) : "";
};
const words = (s, n) => {
  const w = s.split(/\s+/);
  return w.length <= n ? s : w.slice(0, n).join(" ") + "…";
};
const sentences = (t) =>
  t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
const BAD = new RegExp("wi" + "ki(pedia|media)\\.org", "i");

async function get(u, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(u, {
      headers: UA,
      signal: c.signal,
      redirect: "follow",
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const meta = (html, key) => {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']*)["']`,
      "i",
    ),
  );
  const b = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${k}["']`,
      "i",
    ),
  );
  return dec((a || b || [, ""])[1]).trim();
};
// OpenGraph enrichment: 2500 ms timeout per article.
async function og(link) {
  const html = (await get(link, 2500)).slice(0, 400000);
  let img = meta(html, "og:image") || meta(html, "twitter:image");
  if (img.startsWith("//")) img = "https:" + img;
  if (img.startsWith("/")) {
    try {
      img = new URL(img, link).href;
    } catch {
      img = "";
    }
  }
  const desc = strip(meta(html, "og:description") || meta(html, "description"));
  return { img: /^https?:\/\//.test(img) ? img : "", desc };
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const it = items[i++];
        try {
          await fn(it);
        } catch {}
      }
    }),
  );
}
const TITLE_YEAR = /\b(19\d\d|20[01]\d|202[0-5])\b/;
const CATW = {
  top: "top-story",
  local: "local",
  india: "India",
  world: "world",
  tech: "tech",
  business: "business",
  sports: "sports",
  science: "science",
};
const norm1 = (t) =>
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function goodText(text, title, src) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  const n = norm1(t);
  if (n === norm1(src) || n === norm1(title)) return false;
  let rest = t
    .split(title)
    .join(" ")
    .replace(new RegExp(escRe(src), "ig"), " ");
  rest = rest
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return rest.length >= 35;
}
function finish(s) {
  const ok = goodText(s.text, s.title, s.src);
  const ss = ok ? sentences(s.text) : [];
  s.bullets = ss.slice(1, 4).map((x) => words(x, 28));
  s.summary = ok
    ? words(s.text, 60)
    : `Breaking ${CATW[s.cat] || s.cat} coverage reported by ${s.src}. Tap Read for the full story.`;
  s.fullText = ok ? s.text : "";
}

function feedImage(item, desc) {
  const u =
    attr(item, "media:content", "url") ||
    attr(item, "media:thumbnail", "url") ||
    (/image/i.test(attr(item, "enclosure", "type"))
      ? attr(item, "enclosure", "url")
      : "") ||
    attr(dec(desc), "img", "src");
  return /^https?:\/\//.test(u) ? u : "";
}

function parse(xml, cat, label) {
  const out = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const it of items.slice(0, 8)) {
    let title = strip(tag(it, "title"));
    const link = strip(tag(it, "link")) || attr(it, "link", "href");
    if (!title || !/^https?:\/\//.test(link) || BAD.test(link)) continue;
    let src = label || strip(tag(it, "source"));
    const m = title.match(/^(.*\S)\s+-\s+([^-]{2,40})$/);
    if (m && /news\.google\./.test(link)) {
      title = m[1];
      if (!label) src = m[2];
    }
    const descRaw = tag(it, "description") || tag(it, "content:encoded");
    const text = strip(descRaw).replace(title, "").trim();
    const ts = Date.parse(tag(it, "pubDate") || tag(it, "dc:date"));
    const now = Date.now();
    // Freshness gate: valid, not in the future, within 14 days, no explicit past year in the headline.
    if (
      isNaN(ts) ||
      ts <= 0 ||
      ts > now + 300000 ||
      now - ts > 14 * 864e5 ||
      TITLE_YEAR.test(title)
    )
      continue;
    let dom = "";
    try {
      dom = new URL(link).hostname.replace(/^www\./, "");
    } catch {}
    const img = feedImage(it, descRaw);
    const s = {
      id: hash(link),
      title,
      url: link,
      src: src || dom,
      dom,
      ts,
      img,
      hasImg: !!img,
      cat,
      text,
    };
    finish(s);
    out.push(s);
  }
  return out;
}

const results = await Promise.allSettled(
  FEEDS.map(async ([u, cat, label]) => parse(await get(u), cat, label)),
);
let stories = [];
results.forEach((r, i) => {
  if (r.status === "fulfilled") stories.push(...r.value);
  else console.warn("FAIL", FEEDS[i][0], String(r.reason));
});
const seen = new Set();
stories = stories
  .filter((s) => {
    const k = s.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .slice(0, 60);
    if (seen.has(k) || seen.has(s.id)) return false;
    seen.add(k);
    seen.add(s.id);
    return true;
  })
  .sort((a, b) => b.ts - a.ts)
  .slice(0, 90);

// OpenGraph pass for items with no image or a thin description (pool of 6).
const need = stories.filter(
  (s) => (!s.hasImg || s.text.length < 80) && !/news\.google\./.test(s.url),
);
await pool(need, 6, async (s) => {
  const o = await og(s.url);
  if (o.img && !s.hasImg) {
    s.img = o.img;
    s.hasImg = true;
  }
  if (o.desc && o.desc.length > s.text.length) {
    s.text = o.desc;
    finish(s);
  }
});
console.log(`OG-enriched candidates: ${need.length}`);

const tops = [];
for (const c of [
  "india",
  "world",
  "tech",
  "business",
  "sports",
  "science",
  "local",
]) {
  const s = stories.find((x) => x.cat === c);
  if (s) tops.push({ ...s, id: s.id + "t", cat: "top" });
}
stories = [...tops, ...stories];
// Never leave a blank card and never repeat an image on adjacent cards.
stories.forEach((s, i) => {
  if (!s.img) s.img = stock(s.cat, s.title);
  const prev = stories[i - 1];
  for (let k = 1; prev && s.img === prev.img && k < 7; k++)
    s.img = stock(s.cat, s.title, k);
});
stories.forEach((s) => {
  delete s.hasImg;
  delete s.text;
});

console.log(`Scraped ${stories.length} stories`);
if (stories.length < 10) {
  console.warn("Too few stories; keeping existing snapshot.");
  process.exit(0);
}
const payload = {
  updated: new Date().toISOString(),
  count: stories.length,
  isSeed: false,
  stories,
};
await writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");
await writeFile(
  OUT_JS,
  "window.PULSE_FALLBACK=" + JSON.stringify(payload) + ";\n",
);

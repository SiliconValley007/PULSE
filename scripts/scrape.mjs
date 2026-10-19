import { readFile, writeFile } from "node:fs/promises";
const OUT = new URL("../data/fallback-feed.json", import.meta.url),
  OUTJS = new URL("../data/fallback-feed.js", import.meta.url);
const UA = { "user-agent": "Mozilla/5.0 (compatible; PulseBot/2.0)" };
const dec = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
const strip = (h) =>
  dec(dec(String(h || "")).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
const hash = (s) => {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const tag = (x, t) => {
  const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
  return m ? m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim() : "";
};
const get = async (u, json = true) => {
  const c = new AbortController(),
    t = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(u, { headers: UA, signal: c.signal });
    if (!r.ok) throw new Error(r.status);
    return json ? await r.json() : await r.text();
  } finally {
    clearTimeout(t);
  }
};
const splitS = (t) =>
  String(t || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
const clip = (s, n) => {
  s = s.trim();
  if (s.length <= n) return s;
  const c = s.slice(0, n - 1);
  return c.slice(0, c.lastIndexOf(" ")) + "…";
};
const sent = (s) => {
  s = s.trim();
  return /[.!?…]$/.test(s) ? s : s + ".";
};
function build(r, cat, viral) {
  let title = strip(r.title),
    src = strip(r.source || "");
  if (!src) {
    const m = title.match(/^(.*) - ([^-]{2,40})$/);
    if (m) {
      title = m[1];
      src = m[2];
    }
  } else if (title.endsWith(" - " + src))
    title = title.slice(0, -(src.length + 3));
  if (!title || title.length < 12 || /\[removed\]/i.test(title) || !r.link)
    return null;
  const desc = strip(r.desc || ""),
    content = strip(String(r.content || "").replace(/\[\+\d+ chars\]/, ""));
  const related = (r.related || []).filter(
      (q) => q.t && norm(q.t) !== norm(title),
    ),
    facts = r.facts || [];
  if (!(desc.length >= 80 || related.length >= 2 || facts.length >= 2))
    return null;
  const ss = splitS(desc).filter((s) => s.length >= 30);
  let b;
  if (ss.length >= 3) b = ss.slice(0, 3);
  else {
    b = [sent(title)].concat(ss);
    related.forEach((q) =>
      b.push(sent((q.s ? q.s + " reports: " : "Related coverage: ") + q.t)),
    );
    facts.forEach((f) => b.push(f));
  }
  const seen = new Set();
  b = b
    .filter((s) => s.length > 25 && !seen.has(norm(s)) && seen.add(norm(s)))
    .slice(0, 3)
    .map((s) => clip(s, 130));
  if (b.length < 3) return null;
  const body = content.length > desc.length ? content : desc,
    bs = splitS(body),
    paras = [sent(title) + (src ? " Source: " + src + "." : "")];
  for (let i = 0; i < bs.length; i += 2)
    paras.push(bs.slice(i, i + 2).join(" "));
  if (related.length)
    paras.push(
      "Other outlets covering this story: " +
        related.map((q) => (q.s ? q.s + " — " : "") + q.t).join("; ") +
        ".",
    );
  facts.forEach((f) => paras.push(f));
  const fullText = paras.join("\n\n");
  let dom = "";
  try {
    dom = new URL(r.link).hostname.replace(/^www\./, "");
  } catch {}
  return {
    id: hash(norm(title)),
    title,
    url: r.link,
    src: src || dom,
    dom,
    ts: Date.parse(r.pubDate) || Date.now(),
    img: String(r.img || "").replace(/^http:/, "https:"),
    cat,
    viral: !!viral,
    bullets: b,
    fullText,
    read: Math.max(1, Math.round(fullText.split(" ").length / 180)),
  };
}
const SCAT = {
  general: "world",
  technology: "tech",
  business: "business",
  science: "science",
  entertainment: "culture",
  sports: "sports",
};
const jobs = [];
for (const cc of ["us", "in", "gb"])
  for (const [k, c] of Object.entries(SCAT))
    jobs.push(async () => {
      const j = await get(
        `https://saurav.tech/NewsAPI/top-headlines/category/${k}/${cc}.json`,
      );
      return (j.articles || [])
        .slice(0, 10)
        .map((a, i) =>
          build(
            {
              title: a.title,
              link: a.url,
              pubDate: a.publishedAt,
              desc: a.description,
              content: a.content,
              source: a.source && a.source.name,
              img: a.urlToImage,
            },
            c,
            i < 1,
          ),
        )
        .map((x) => x && Object.assign(x, { enrich: true }));
    });
jobs.push(async () => {
  const a = await get("https://dev.to/api/articles?top=1&per_page=15");
  return a.map((i) =>
    build(
      {
        title: i.title,
        link: i.url,
        pubDate: i.published_at,
        desc: i.description,
        source: "DEV Community",
        img: i.cover_image || i.social_image,
        facts: [
          i.tag_list && i.tag_list.length
            ? "Tagged " +
              (Array.isArray(i.tag_list) ? i.tag_list.join(", ") : i.tag_list) +
              " on DEV Community."
            : "",
          "Written by " +
            ((i.user && i.user.name) || "a DEV author") +
            " with " +
            (i.public_reactions_count || 0) +
            " reactions and a " +
            (i.reading_time_minutes || 1) +
            "-minute read.",
        ].filter((x) => x.length > 25),
      },
      "tech",
      false,
    ),
  );
});
jobs.push(async () => {
  const j = await get(
    "https://api.spaceflightnewsapi.net/v4/articles/?limit=15",
  );
  return j.results.map((a) =>
    build(
      {
        title: a.title,
        link: a.url,
        pubDate: a.published_at,
        desc: a.summary,
        source: a.news_site,
        img: a.image_url,
      },
      "science",
      false,
    ),
  );
});
jobs.push(async () => {
  const d = new Date(Date.now() - 864e5),
    p = (n) => String(n).padStart(2, "0");
  const j = await get(
    `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`,
  );
  const o = (j.news || []).map((n) => {
    const t = strip(n.story),
      ls = n.links || [],
      l = ls.find((x) => x.thumbnail) || ls[0];
    if (!l) return null;
    const ex = ls
      .slice(0, 3)
      .map((x) => x.extract || "")
      .filter(Boolean)
      .join(" ");
    return build(
      {
        title: t.length > 110 ? t.slice(0, t.lastIndexOf(" ", 108)) + "…" : t,
        link: l.content_urls
          ? l.content_urls.desktop.page
          : "https://en.wikipedia.org",
        pubDate: new Date().toISOString(),
        desc: t + " " + ex,
        source: "Wikipedia",
        img: l.thumbnail ? l.thumbnail.source : "",
      },
      "world",
      false,
    );
  });
  return o;
});
const tops = [
  ["WORLD", "world"],
  ["TECHNOLOGY", "tech"],
  ["SCIENCE", "science"],
  ["BUSINESS", "business"],
  ["SPORTS", "sports"],
  ["ENTERTAINMENT", "culture"],
];
const editions = ["IN", "US", "GB", "CA", "AU", "JP"].map((cc) => ({
  path: "",
  cc,
  cat: "world",
}));
tops.forEach(([t, c]) =>
  editions.push({ path: "/headlines/section/topic/" + t, cc: "US", cat: c }),
);
tops
  .slice(1)
  .forEach(([t, c]) =>
    editions.push({ path: "/headlines/section/topic/" + t, cc: "IN", cat: c }),
  );
for (const e of editions)
  jobs.push(async () => {
    const x = await get(
      `https://news.google.com/rss${e.path}?hl=en-${e.cc}&gl=${e.cc}&ceid=${e.cc}:en`,
      false,
    );
    return (x.match(/<item>[\s\S]*?<\/item>/g) || [])
      .slice(0, 10)
      .map((it, i) => {
        const raw = dec(tag(it, "description")),
          related = [...raw.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => ({
            t: strip((m[1].match(/<a[^>]*>([\s\S]*?)<\/a>/) || [, ""])[1]),
            s: strip(
              (m[1].match(/<font[^>]*>([\s\S]*?)<\/font>/) || [, ""])[1],
            ),
          }));
        return build(
          {
            title: tag(it, "title"),
            link: tag(it, "link"),
            pubDate: tag(it, "pubDate"),
            desc: "",
            related,
            source: tag(it, "source"),
          },
          e.cat,
          i < 2,
        );
      });
  });
jobs.push(async () => {
  const out = [];
  for (const q of ["breaking news", "India", "technology"]) {
    try {
      const j = await get(
        "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
          encodeURIComponent(q + " sourcelang:eng") +
          "&mode=ArtList&maxrecords=25&format=json&sort=DateDesc",
      );
      for (const x of j.articles || []) {
        const d = x.seendate || "",
          ts =
            d.length >= 15
              ? Date.UTC(
                  +d.slice(0, 4),
                  +d.slice(4, 6) - 1,
                  +d.slice(6, 8),
                  +d.slice(9, 11),
                  +d.slice(11, 13),
                  +d.slice(13, 15),
                )
              : Date.now();
        out.push(
          build(
            {
              title: x.title,
              link: x.url,
              pubDate: new Date(ts).toISOString(),
              desc: "",
              source: x.domain,
              img: x.socialimage,
              facts: [
                "The article was published by " +
                  (x.domain || "an online outlet") +
                  (x.sourcecountry ? " (" + x.sourcecountry + ")" : "") +
                  ".",
                "GDELT detected it in " +
                  (x.language || "English") +
                  " coverage at " +
                  new Date(ts).toUTCString().slice(5, 22) +
                  " UTC.",
              ],
            },
            q === "technology" ? "tech" : "world",
            false,
          ),
        );
      }
    } catch {}
  }
  return out;
});
jobs.push(async () => {
  const j = await get(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>25&hitsPerPage=15",
  );
  return (j.hits || [])
    .filter((h) => h.title)
    .map((h) =>
      build(
        {
          title: h.title,
          link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          pubDate: new Date(h.created_at_i * 1e3).toISOString(),
          desc: strip(h.story_text || ""),
          source: "Hacker News",
          facts: [
            "Submitted to Hacker News by " +
              (h.author || "a member") +
              ", now at " +
              (h.points || 0) +
              " points.",
            (h.num_comments || 0) +
              " comments are discussing it on the Hacker News front page.",
          ],
        },
        "tech",
        (h.points || 0) > 200,
      ),
    );
});
const rs = await Promise.allSettled(jobs.map((j) => j()));
rs.forEach((r, i) => {
  if (r.status === "rejected")
    console.warn("source", i, "failed:", r.reason && r.reason.message);
});
const m = new Map();
for (const r of rs)
  if (r.status === "fulfilled")
    for (const s of r.value)
      if (s) {
        const k = norm(s.title).slice(0, 48);
        if (!m.has(k) || (!m.get(k).img && s.img)) m.set(k, s);
      }
const scraped = [...m.values()]
  .filter((s) => s.bullets.length === 3 && s.fullText.length > 250)
  .sort((a, b) => (a.enrich ? 1 : 0) - (b.enrich ? 1 : 0) || b.ts - a.ts)
  .slice(0, 70);
let prev = { stories: [] };
try {
  prev = JSON.parse(await readFile(OUT, "utf8"));
} catch {}
const curated = (prev.stories || []).filter((s) => /^pb/.test(s.id));
const ogImg = async (u) => {
  const c = new AbortController(),
    t = setTimeout(() => c.abort(), 1500);
  try {
    const r = await fetch(u, {
      headers: UA,
      signal: c.signal,
      redirect: "follow",
    });
    if (!r.ok) return "";
    const h = (await r.text()).slice(0, 200000);
    const m =
      h.match(
        /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      h.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i,
      );
    if (!m) return "";
    const x = new URL(dec(m[1]), r.url || u).href;
    return x.startsWith("https:") ? x : "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
};
const need = scraped
  .filter((s) => !s.img && !/news\.google\.com/.test(s.url))
  .slice(0, 40);
for (let i = 0; i < need.length; i += 10)
  await Promise.allSettled(
    need.slice(i, i + 10).map(async (s) => {
      const g = await ogImg(s.url);
      if (g) s.img = g;
    }),
  );
if (scraped.length < 10) {
  console.error(
    "Too few stories (" + scraped.length + "); keeping existing feed.",
  );
  process.exit(0);
}
const stories = scraped.concat(curated);
const generatedAt = new Date().toISOString();
await writeFile(
  OUT,
  JSON.stringify(
    { generatedAt, updated: generatedAt, count: stories.length, stories },
    null,
    1,
  ),
);
await writeFile(
  OUTJS,
  "window.PULSE_FALLBACK_FEED=" +
    JSON.stringify(stories) +
    ";\nwindow.PULSE_FEED_META=" +
    JSON.stringify({ generatedAt }) +
    ";\n",
);
console.log("Wrote", stories.length, "stories");

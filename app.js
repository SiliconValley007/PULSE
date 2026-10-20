(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const feed = $("#feed");
  const LS = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
  };
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const txt = (h) =>
    new DOMParser()
      .parseFromString(String(h || ""), "text/html")
      .body.textContent.replace(/\s+/g, " ")
      .trim();
  const words = (s, n) => {
    const w = s.split(/\s+/).filter(Boolean);
    return w.length <= n ? s : w.slice(0, n).join(" ") + "…";
  };
  const hash = (s) => {
    let h = 5381;
    for (const c of String(s)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return h.toString(36);
  };
  const BAD = new RegExp("wi" + "ki(pedia|media)\\.org", "i");

  /* ---------- config ---------- */
  const GL = "hl=en-IN&gl=IN&ceid=IN:en";
  const topicURL = (t) =>
    t
      ? `https://news.google.com/rss/headlines/section/topic/${t}?${GL}`
      : `https://news.google.com/rss?${GL}`;
  const searchURL = (q) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&${GL}`;
  const bingURL = (q) =>
    `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&setmkt=en-IN&format=rss`;
  const CATS = [
    {
      id: "foryou",
      label: "For You",
      topic: "",
      q: "India",
      fb: "top",
      sv: ["general/in", "general/us"],
      ok: ["World", "US"],
    },
    { id: "local", label: "Local 📍", local: true, fb: "local" },
    {
      id: "india",
      label: "India",
      topic: "NATION",
      q: "India",
      fb: "india",
      sv: ["general/in"],
      ok: ["World"],
    },
    {
      id: "world",
      label: "World",
      topic: "WORLD",
      q: "world",
      fb: "world",
      sv: ["general/us"],
      ok: ["World", "US"],
    },
    {
      id: "tech",
      label: "Tech",
      topic: "TECHNOLOGY",
      q: "technology",
      fb: "tech",
      sv: ["technology/in", "technology/us"],
      ok: ["Technology"],
    },
    {
      id: "business",
      label: "Business",
      topic: "BUSINESS",
      q: "business economy",
      fb: "business",
      sv: ["business/in", "business/us"],
      ok: ["Business"],
    },
    {
      id: "sports",
      label: "Sports",
      topic: "SPORTS",
      q: "sports",
      fb: "sports",
      sv: ["sports/in", "sports/us"],
      ok: ["Sports"],
    },
    {
      id: "science",
      label: "Science",
      topic: "SCIENCE",
      q: "science",
      fb: "science",
      sv: ["science/in", "science/us"],
      ok: ["Science"],
    },
  ];
  const QUICK = [
    "Jamshedpur",
    "Ranchi",
    "Patna",
    "Kolkata",
    "Delhi",
    "Bangalore",
    "Mumbai",
    "London",
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
  const stock = (cat, seed, k) => {
    const a = POOL[cat] || POOL.top;
    return `https://images.unsplash.com/photo-${a[(parseInt(hash(seed), 36) + (k || 0)) % a.length]}?auto=format&fit=crop&w=720&h=1280&q=70`;
  };
  // No two adjacent cards may share a background image.
  function uniq(items, from) {
    for (let i = Math.max(1, from || 0); i < items.length; i++) {
      const p = items[i - 1].img;
      for (let k = 1; items[i].img === p && k < 8; k++) {
        items[i].img = stock(items[i].cat, items[i].title, k);
        items[i].stock = true;
      }
    }
  }

  /* ---------- state ---------- */
  const state = {
    view: { type: "cat", cat: "foryou" },
    items: [],
    active: 0,
    req: 0,
    more: 0,
    moreQ: "",
    moreCity: false,
    loading: false,
    shown: false,
    instant: false,
    savedList: [],
    commute: false,
    autoAdv: false,
    ttsTok: 0,
    city: "",
  };
  // A city is only trusted if the user chose it (marker key). Anything stored by older builds as a default is discarded.
  const SRC_KEY = "pulse_city_src";
  const cityGet = () => {
    try {
      const c = localStorage.getItem("pulse_user_city") || "";
      if (c && !localStorage.getItem(SRC_KEY)) {
        localStorage.removeItem("pulse_user_city");
        return "";
      }
      return c;
    } catch {
      return "";
    }
  };
  const citySet = (c) => {
    try {
      localStorage.setItem("pulse_user_city", c);
      localStorage.setItem(SRC_KEY, "user");
    } catch {}
  };
  try {
    ["pulse.city", "pulse.liked", "pulse.saved"].forEach((k) =>
      localStorage.removeItem(k),
    );
  } catch {}
  state.savedList = (LS.get("pulse_saved_v2", []) || []).filter(
    (x) => x && x.id && x.title && x.url,
  );
  state.city = cityGet();
  let navTouched = false;
  let retries = 0;
  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[0];
  const k30 = (s) =>
    s.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);
  const tkey = k30;
  const uhash = (u) => {
    try {
      const x = new URL(u);
      return hash(
        x.hostname.replace(/^www\./, "") +
          x.pathname.replace(/\/+$/, "").toLowerCase(),
      );
    } catch {
      return hash(String(u));
    }
  };
  const norm1 = (t) =>
    String(t)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const grams = (t) => {
    const m = new Map();
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const dice = (a, b) => {
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const x = grams(a),
      y = grams(b);
    let n = 0;
    x.forEach((c, g) => {
      n += Math.min(c, y.get(g) || 0);
    });
    return (2 * n) / (a.length + b.length - 2);
  };
  // Title similarity > 65% (normalised bigram Dice or word Jaccard) = same story.
  const similar = (a, b) => {
    const na = norm1(a.title),
      nb = norm1(b.title);
    if (na === nb || dice(na, nb) > 0.65) return true;
    const x = sig(a.title),
      y = sig(b.title);
    if (x.size < 3 || y.size < 3) return false;
    let n = 0;
    x.forEach((w) => {
      if (y.has(w)) n++;
    });
    return n / (x.size + y.size - n) > 0.65;
  };
  const sumKey = (s) => (s.gen ? "" : norm1(s.summary || "").slice(0, 80));
  // Strict de-duplication: 30-char normalised title key, URL hash, and near-identical wording.
  function dedupe(list, existing) {
    const keys = new Set(),
      urls = new Set(),
      pool = (existing || []).slice(),
      kept = [];
    pool.forEach((s) => {
      keys.add(k30(s));
      urls.add(uhash(s.url));
    });
    for (const s of list) {
      const k = k30(s),
        u = uhash(s.url);
      if (
        !k ||
        keys.has(k) ||
        urls.has(u) ||
        pool.some((p) => similar(p, s)) ||
        (sumKey(s).length > 40 && pool.some((p) => sumKey(p) === sumKey(s)))
      )
        continue;
      keys.add(k);
      urls.add(u);
      kept.push(s);
      pool.push(s);
    }
    return kept;
  }
  // Sliding window: never repeat a publisher within two consecutive cards when alternatives exist.
  function spread(items, ctx) {
    const out = [],
      rest = items.slice(),
      hist = (ctx || []).map((s) => s.src);
    while (rest.length) {
      const last2 = hist.concat(out.map((s) => s.src)).slice(-2);
      let i = rest.findIndex((s) => !last2.includes(s.src));
      if (i < 0) i = rest.findIndex((s) => s.src !== last2[last2.length - 1]);
      if (i < 0) i = 0;
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  }
  const sig = (t) =>
    new Set(
      t
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    );
  const overlap = (a, b) => {
    const x = sig(a);
    let n = 0;
    sig(b).forEach((w) => {
      if (x.has(w)) n++;
    });
    return n >= 3;
  };

  /* ---------- network ---------- */
  // Hosts that hard-fail (HTTP error / CORS / network) are skipped for 3 minutes so the console never fills with repeats.
  const dead = {};
  function tfetch(u, ms, type) {
    let host = "";
    try {
      host = new URL(u).hostname;
    } catch {}
    if (dead[host] > Date.now()) return Promise.reject(new Error("skipped"));
    const c = new AbortController();
    let timedOut = false;
    const t = setTimeout(() => {
      timedOut = true;
      c.abort();
    }, ms || 3000);
    return fetch(u, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return type === "json" ? r.json() : r.text();
      })
      .catch((e) => {
        if (!timedOut) dead[host] = Date.now() + 180000;
        throw e;
      })
      .finally(() => clearTimeout(t));
  }
  function parseXMLItems(xml) {
    if (!xml || typeof xml !== "string") throw new Error("no xml");
    const d = new DOMParser().parseFromString(xml, "text/xml");
    if (d.querySelector("parsererror")) throw new Error("xml");
    const out = [...d.querySelectorAll("item")].map((it) => {
      const g = (t) => {
        const e = it.getElementsByTagName(t)[0];
        return e ? e.textContent : "";
      };
      const s = it.getElementsByTagName("source")[0];
      const mc =
        it.getElementsByTagName("media:content")[0] ||
        it.getElementsByTagName("media:thumbnail")[0];
      const en = it.getElementsByTagName("enclosure")[0];
      return {
        title: g("title"),
        link: g("link"),
        pubDate: g("pubDate"),
        source: (s && s.textContent) || g("News:Source"),
        desc: g("description"),
        img:
          g("News:Image") ||
          (mc && mc.getAttribute("url")) ||
          (en &&
            /image/.test(en.getAttribute("type") || "") &&
            en.getAttribute("url")) ||
          "",
      };
    });
    if (!out.length) throw new Error("empty");
    return out;
  }
  // Google/Bing RSS through AllOrigins /get (JSON wrapper, always CORS-enabled).
  async function rss(rssUrl) {
    try {
      const j = await tfetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
        2800,
        "json",
      );
      return parseXMLItems(j && j.contents);
    } catch {
      return [];
    }
  }
  // Local dev server (scripts/dev-server.mjs) fetches the feeds server-side. Disabled automatically on static hosts.
  let localApi = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  async function localFetch(qs) {
    if (!localApi) return [];
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 2000);
      const r = await fetch("/api/rss?" + qs, { signal: c.signal }).finally(
        () => clearTimeout(t),
      );
      if (r.status === 404) {
        localApi = false;
        return [];
      }
      if (!r.ok) return [];
      return parseXMLItems(await r.text());
    } catch {
      return [];
    }
  }
  async function searchRss(q, bing) {
    if (localApi) {
      const l = await localFetch(
        `q=${encodeURIComponent(q)}${bing ? "&src=bing" : ""}`,
      );
      if (l.length) return l;
    }
    return rss(bing ? bingURL(q) : searchURL(q));
  }
  async function topicRss(c) {
    if (localApi) {
      const l = await localFetch("topic=" + (c.topic || "TOP"));
      if (l.length) return l;
    }
    return rss(topicURL(c.topic));
  }
  // Native-CORS JSON sources (no proxy).
  async function direct(urls, ms) {
    const rs = await Promise.allSettled(
      urls.map((u) => tfetch(u, ms || 6000, "json")),
    );
    const lists = rs
      .filter(
        (r) =>
          r.status === "fulfilled" &&
          r.value &&
          Array.isArray(r.value.articles),
      )
      .map((r) =>
        r.value.articles.map((a) => ({
          title: a.title,
          link: a.url,
          pubDate: a.publishedAt,
          source: (a.source && a.source.name) || "",
          desc: String(a.description || a.content || "").replace(
            /\s*\[\+\d+ chars\]\s*$/,
            "",
          ),
          img: a.urlToImage || "",
        })),
      );
    const out = [];
    const n = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < n; i++)
      lists.forEach((l) => {
        if (l[i]) out.push(l[i]);
      });
    return out;
  }
  const saurav = (c) =>
    direct(
      (c.sv || []).map(
        (p) =>
          `https://saurav.tech/NewsAPI/top-headlines/category/${p.split("/")[0]}/${p.split("/")[1]}.json`,
      ),
    );
  const indiaGeneral = () =>
    direct(
      ["https://saurav.tech/NewsAPI/top-headlines/category/general/in.json"],
      2500,
    ).catch(() => []);
  // Hacker News Algolia (native CORS), last 14 days only.
  async function hn(q) {
    try {
      const since = Math.floor((Date.now() - 14 * 86400000) / 1000);
      const j = await tfetch(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=${encodeURIComponent("created_at_i>" + since)}`,
        2800,
        "json",
      );
      return (j.hits || [])
        .filter((h) => h.title)
        .map((h) => {
          let dom = "";
          try {
            dom = h.url ? new URL(h.url).hostname.replace(/^www\./, "") : "";
          } catch {}
          return {
            title: h.title,
            link: h.url || "https://news.ycombinator.com/item?id=" + h.objectID,
            pubDate: h.created_at,
            source: dom || "Hacker News",
            desc: h.story_text || "",
            img: "",
          };
        });
    } catch {
      return [];
    }
  }
  const rel = (q) => {
    const k = q.toLowerCase().split(/\s+/)[0].replace(/"/g, "");
    return (s) =>
      (s.title + " " + s.summary + " " + s.bullets.join(" "))
        .toLowerCase()
        .includes(k);
  };
  const realLink = (l) => {
    l = String(l || "").trim();
    if (/bing\.com\/news\/apiclick/i.test(l)) {
      try {
        const u = new URL(l).searchParams.get("url");
        if (u) return u;
      } catch {}
    }
    return l;
  };

  // ---- freshness gate + summary sanitizer ----
  const TITLE_YEAR = /\b(19\d\d|20[01]\d|202[0-5])\b/;
  const fresh = (s) => {
    const n = Date.now();
    return (
      !!s.ts &&
      s.ts <= n + 300000 &&
      n - s.ts <= 14 * 864e5 &&
      !TITLE_YEAR.test(s.title)
    );
  };
  const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function goodSummary(sum, title, src) {
    const t = String(sum || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return "";
    const n = norm1(t);
    if (n === norm1(src || "") || n === norm1(title || "")) return "";
    let rest = t;
    if (title) rest = rest.split(title).join(" ");
    if (src) rest = rest.replace(new RegExp(escRe(src), "ig"), " ");
    rest = rest
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return rest.length < 35 ? "" : t;
  }
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
  const leadLine = (cat, src, loc) =>
    `Breaking ${CATW[cat] || cat} coverage reported by ${src}${loc ? " • " + loc : ""}. Tap Read for the full story.`;
  function norm(r, cl, cat, loc) {
    let title = txt(r.title),
      src = txt(r.source || "");
    const link = realLink(r.link);
    if (!title || !/^https?:\/\//.test(link) || BAD.test(link)) return null;
    const m = title.match(/^(.*\S)\s+-\s+([^-]{2,40})$/);
    if (m && (!src || /news\.google\./.test(link))) {
      title = m[1];
      if (!src) src = m[2];
    }
    if (src && title.endsWith(" - " + src))
      title = title.slice(0, -(src.length + 3));
    let summary = "",
      bullets = [];
    if (r.desc) {
      const doc = new DOMParser().parseFromString(String(r.desc), "text/html");
      const lis = [...doc.querySelectorAll("li")]
        .map((li) => li.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const key = title.toLowerCase().slice(0, 28);
      if (lis.length)
        bullets = lis
          .filter((t) => !t.toLowerCase().includes(key))
          .slice(0, 3)
          .map((t) => words(t, 26));
      else {
        const t = doc.body.textContent
          .replace(/\s+/g, " ")
          .trim()
          .replace(title, "")
          .trim();
        summary = words(t, 60);
      }
    }
    let ts = NaN;
    const p = String(r.pubDate || "");
    if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(p))
      ts = Date.parse(p.replace(" ", "T") + "Z");
    else if (p) ts = Date.parse(p);
    const nowT = Date.now();
    if (
      isNaN(ts) ||
      ts <= 0 ||
      ts > nowT + 300000 ||
      nowT - ts > 14 * 864e5 ||
      TITLE_YEAR.test(title)
    )
      return null;
    const srcName =
      src || (link.match(/\/\/(?:www\.)?([^/]+)/) || [, "Source"])[1];
    summary = goodSummary(summary, title, srcName);
    const gen = !summary;
    if (gen) summary = leadLine(cat, srcName, loc);
    const img =
      /^https?:\/\//.test(r.img || "") && !BAD.test(r.img) ? r.img : "";
    return {
      id: hash(link),
      title,
      url: link,
      src: src || (link.match(/\/\/(?:www\.)?([^/]+)/) || [, "Source"])[1],
      ts,
      gen,
      img: img || stock(cat, title),
      stock: !img,
      cat,
      cl,
      summary,
      bullets,
    };
  }
  function build(raws, cl, cat, loc) {
    const seen = new Set();
    const out = [];
    for (const r of raws) {
      const s = norm(r, cl, cat, loc);
      if (!s || seen.has(tkey(s))) continue;
      seen.add(tkey(s));
      out.push(s);
    }
    return dedupe(out).slice(0, 40);
  }
  function fallback(fb, cl, all) {
    const f = window.PULSE_FALLBACK;
    if (!f || !Array.isArray(f.stories)) return [];
    const seen = new Set();
    return f.stories
      .filter(
        (s) =>
          (all || s.cat === fb) &&
          !BAD.test(s.url || "") &&
          (s.isSeed || fresh({ ts: s.ts, title: s.title })) &&
          !seen.has(tkey(s)) &&
          seen.add(tkey(s)),
      )
      .map((s) => {
        const sum = s.isSeed
          ? s.summary || ""
          : goodSummary(s.summary, s.title, s.src);
        return {
          id: s.id,
          title: s.title,
          url: s.url,
          src: s.src,
          ts: s.ts || 0,
          img: s.img || stock(fb, s.title),
          stock: !s.img,
          cat: fb,
          cl,
          summary: sum || leadLine(fb, s.src, ""),
          gen: !sum,
          bullets: (s.bullets || []).slice(0, 3),
          seed: !!s.isSeed,
          tags: s.tags || [],
        };
      });
  }
  const cacheGet = (cat) =>
    (LS.get("pulse.cache." + cat, []) || []).filter(
      (s) => s && s.title && s.url && !BAD.test(s.url) && fresh(s),
    );
  const cacheSet = (cat, items) =>
    LS.set(
      "pulse.cache." + cat,
      items
        .slice(0, 30)
        .map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          src: s.src,
          ts: s.ts,
          img: s.img,
          stock: s.stock,
          cat: s.cat,
          cl: s.cl,
          summary: s.summary,
          gen: s.gen,
          bullets: s.bullets,
        })),
    );
  async function region(city) {
    try {
      const r = await tfetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=1`,
        2500,
        "json",
      );
      const a = (r[0] && r[0].address) || {};
      return {
        state: a.state || a.state_district || a.region || "",
        country: a.country || "",
      };
    } catch {
      return { state: "", country: "" };
    }
  }
  // Runs source jobs in parallel; calls onItems with each batch as soon as it arrives.
  function gather(jobs, my, cl, cat, onItems, loc) {
    return new Promise((res) => {
      let pending = jobs.length,
        total = [];
      jobs.forEach((j) =>
        j.p
          .then((raws) => {
            if (my !== state.req) return;
            let b = build(raws, cl, cat, loc);
            if (j.filter) b = b.filter(j.filter);
            b = dedupe(b, total);
            if (b.length) {
              total = total.concat(b);
              onItems(b, total);
            }
          })
          .catch(() => {})
          .then(() => {
            if (--pending === 0) res(total);
          }),
      );
    });
  }
  const STATE_OF = {
    jamshedpur: "Jharkhand",
    ranchi: "Jharkhand",
    dhanbad: "Jharkhand",
    bokaro: "Jharkhand",
    delhi: "Delhi",
    mumbai: "Maharashtra",
    pune: "Maharashtra",
    nagpur: "Maharashtra",
    bengaluru: "Karnataka",
    bangalore: "Karnataka",
    kolkata: "West Bengal",
    chennai: "Tamil Nadu",
    hyderabad: "Telangana",
    ahmedabad: "Gujarat",
    jaipur: "Rajasthan",
    lucknow: "Uttar Pradesh",
    patna: "Bihar",
  };
  function queryJobs(q) {
    const raw = q.replace(/"/g, ""),
      f = rel(raw);
    return [
      { p: searchRss(q, false) },
      { p: searchRss(q, true) },
      { p: hn(raw), filter: f },
    ];
  }

  /* ---------- loading ---------- */
  function cacheView() {
    const v = state.view;
    const key =
      v.type === "cat"
        ? v.cat
        : v.kind === "city"
          ? "local:" + v.q.toLowerCase()
          : "";
    if (key && !state.degraded)
      cacheSet(
        key,
        state.items.filter((s) => !s.seed),
      );
  }
  function onItems(my, b, total) {
    if (my !== state.req) return;
    if (state.degraded) {
      state.degraded = false;
      state.instant = false;
      state.shown = true;
      state.loading = false;
      setLive(true);
      render(total.slice());
      setPill(state.liveBadge);
      cacheView();
      return;
    }
    if (!state.shown || state.instant) {
      if (!state.shown || state.active < 2) {
        state.shown = true;
        state.instant = false;
        state.loading = false;
        setLive(true);
        render(total.slice());
        setPill(state.liveBadge);
        cacheView();
        return;
      }
      state.instant = false;
    }
    mergeNew(b);
    cacheView();
  }
  function mergeNew(b) {
    if (state.items.length >= 80) return;
    const real = b.filter((s) => !s.stock);
    state.items.forEach((s, i) => {
      if (!s.stock || s.seed) return;
      const m = real.find((r) => overlap(r.title, s.title));
      if (!m) return;
      const nb = [state.items[i - 1], state.items[i + 1]].filter(Boolean);
      if (nb.some((x) => x.img === m.img)) return;
      s.img = m.img;
      s.stock = false;
      const im = feed.querySelector(`[data-i="${i}"] .bg img`);
      if (im) {
        im.classList.remove("ok");
        im.src = m.img;
      }
    });
    const add = spread(dedupe(b, state.items), state.items.slice(-2));
    if (!add.length) return;
    const from = state.items.length;
    state.items = state.items.concat(add);
    uniq(state.items, from);
    addCards(from, state.items.length, false);
    setActive(state.active, true);
  }
  // Guaranteed result: live India feed (saurav.tech) or the bundled snapshot, clearly badged. Never a dead screen.
  async function degrade(my, v, indiaP) {
    if (state.degraded || state.shown || my !== state.req) return;
    const q = v.q,
      ql = q.toLowerCase(),
      st = (STATE_OF[ql] || "").toLowerCase();
    let items = build(await indiaP, "India", "india");
    let live = items.length > 0;
    if (!items.length) {
      const all = fallback("", "India & Regional", true);
      const sc = (s) => {
        const h = (s.title + " " + (s.tags || []).join(" ")).toLowerCase();
        return (h.includes(ql) ? 2 : 0) + (st && h.includes(st) ? 1 : 0);
      };
      items = all
        .map((s, i) => ({ s, i }))
        .sort((x, y) => sc(y.s) - sc(x.s) || x.i - y.i)
        .map((x) => x.s);
    }
    if (my !== state.req || state.shown) return;
    state.loading = false;
    if (!items.length) {
      state.items = [];
      setLive(false);
      showEmpty({
        h: `No live news for “${q}”`,
        p: "Couldn't reach any news source. Check your connection and retry.",
        city: false,
      });
      return;
    }
    state.degraded = true;
    state.shown = true;
    state.instant = false;
    setPill(`📍 ${q} (Showing India & Regional Feed)`);
    setLive(live);
    render(items);
    toast("Live local proxies busy — showing top India & regional stories");
  }
  async function load() {
    const my = ++state.req;
    const v = state.view,
      isCat = v.type === "cat",
      c = isCat ? catOf(v.cat) : null;
    state.loading = true;
    state.more = 0;
    state.moreQ = "";
    state.moreCity = false;
    state.shown = false;
    state.instant = false;
    state.degraded = false;
    const label = isCat ? c.label.replace(" 📍", "") : v.q;
    const city = !isCat && v.kind === "city";
    const badge = isCat ? "🌐 " + label : (city ? "📍 " : "🔍 ") + v.q;
    state.liveBadge = badge;
    setPill(badge);
    let pre = [];
    if (isCat) {
      pre = cacheGet(v.cat);
      if (!pre.length) pre = fallback(c.fb, label, c.id === "foryou");
    } else if (city) pre = cacheGet("local:" + v.q.toLowerCase());
    if (pre.length) {
      state.instant = true;
      state.shown = true;
      state.loading = false;
      render(pre);
      setLive(false);
    } else showSkeleton();
    const cb = (b, t) => onItems(my, b, t);
    let total = [];
    if (isCat) {
      state.moreQ = c.q;
      total = await gather(
        [{ p: saurav(c) }, { p: topicRss(c) }, { p: searchRss(c.q, true) }],
        my,
        label,
        c.fb,
        cb,
        "",
      );
      if (my !== state.req) return;
      state.loading = false;
      if (total.length) {
        setLive(true);
        cacheSet(v.cat, total);
        retries = 0;
        return;
      }
      if (state.shown) {
        setLive(false);
        if (retries < 3) {
          retries++;
          setTimeout(() => {
            if (state.view === v) load();
          }, 15000);
        }
        return;
      }
      state.items = [];
      setLive(false);
      showEmpty({
        h: "Can't reach live news",
        p: "Live sources didn't respond. Check your connection and retry.",
        city: false,
      });
      return;
    }
    const q = v.q,
      qq = city ? `"${q}"` : q;
    state.moreQ = qq;
    state.moreCity = city;
    const indiaP = indiaGeneral();
    const timer = setTimeout(() => {
      if (my === state.req && !state.shown) degrade(my, v, indiaP);
    }, 3000);
    total = await gather(queryJobs(qq), my, q, "local", cb, city ? q : "");
    if (total.length < 3 && city && my === state.req) {
      let place = STATE_OF[q.toLowerCase()] || "";
      if (!place) {
        const rg = await region(q);
        place = rg.state || rg.country;
      }
      if (place && my === state.req) {
        state.liveBadge = total.length
          ? `📍 ${q} (+ ${place} News)`
          : `📍 ${q} (Showing ${place} News)`;
        if (state.shown && !state.degraded && total.length)
          setPill(state.liveBadge);
        state.moreQ = `"${place}"`;
        state.moreCity = false;
        const more = await gather(
          queryJobs(`"${place}"`),
          my,
          place,
          "local",
          cb,
          place,
        );
        total = total.concat(more);
      }
    }
    clearTimeout(timer);
    if (my !== state.req) return;
    state.loading = false;
    if (total.length) {
      setLive(true);
      if (city) cacheSet("local:" + q.toLowerCase(), total);
      return;
    }
    await degrade(my, v, indiaP);
  }

  /* ---------- rendering ---------- */
  const skeleton = () =>
    '<article class="news-card sk"><div class="bar b0" style="opacity:.2"></div><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div></article>';
  function showSkeleton() {
    stopTTS();
    feed.innerHTML = skeleton();
    feed.scrollTop = 0;
    $("#prog").style.width = "0";
  }
  function showEmpty(e) {
    const q = state.view.q || "";
    feed.innerHTML = `<article class="news-card empty"><h2>${esc(e.h)}</h2><p>${esc(e.p)}</p><button data-action="retry">Retry</button>${e.city ? `<button data-action="as-city" data-q="${esc(q)}">Try “${esc(q)}” as a city</button>` : ""}<button data-action="open-loc">Choose another city</button></article>`;
    $("#prog").style.width = "0";
  }
  const ago = (ts) => {
    if (!ts) return "";
    const m = Math.max(0, Math.round((Date.now() - ts) / 6e4));
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  };
  function cardHTML(s, i) {
    const hue = parseInt(hash(s.title), 36) % 360;
    const body = s.summary
      ? `<p class="sum">${esc(s.summary)}</p>`
      : `<p class="sum">${s.bullets.length ? "Also reported:" : "Tap Read for the full report at " + esc(s.src) + "."}</p>`;
    const ul = s.bullets.length
      ? "<ul>" +
        s.bullets.map((b) => "<li>" + esc(b) + "</li>").join("") +
        "</ul>"
      : "";
    return (
      `<article class="news-card" data-i="${i}"><div class="bg" style="--g:radial-gradient(at 18% 12%,hsl(${hue} 62% 36%) 0,transparent 55%),radial-gradient(at 85% 30%,hsl(${(hue + 70) % 360} 58% 30%) 0,transparent 52%),radial-gradient(at 35% 92%,hsl(${(hue + 300) % 360} 52% 24%) 0,transparent 55%),#090a0f"><img src="${esc(s.img)}" alt="" loading="${i < 2 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer"></div><div class="shade"></div>` +
      `<div class="meta"><span class="cpill">${esc(s.cl)}</span>${s.ts ? `<span class="time">${ago(s.ts)}</span>` : ""}</div>` +
      `<div class="body"><span class="pub">✔ ${esc(s.src)}</span><h2>${esc(s.title)}</h2>${body}${ul}</div></article>`
    );
  }
  const endCard = () =>
    '<article class="news-card empty" data-end="1"><h2>You’re all caught up</h2><p>That’s every fresh story for now.</p><button data-action="refresh">Refresh feed</button></article>';
  let io = null;
  function observe(nodes) {
    if (!io) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting && e.intersectionRatio >= 0.65)
              setActive(+e.target.dataset.i);
          });
        },
        { root: feed, threshold: [0.65] },
      );
    }
    nodes.forEach((n) => io.observe(n));
  }
  function bindImgs(nodes) {
    nodes.forEach((c) => {
      const im = c.querySelector(".bg img");
      if (!im) return;
      const s = state.items[+c.dataset.i];
      let tries = 0;
      im.addEventListener("load", () => im.classList.add("ok"));
      im.addEventListener("error", () => {
        tries++;
        if (s && tries === 1) im.src = stock(s.cat, s.title + "x", 1);
        else if (s && tries === 2) im.src = stock(s.cat, s.title, 3);
        else im.remove();
      });
      if (im.complete && im.naturalWidth) im.classList.add("ok");
    });
  }
  function addCards(from, to, reset) {
    const tmp = document.createElement("div");
    let h = "";
    for (let i = from; i < to; i++) h += cardHTML(state.items[i], i);
    h += endCard();
    const end = feed.querySelector("[data-end]");
    if (end) end.remove();
    if (reset) {
      if (io) io.disconnect();
      feed.innerHTML = "";
    }
    tmp.innerHTML = h;
    const nodes = [...tmp.children];
    nodes.forEach((n) => {
      if (n.dataset.end) n.dataset.i = String(state.items.length);
      feed.appendChild(n);
    });
    bindImgs(nodes);
    observe(nodes);
  }
  function render(items) {
    state.items = spread(dedupe(items));
    state.active = 0;
    items = state.items;
    uniq(state.items, 0);
    addCards(0, items.length, true);
    feed.scrollTop = 0;
    setActive(0, true);
  }
  function setActive(i, force) {
    if (!force && i === state.active) return;
    let advancing = false;
    if (i !== state.active && state.commute) {
      if (state.autoAdv) advancing = true;
      else stopTTS();
    }
    state.active = i;
    feed
      .querySelectorAll(".news-card")
      .forEach((c) => c.classList.toggle("active", +c.dataset.i === i));
    const n = state.items.length;
    $("#prog").style.width = n ? Math.min(100, ((i + 1) / n) * 100) + "%" : "0";
    syncRail();
    markRead(i);
    if (advancing) {
      state.autoAdv = false;
      speakCurrent();
    }
    if (n && i >= n - 3) loadMore();
  }
  function syncRail() {
    const s = state.items[state.active],
      sv = !!s && isSaved(s.id);
    const b = document.querySelector('.rail [data-action="save"]');
    if (b) {
      b.classList.toggle("on", sv);
      b.querySelector("small").textContent = sv ? "Saved ✓" : "Save";
    }
    const l = document.querySelector('.rail [data-action="listen"]');
    if (l) {
      l.classList.toggle("on", state.commute);
      l.querySelector("small").textContent = state.commute
        ? "Playing"
        : "Listen";
      l.setAttribute("aria-label", state.commute ? "Stop listening" : "Listen");
    }
  }
  async function loadMore() {
    if (state.loading || state.more >= 1 || !state.moreQ) return;
    state.more = 1;
    const my = state.req,
      v = state.view;
    const raws = (
      await Promise.all([
        searchRss(state.moreQ, true),
        searchRss(state.moreQ, false),
      ])
    ).flat();
    if (my !== state.req) return;
    const first = state.items[0] || {};
    let more = build(
      raws,
      first.cl || "",
      first.cat || "top",
      state.moreCity ? v.q : "",
    );
    if (v.type === "query" && state.moreCity) more = more.filter(rel(v.q));
    mergeNew(more);
  }

  /* ---------- actions ---------- */
  const modals = () => document.querySelectorAll(".modal");
  const closeModals = () => modals().forEach((m) => m.classList.remove("open"));
  const open = (id) => {
    closeModals();
    $("#" + id).classList.add("open");
  };
  let tt;
  function toast(m, act, fn) {
    const t = $("#toast");
    t.textContent = "";
    const sp = document.createElement("span");
    sp.textContent = m;
    t.appendChild(sp);
    t.classList.toggle("act", !!act);
    if (act) {
      const b = document.createElement("button");
      b.textContent = act;
      b.addEventListener("click", () => {
        t.classList.remove("show");
        if (fn) fn();
      });
      t.appendChild(b);
    }
    t.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove("show"), act ? 4500 : 1800);
  }
  const CTX = {
    foryou: "For You • Top Stories",
    india: "India • Top Stories",
    world: "World • Live Briefing",
    tech: "Tech • Live Briefing",
    business: "Business • Live Briefing",
    sports: "Sports • Live Briefing",
    science: "Science • Live Briefing",
  };
  function setPill(t) {
    const v = state.view,
      onLocal = v.type === "query" && v.kind === "city";
    let ctx;
    if (t && t.startsWith("📍")) ctx = t;
    else if (v.type === "query")
      ctx = onLocal ? "📍 " + v.q : "Search • " + v.q;
    else ctx = CTX[v.cat] || "Top Stories";
    $("#ctx").textContent = ctx;
    const b = $("#location-badge");
    b.hidden = !onLocal;
    b.textContent = "📍 " + (onLocal ? v.q : state.city || "Set City") + " ✏️";
    b.title = "Change city";
  }
  function renderCityChips() {
    $("#loc-cur").textContent = state.city || "not set";
    $("#loc-grid").innerHTML = QUICK.map(
      (c) =>
        `<button data-city="${esc(c)}"${c.toLowerCase() === (state.city || "").toLowerCase() ? ' class="on"' : ""}>${esc(c)}</button>`,
    ).join("");
  }
  function setLive(on) {
    const l = $("#live");
    l.classList.toggle("on", !!on);
    l.textContent = on ? "• LIVE" : "• UPDATED";
  }
  const cur = () => state.items[state.active];
  const isSaved = (id) => state.savedList.some((x) => x.id === id);
  function persistSaved() {
    LS.set("pulse_saved_v2", state.savedList);
    updateSavedUI();
  }
  function updateSavedUI() {
    const n = state.savedList.length;
    const chip = document.querySelector('#chips button[data-id="saved"]');
    if (chip) chip.textContent = `Saved (${n})`;
    const c = $("#saved-count");
    if (c) {
      c.textContent = n;
      c.hidden = !n;
    }
    syncRail();
  }
  function save() {
    const s = cur();
    if (!s) return;
    if (isSaved(s.id)) {
      state.savedList = state.savedList.filter((x) => x.id !== s.id);
      persistSaved();
      toast("Removed from bookmarks");
      return;
    }
    state.savedList.unshift({
      id: s.id,
      title: s.title,
      url: s.url,
      src: s.src,
      ts: s.ts,
      img: s.img,
      cat: s.cat,
      cl: s.cl,
      summary: s.summary,
      gen: s.gen,
      bullets: s.bullets,
      savedAt: Date.now(),
    });
    state.savedList = state.savedList.slice(0, 100);
    persistSaved();
    toast("Saved to bookmarks • ", "View →", openSaved);
  }
  function renderSaved() {
    const l = state.savedList,
      box = $("#saved-list");
    $("#saved-clear").hidden = !l.length;
    if (!l.length) {
      box.innerHTML =
        '<div class="empty-saved"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1z"/></svg><p><b>No saved stories yet</b></p><p>Tap <b>Save</b> on any story and it will appear here.</p></div>';
      return;
    }
    box.innerHTML = l
      .map(
        (s) =>
          `<div class="srow"><button class="stitle" data-action="saved-go" data-id="${esc(s.id)}"><b>${esc(s.title)}</b><small>${esc(s.src)}${s.ts ? " · " + ago(s.ts) : ""}</small></button><button class="strash" data-action="saved-del" data-id="${esc(s.id)}" aria-label="Remove from saved"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button></div>`,
      )
      .join("");
  }
  function openSaved() {
    renderSaved();
    open("savedmodal");
  }
  function savedGo(id) {
    const i = state.items.findIndex((x) => x.id === id);
    if (i >= 0) {
      closeModals();
      const c = feed.querySelector(`[data-i="${i}"]`);
      if (c) {
        if (feed.scrollTo)
          feed.scrollTo({ top: c.offsetTop, behavior: "smooth" });
        else feed.scrollTop = c.offsetTop;
      }
      return;
    }
    const s = state.savedList.find((x) => x.id === id);
    if (s) window.open(s.url, "_blank", "noopener");
  }
  /* ---- Commute mode: Listen reads the card, then auto-advances ---- */
  function stopTTS() {
    state.commute = false;
    state.autoAdv = false;
    state.ttsTok++;
    try {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    } catch {}
    syncRail();
  }
  function speakCurrent() {
    const s = cur();
    if (!s || !("speechSynthesis" in window)) return stopTTS();
    const tok = ++state.ttsTok;
    try {
      speechSynthesis.cancel();
    } catch {}
    const u = new SpeechSynthesisUtterance(
      s.title + ". " + (s.gen || s.seed ? "" : s.summary || ""),
    );
    u.lang = "en-IN";
    u.onend = () => {
      if (tok === state.ttsTok && state.commute) advance();
    };
    u.onerror = () => {
      if (tok === state.ttsTok) stopTTS();
    };
    speechSynthesis.speak(u);
  }
  function advance() {
    if (state.active >= state.items.length - 1) {
      stopTTS();
      toast("You’re all caught up");
      return;
    }
    const from = state.active;
    state.autoAdv = true;
    go(1);
    setTimeout(() => {
      if (state.commute && state.active === from) stopTTS();
    }, 2500);
  }
  function listen() {
    if (!("speechSynthesis" in window))
      return toast("Voice not supported on this device");
    if (state.commute) {
      stopTTS();
      toast("Commute mode off");
      return;
    }
    if (!cur()) return;
    state.commute = true;
    syncRail();
    toast("Commute mode on • tap again to stop");
    speakCurrent();
  }
  async function share() {
    const s = cur();
    if (!s) return;
    const sum =
      s.gen || s.seed ? (s.bullets && s.bullets[0]) || "" : s.summary || "";
    const url = location.origin + location.pathname;
    const text = ["📰 " + s.title, sum, "Via PULSE Live News: " + url]
      .filter(Boolean)
      .join("\n\n");
    try {
      if (navigator.share) await navigator.share({ title: s.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Digest copied — paste it anywhere");
      }
    } catch {}
  }
  /* ---- Daily briefing progress + streak ---- */
  const dayStr = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  const yesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return dayStr(y);
  };
  function daily() {
    const t = dayStr(new Date());
    const d = LS.get("pulse_daily", null);
    return !d || d.date !== t
      ? {
          date: t,
          read: [],
          streak: d ? d.streak || 0 : 0,
          last: d ? d.last || "" : "",
        }
      : d;
  }
  function renderDaily() {
    const d = daily();
    $("#daily").textContent = `⚡ ${Math.min(d.read.length, 10)}/10 Read`;
    const alive = d.last === d.date || d.last === yesterday();
    const st = alive ? d.streak : 0;
    $("#streak").textContent = `🔥 ${st}-day streak`;
    $("#streak").hidden = !st;
  }
  let readTimer = 0;
  function markRead(i) {
    clearTimeout(readTimer);
    const s = state.items[i];
    if (!s || s.seed) return;
    readTimer = setTimeout(() => {
      if (state.active !== i || state.items[i] !== s) return;
      const d = daily();
      if (d.read.includes(s.id)) return;
      d.read.push(s.id);
      d.read = d.read.slice(-200);
      if (d.last !== d.date) {
        d.streak = d.last === yesterday() ? (d.streak || 0) + 1 : 1;
        d.last = d.date;
      }
      LS.set("pulse_daily", d);
      renderDaily();
    }, 1200);
  }
  function readFull() {
    const s = cur();
    if (!s) return;
    $("#rd-title").textContent = s.title;
    $("#rd-meta").textContent = [s.src, ago(s.ts)].filter(Boolean).join(" · ");
    $("#rd-body").innerHTML =
      (s.summary ? `<p>${esc(s.summary)}</p>` : "") +
        (s.bullets.length
          ? "<p><b>Also reported</b></p>" +
            s.bullets.map((b) => `<p>• ${esc(b)}</p>`).join("")
          : "") || "<p>Open the source for the full report.</p>";
    $("#rd-ext").href = s.url;
    open("reader");
  }
  const go = (d) =>
    feed.scrollBy({ top: d * feed.clientHeight, behavior: "smooth" });
  function setCat(id) {
    if (id === "saved") {
      openSaved();
      return;
    }
    const c = catOf(id);
    navTouched = true;
    if (c.local) {
      if (!state.city) {
        renderCityChips();
        open("locmodal");
        toast("Choose your city for local news");
        return;
      }
      return setCity(state.city);
    }
    retries = 0;
    state.view = { type: "cat", cat: id };
    markChip(id);
    load();
  }
  function setCity(name) {
    name = String(name || "")
      .trim()
      .slice(0, 60);
    if (!name) return;
    navTouched = true;
    retries = 0;
    state.city = name;
    citySet(name);
    state.view = { type: "query", q: name, kind: "city" };
    markChip("local");
    closeModals();
    load();
  }
  function setQuery(q, kind) {
    q = String(q || "").trim();
    if (!q) return;
    navTouched = true;
    retries = 0;
    state.view = { type: "query", q, kind: kind || "topic" };
    markChip(kind === "city" ? "local" : "");
    closeModals();
    load();
  }
  function markChip(id) {
    document
      .querySelectorAll("#chips button")
      .forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  }
  async function detect() {
    if (!navigator.geolocation) return toast("Location not available");
    toast("Detecting location…");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const j = await tfetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${p.coords.latitude}&lon=${p.coords.longitude}&format=json&zoom=10&addressdetails=1`,
            9000,
            "json",
          );
          const a = j.address || {};
          const c =
            a.city ||
            a.town ||
            a.village ||
            a.county ||
            a.state_district ||
            a.state;
          if (c) setCity(c);
          else toast("Couldn't resolve your city");
        } catch {
          toast("Couldn't resolve your city");
        }
      },
      () => toast("Location permission denied"),
      { timeout: 7000, maximumAge: 600000 },
    );
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    if (a.classList.contains("modal") && e.target !== a) return;
    switch (a.dataset.action) {
      case "open-saved":
        return openSaved();
      case "saved-go":
        return savedGo(a.dataset.id);
      case "saved-del":
        state.savedList = state.savedList.filter((x) => x.id !== a.dataset.id);
        persistSaved();
        return renderSaved();
      case "saved-clear":
        state.savedList = [];
        persistSaved();
        return renderSaved();
      case "save":
        return save();
      case "listen":
        return listen();
      case "share":
        return share();
      case "read":
        return readFull();
      case "prev":
        return go(-1);
      case "next":
        return go(1);
      case "refresh":
      case "retry":
        return load();
      case "close":
        return closeModals();
      case "open-loc":
        renderCityChips();
        open("locmodal");
        return setTimeout(() => $("#loc-q").focus(), 50);
      case "open-search":
        open("searchmodal");
        return setTimeout(() => $("#search-q").focus(), 50);
      case "run-search":
        return setQuery(a.dataset.q || $("#search-q").value, a.dataset.kind);
      case "set-city":
        return setCity($("#loc-q").value);
      case "as-city":
        return setCity(a.dataset.q);
      case "detect-gps":
        return detect();
      case "geo-yes":
        return geoAnswer(true);
      case "geo-no":
        return geoAnswer(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.target.id === "location-badge" &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      renderCityChips();
      open("locmodal");
      return;
    }
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) {
      if (e.key === "Enter") {
        const m = e.target.id;
        if (m === "search-q") setQuery(e.target.value);
        if (m === "loc-q") setCity(e.target.value);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "s") save();
    else if (e.key === "/") {
      e.preventDefault();
      open("searchmodal");
      setTimeout(() => $("#search-q").focus(), 50);
    } else if (e.key === "Escape") closeModals();
  });

  /* ---------- init ---------- */
  $("#chips").innerHTML =
    CATS.map((c) => `<button data-id="${c.id}">${esc(c.label)}</button>`).join(
      "",
    ) + '<button data-id="saved">Saved (0)</button>';
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setCat(b.dataset.id);
  });
  renderCityChips();
  setPill("");
  updateSavedUI();
  renderDaily();
  $("#loc-grid").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) {
      e.stopPropagation();
      setCity(b.dataset.city);
    }
  });
  ["touchstart", "touchmove"].forEach((t) =>
    $("#chips").addEventListener(t, (e) => e.stopPropagation(), {
      passive: true,
    }),
  );
  window.addEventListener("pagehide", stopTTS);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  // First visit: detect the city from the IP (2 s budget). On failure fall back to For You.
  async function detectCity() {
    const t0 = Date.now();
    try {
      const j = await tfetch("https://ipwho.is/", 2000, "json");
      if (j && j.success !== false && j.city)
        return { city: String(j.city), country: String(j.country || "") };
    } catch {}
    return null;
  }
  let geoT;
  function showGeoPrompt(city) {
    const g = $("#geo");
    if (!g) return;
    $("#geo-txt").textContent =
      `Detected location: ${city}. Switch local feed?`;
    g.dataset.city = city;
    g.hidden = false;
    clearTimeout(geoT);
    geoT = setTimeout(() => {
      g.hidden = true;
    }, 15000);
  }
  function geoAnswer(yes) {
    const g = $("#geo"),
      c = g.dataset.city || "";
    g.hidden = true;
    clearTimeout(geoT);
    if (yes) setCity(c);
    else {
      try {
        localStorage.setItem("pulse_geo_dismissed", c);
      } catch {}
    }
  }
  // First visit: show For You immediately, look up the IP location in the background, and only ASK before switching.
  markChip("foryou");
  load();
  if (!state.city) {
    detectCity().then((g) => {
      if (!g || state.city) return;
      const c = g.city.trim().slice(0, 60);
      let dis = "";
      try {
        dis = localStorage.getItem("pulse_geo_dismissed") || "";
      } catch {}
      if (c && dis !== c) showGeoPrompt(c);
    });
  }
  window.PulseApp = {
    setCity,
    setQuery,
    state,
    _setActive: (i) => setActive(i),
  };
})();

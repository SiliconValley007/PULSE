(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s),
    $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const enc = encodeURIComponent,
    LS = "pulse_state_v1";
  const CC = [
    ["US", "United States"],
    ["GB", "United Kingdom"],
    ["IN", "India"],
    ["CA", "Canada"],
    ["AU", "Australia"],
    ["IE", "Ireland"],
    ["NZ", "New Zealand"],
    ["SG", "Singapore"],
    ["ZA", "South Africa"],
    ["NG", "Nigeria"],
    ["KE", "Kenya"],
    ["PH", "Philippines"],
    ["PK", "Pakistan"],
    ["BD", "Bangladesh"],
    ["MY", "Malaysia"],
    ["ID", "Indonesia"],
    ["JP", "Japan"],
    ["KR", "South Korea"],
    ["DE", "Germany"],
    ["FR", "France"],
    ["ES", "Spain"],
    ["IT", "Italy"],
    ["PT", "Portugal"],
    ["BR", "Brazil"],
    ["MX", "Mexico"],
    ["AR", "Argentina"],
    ["CO", "Colombia"],
    ["CL", "Chile"],
    ["NL", "Netherlands"],
    ["BE", "Belgium"],
    ["CH", "Switzerland"],
    ["AT", "Austria"],
    ["SE", "Sweden"],
    ["NO", "Norway"],
    ["DK", "Denmark"],
    ["PL", "Poland"],
    ["TR", "Turkey"],
    ["IL", "Israel"],
    ["AE", "UAE"],
    ["SA", "Saudi Arabia"],
    ["EG", "Egypt"],
    ["UA", "Ukraine"],
    ["GR", "Greece"],
    ["TH", "Thailand"],
    ["VN", "Vietnam"],
    ["HK", "Hong Kong"],
    ["TW", "Taiwan"],
    ["RU", "Russia"],
    ["EU", "Europe"],
  ];
  const SAURAV = ["in", "us", "gb", "au", "ca", "fr", "ru"];
  const SCAT = {
    general: "world",
    technology: "tech",
    business: "business",
    science: "science",
    entertainment: "culture",
    sports: "sports",
  };
  const CHIPS = [
    ["foryou", "🔥 For You"],
    ["near", "📍 Near Me"],
    ["breaking", "⚡ Breaking"],
    ["tech", "💻 Tech"],
    ["world", "🌍 World"],
    ["science", "🧬 Science"],
    ["business", "💼 Business"],
    ["culture", "🎬 Culture"],
    ["sports", "🏅 Sports"],
    ["saved", "🔖 Saved"],
  ];
  const PH = {
    world: [
      "1451187580459-43490279c0fa",
      "1446776811953-b23d57bd21aa",
      "1477959858617-67f85cf4f1df",
      "1480714378408-67cf0d13bc1b",
      "1519501025264-65ba15a82390",
      "1504711434969-e33886168f5c",
      "1495020689067-958852a7765e",
      "1502602898657-3e91760cbb34",
      "1526778548025-fa2f459cd5c1",
    ],
    tech: [
      "1518770660439-4636190af475",
      "1526628953301-3e589a6a8b74",
      "1461749280684-dccba630e2f6",
      "1485827404703-89b55fcc595e",
      "1550751827-4bd374c3f58b",
      "1488590528505-98d2b5aba04b",
      "1531297484001-80022131f5a1",
      "1517694712202-14dd9538aa97",
      "1555949963-ff9fe0c870eb",
    ],
    science: [
      "1532094349884-543bc11b234d",
      "1507413245164-6160d8298b31",
      "1446776877081-d282a0f896e2",
      "1462331940025-496dfbfc7564",
      "1614730321146-b6fa6a46bcb4",
      "1576086213369-97a306d36557",
      "1530026405186-ed1f139313f8",
      "1581093458791-9f3c3900df4b",
      "1636466497217-26a8cbeaf0aa",
    ],
    business: [
      "1554224155-6726b3ff858f",
      "1486406146926-c627a92ad1ab",
      "1460925895917-afdab827c52f",
      "1507679799987-c73779587ccf",
      "1590283603385-17ffb3a7f29f",
      "1611974789855-9c2a0a7236a3",
      "1444653614773-995cb1ef9efa",
      "1521737604893-d14cc237f11d",
      "1556761175-5973dc0f32e7",
    ],
    culture: [
      "1470229722913-7c0e2dbbafd3",
      "1489599849927-2ee91cede3ba",
      "1514525253161-7a46d19cd819",
      "1503095396549-807759245b35",
      "1499364615650-ec38552f4f34",
      "1460723237483-7a6dc9d0b212",
      "1507676184212-d03ab07a01bf",
      "1493225457124-a3eb161ffa5f",
      "1516450360452-9312f5e86fc7",
    ],
    sports: [
      "1461896836934-ffe607ba8211",
      "1517649763962-0c623066013b",
      "1540747913346-19e32dc3e97e",
      "1530549387789-4c1017266635",
      "1546519638-68e109498ffc",
      "1574629810360-7efbbe195018",
      "1517836357463-d25dfeac3438",
      "1471295253337-3ceaaedca402",
      "1552674605-db6ffd4facb5",
    ],
  };
  const DEF = () => ({
    onboarded: false,
    mode: "global",
    cc: "US",
    city: "",
    region: "",
    country: "",
    q: "",
    likedIds: [],
    savedIds: [],
    vault: {},
    seen: [],
    tts: false,
    w: { world: 1, tech: 1, science: 1, business: 1, culture: 1, sports: 1 },
  });
  const S = (() => {
    try {
      const j = JSON.parse(localStorage.getItem(LS));
      if (j && typeof j === "object") {
        const d = Object.assign(DEF(), j);
        d.w = Object.assign(DEF().w, j.w || {});
        ["likedIds", "savedIds", "seen"].forEach((k) => {
          if (!Array.isArray(d[k])) d[k] = [];
        });
        if (!d.vault || typeof d.vault !== "object") d.vault = {};
        return d;
      }
    } catch (e) {}
    return DEF();
  })();
  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(S));
    } catch (e) {}
  };
  const state = {
    stories: [],
    filteredStories: [],
    activeIndex: 0,
    category: "foryou",
    savedIds: S.savedIds,
    lock: 0,
    auto: false,
    searchQuery: "",
    searchResults: [],
  };
  const feed = $("#feed");
  const DL = new URLSearchParams(location.search);
  let deferUrl = false;
  const flag = (c) =>
    c === "EU"
      ? "🇪🇺"
      : String.fromCodePoint(
          ...c.split("").map((x) => 127397 + x.charCodeAt(0)),
        );
  const nameOf = (c) => {
    const r = CC.find((x) => x[0] === c);
    return r ? r[1] : c;
  };
  const esc = (s) =>
    String(s).replace(
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
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };
  const hnum = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  const strip = (h) => {
    try {
      return (
        new DOMParser().parseFromString(String(h || ""), "text/html").body
          .textContent || ""
      )
        .replace(/\s+/g, " ")
        .trim();
    } catch (e) {
      return "";
    }
  };
  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  };
  const rel = (t) => {
    const m = Math.max(1, Math.round((Date.now() - t) / 6e4));
    return m < 60
      ? m + "m ago"
      : m < 1440
        ? Math.round(m / 60) + "h ago"
        : Math.round(m / 1440) + "d ago";
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
  const ph = (cat, key) => {
    const a = PH[cat] || PH.world;
    return (
      "https://images.unsplash.com/photo-" +
      a[hnum(key) % a.length] +
      "?auto=format&fit=crop&w=720&h=1280&q=70"
    );
  };
  let toastT;
  function toast(m) {
    const e = $("#toast");
    e.textContent = m;
    e.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => e.classList.remove("show"), 2300);
  }
  if (location.protocol.indexOf("http") === 0) {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "manifest.json";
    document.head.appendChild(l);
  }

  /* ---------- live sources (CORS-open only) ---------- */
  function jget(u, ms) {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), ms || 10000);
    return fetch(u, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .finally(() => clearTimeout(t));
  }
  const AO = (u) => "https://api.allorigins.win/get?url=" + enc(u);
  function build(r, cat, bucket, x) {
    x = x || {};
    let title = strip(r.title),
      src = strip(r.source || "");
    if (!src) {
      const m = title.match(/^(.*) - ([^-]{2,40})$/);
      if (m) {
        title = m[1];
        src = m[2];
      }
    } else if (title.slice(-(src.length + 3)) === " - " + src)
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
    const seen = {};
    b = b
      .filter((s) => s.length > 25 && !seen[norm(s)] && (seen[norm(s)] = 1))
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
    let img = r.img || "";
    if (img.indexOf("//") === 0) img = "https:" + img;
    img = img.replace(/^http:/, "https:");
    const ts = Date.parse(r.pubDate) || x.ts || Date.now();
    return {
      id: hash(norm(title)),
      title,
      url: r.link,
      src: src || host(r.link),
      dom: host(r.link),
      ts,
      img,
      cat: cat,
      bucket,
      local: bucket === "local",
      viral: !!x.viral,
      bullets: b,
      fullText,
      read: Math.max(1, Math.round(fullText.split(" ").length / 180)),
    };
  }
  function parseRSS(xml) {
    const d = new DOMParser().parseFromString(xml, "text/xml");
    const out = $$("item", d)
      .map((it) => {
        const g = (t) => {
          const e = it.querySelector(t);
          return e ? e.textContent.trim() : "";
        };
        const raw = g("description");
        let related = [];
        try {
          const doc = new DOMParser().parseFromString(raw, "text/html");
          related = $$("li", doc).map((li) => ({
            t: ((li.querySelector("a") || li).textContent || "").trim(),
            s: ((li.querySelector("font") || {}).textContent || "").trim(),
          }));
        } catch (e) {}
        const mc = it.getElementsByTagNameNS("*", "content")[0];
        return {
          title: g("title"),
          link: g("link"),
          pubDate: g("pubDate"),
          desc: related.length ? "" : raw,
          related,
          source: g("source"),
          img: mc ? mc.getAttribute("url") || "" : "",
        };
      })
      .filter((x) => x.title && x.link);
    if (!out.length) throw new Error("empty");
    return out;
  }
  const rss = (url, cat, bucket) =>
    jget(AO(url), 12000)
      .then((j) => parseRSS(j.contents))
      .then((a) =>
        a.slice(0, 15).map((r, i) => build(r, cat, bucket, { viral: i < 2 })),
      )
      .catch(() => []);
  const sauravRaw = (cat, cc, bucket) =>
    jget(
      "https://saurav.tech/NewsAPI/top-headlines/category/" +
        cat +
        "/" +
        cc +
        ".json",
      12000,
    )
      .then((j) =>
        (j.articles || [])
          .slice(0, 12)
          .map((a, i) =>
            build(
              {
                title: a.title,
                link: a.url,
                pubDate: a.publishedAt,
                desc: a.description || "",
                content: a.content || "",
                source: a.source && a.source.name,
                img: a.urlToImage || "",
              },
              SCAT[cat],
              bucket,
              { viral: i < 1 },
            ),
          ),
      )
      .catch(() => []);
  const devto = () =>
    jget("https://dev.to/api/articles?top=1&per_page=15")
      .then((a) =>
        a.map((i) =>
          build(
            {
              title: i.title,
              link: i.url,
              pubDate: i.published_at,
              desc: i.description || "",
              source: "DEV Community",
              img: i.cover_image || i.social_image || "",
              facts: [
                i.tag_list && i.tag_list.length
                  ? "Tagged " +
                    (Array.isArray(i.tag_list)
                      ? i.tag_list.join(", ")
                      : i.tag_list) +
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
            "global",
          ),
        ),
      )
      .catch(() => []);
  const space = () =>
    jget("https://api.spaceflightnewsapi.net/v4/articles/?limit=15")
      .then((j) =>
        j.results.map((a) =>
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
            "global",
          ),
        ),
      )
      .catch(() => []);
  const wiki = () => {
    const d = new Date(Date.now() - 864e5),
      p = (n) => String(n).padStart(2, "0");
    return jget(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/" +
        d.getUTCFullYear() +
        "/" +
        p(d.getUTCMonth() + 1) +
        "/" +
        p(d.getUTCDate()),
    )
      .then((j) => {
        const o = [];
        (j.news || []).forEach((n) => {
          const t = strip(n.story),
            ls = n.links || [],
            l = ls.filter((x) => x.thumbnail)[0] || ls[0];
          if (!t || !l) return;
          const ex = ls
            .slice(0, 3)
            .map((x) => x.extract || "")
            .filter(Boolean)
            .join(" ");
          o.push(
            build(
              {
                title:
                  t.length > 110
                    ? t.slice(0, t.lastIndexOf(" ", 108)) + "…"
                    : t,
                link: l.content_urls
                  ? l.content_urls.desktop.page
                  : "https://en.wikipedia.org",
                pubDate: new Date().toISOString(),
                desc: t + " " + ex,
                source: "Wikipedia",
                img: l.thumbnail ? l.thumbnail.source : "",
              },
              "world",
              "global",
            ),
          );
        });
        if (j.tfa)
          o.push(
            build(
              {
                title: "Featured: " + j.tfa.normalizedtitle,
                link: j.tfa.content_urls.desktop.page,
                pubDate: new Date().toISOString(),
                desc: j.tfa.extract || "",
                source: "Wikipedia",
                img:
                  (j.tfa.originalimage || j.tfa.thumbnail || {}).source || "",
              },
              "science",
              "global",
            ),
          );
        return o;
      })
      .catch(() => []);
  };
  const saurav = (c, cc, b) =>
    sauravRaw(c, cc, b).then((x) =>
      x.map((s) => {
        if (s) s.enrich = true;
        return s;
      }),
    );
  const gdelt = (q, cat, bucket) =>
    jget(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
        enc(q + " sourcelang:eng") +
        "&mode=ArtList&maxrecords=25&format=json&sort=DateDesc",
      12000,
    )
      .then((j) =>
        (j.articles || []).map((x, i) => {
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
          return build(
            {
              title: x.title,
              link: x.url,
              pubDate: new Date(ts).toISOString(),
              desc: "",
              source: x.domain,
              img: x.socialimage || "",
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
            cat,
            bucket,
            { viral: i < 1, ts },
          );
        }),
      )
      .catch(() => []);
  const hnews = () =>
    jget(
      "https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>25&hitsPerPage=15",
      10000,
    )
      .then((j) =>
        (j.hits || [])
          .filter((h) => h.title)
          .map((h) =>
            build(
              {
                title: h.title,
                link:
                  h.url || "https://news.ycombinator.com/item?id=" + h.objectID,
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
              "global",
              { viral: (h.points || 0) > 200 },
            ),
          ),
      )
      .catch(() => []);
  function plan() {
    const T = [],
      fcc = S.cc === "EU" ? "GB" : S.cc,
      lc = fcc.toLowerCase(),
      place = S.mode === "custom" ? S.q : S.city || S.region;
    const geo = (p, c) =>
      rss(
        "https://news.google.com/rss/headlines/section/geo/" +
          enc(p) +
          "?hl=en-" +
          c +
          "&gl=" +
          c +
          "&ceid=" +
          c +
          ":en",
        "world",
        "local",
      );
    if (S.mode === "near" && place) {
      T.push(geo(place, fcc));
      if (S.region && S.region !== place) T.push(geo(S.region, fcc));
    }
    if ((S.mode === "near" || S.mode === "custom") && place)
      T.push(gdelt(place, "world", "local"));
    if (S.mode === "custom" && place) {
      T.push(
        geo(place, "US"),
        rss(
          "https://news.google.com/rss/search?q=" +
            enc(place) +
            "+when:1d&hl=en-US&gl=US&ceid=US:en",
          "world",
          "local",
        ),
      );
    }
    if (S.mode === "near" || S.mode === "country") {
      T.push(
        rss(
          "https://news.google.com/rss?hl=en-" +
            fcc +
            "&gl=" +
            fcc +
            "&ceid=" +
            fcc +
            ":en",
          "world",
          "national",
        ),
      );
      if (SAURAV.indexOf(lc) >= 0)
        Object.keys(SCAT).forEach((k) => T.push(saurav(k, lc, "national")));
    }
    Object.keys(SCAT).forEach((k) => T.push(saurav(k, "us", "global")));
    T.push(saurav("general", "gb", "global"));
    T.push(
      gdelt(
        S.mode === "near" || S.mode === "country"
          ? nameOf(fcc)
          : "breaking news",
        "world",
        S.mode === "near" || S.mode === "country" ? "national" : "global",
      ),
      hnews(),
      devto(),
      space(),
      wiki(),
    );
    return T;
  }

  /* ---------- pool ---------- */
  let live = [],
    fallback = [],
    busy = false,
    lastRefresh = 0,
    gotLive = false,
    dwellT,
    shown = 0,
    io = null;
  function fbMap(s) {
    let b = "global";
    if (S.mode !== "global" && s.cc && s.cc === S.cc) {
      b = "national";
      const c = (s.city || "").toLowerCase();
      if (
        c &&
        ((S.mode === "near" &&
          [S.city, S.region].some((x) => x && x.toLowerCase() === c)) ||
          (S.mode === "custom" && S.q.toLowerCase() === c))
      )
        b = "local";
    }
    return Object.assign({}, s, { bucket: b, local: b === "local" });
  }
  function dedupe(a) {
    const m = {},
      o = [];
    a.forEach((s) => {
      if (!s) return;
      const k = norm(s.title).slice(0, 48);
      if (!Object.prototype.hasOwnProperty.call(m, k)) {
        m[k] = o.length;
        o.push(s);
      } else if (!o[m[k]].img && s.img) o[m[k]] = s;
    });
    return o;
  }
  function compose() {
    const all = dedupe(live.concat(fallback.map(fbMap))),
      now = Date.now(),
      seen = {};
    S.seen.forEach((i) => {
      seen[i] = 1;
    });
    const sc = (s) =>
      (Math.exp(-(now - s.ts) / 432e5) * 0.6 + Math.random() * 0.4) *
      (S.w[s.cat] || 1) *
      (seen[s.id] ? 0.3 : 1) *
      (s.viral ? 1.25 : 1) *
      (s.enrich ? 0.55 : 1) *
      (s.bucket === "local" ? 1.6 : s.bucket === "national" ? 1.2 : 1);
    const sorted = all
      .map((s) => [sc(s), s])
      .sort((a, b) => b[0] - a[0])
      .map((x) => x[1]);
    if (S.mode === "global") return sorted;
    const q = { local: [], national: [], global: [] };
    sorted.forEach((s) => q[s.bucket || "global"].push(s));
    const pat =
        S.mode === "custom"
          ? ["local", "local", "global", "local", "local", "global"]
          : [
              "local",
              "national",
              "local",
              "global",
              "local",
              "national",
              "local",
              "global",
              "local",
              "national",
            ],
      out = [];
    let left = sorted.length;
    while (left > 0) {
      let moved = false;
      for (const k of pat) {
        const n =
          q[k].shift() ||
          q.local.shift() ||
          q.national.shift() ||
          q.global.shift();
        if (n) {
          out.push(n);
          left--;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return out;
  }
  function applyFilter() {
    const now = Date.now(),
      c = state.category,
      p = state.stories;
    switch (c) {
      case "near":
        return p.filter((s) => s.local);
      case "breaking":
        return p
          .filter((s) => s.viral || now - s.ts < 36e5 * 3)
          .sort((a, b) => b.ts - a.ts);
      case "search":
        return state.searchResults || [];
      case "saved":
        return S.savedIds
          .map((i) => S.vault[i])
          .filter(Boolean)
          .reverse();
      case "foryou": {
        const l = p.slice();
        if (state.pin) {
          const k = l.findIndex((s) => s.id === state.pin);
          if (k > 0) l.unshift(l.splice(k, 1)[0]);
          else if (k < 0 && S.vault[state.pin]) l.unshift(S.vault[state.pin]);
        }
        return l;
      }
      default:
        return p.filter((s) => s.cat === c);
    }
  }
  function refreshFeed(force, toTop) {
    if (busy || (!force && Date.now() - lastRefresh < 6e4))
      return Promise.resolve();
    busy = true;
    lastRefresh = Date.now();
    $("#sync").classList.add("on");
    $("#refresh").classList.add("spin");
    return Promise.allSettled(
      (() => {
        try {
          return plan();
        } catch (e) {
          return [];
        }
      })(),
    )
      .then((rs) => {
        let got = [];
        rs.forEach((r) => {
          if (r.status === "fulfilled")
            got = got.concat(r.value.filter(Boolean));
        });
        if (got.length) {
          live = dedupe(got);
          gotLive = true;
        }
        state.stories = compose();
        const nl = applyFilter();
        if (toTop || state.activeIndex <= 1 || !state.filteredStories.length) {
          state.filteredStories = nl;
          render();
        } else {
          const have = {};
          state.filteredStories.forEach((s) => {
            have[s.id] = 1;
          });
          state.filteredStories = state.filteredStories.concat(
            nl.filter((s) => !have[s.id]),
          );
        }
        if (got.length) {
          const p = $("#livepill");
          p.classList.add("show");
          setTimeout(() => p.classList.remove("show"), 2600);
        }
      })
      .finally(() => {
        busy = false;
        $("#sync").classList.remove("on");
        $("#refresh").classList.remove("spin");
      });
  }

  /* ---------- render ---------- */
  const imgSrc = (s) => s.img || ph(s.cat, s.id);
  const monoHue = (s) => hnum(s) % 360;
  function cardHTML(s, i) {
    const b = s.local
      ? '<span class="badge loc">📍 Local</span>'
      : s.viral
        ? '<span class="badge">🔥 Trending</span>'
        : Date.now() - s.ts < 36e5
          ? '<span class="badge new">⚡ Just In</span>'
          : "";
    const nm = s.dom || s.src || "news";
    return (
      '<article class="reel-card" data-i="' +
      i +
      '"><div class="bg ' +
      esc(s.cat) +
      '"><img alt="" loading="' +
      (i < 2 ? "eager" : "lazy") +
      '" decoding="async" referrerpolicy="no-referrer" src="' +
      esc(imgSrc(s)) +
      '"></div><div class="scrim"></div><div class="meta"><span class="cat">' +
      esc(s.cat) +
      "</span>" +
      b +
      '<span class="pub"><span class="mono" style="background:hsl(' +
      monoHue(nm) +
      ' 62% 42%)">' +
      esc(nm.charAt(0).toUpperCase()) +
      "</span>" +
      esc(nm) +
      '</span><span class="t">' +
      rel(s.ts) +
      "</span></div><h2>" +
      esc(s.title) +
      '</h2><div class="qp">⚡ QUICK PULSE</div><ul class="tldr">' +
      s.bullets.map((x) => "<li>" + esc(x) + "</li>").join("") +
      '</ul><div class="rt">⏱ ' +
      s.read +
      " min read</div></article>"
    );
  }
  function bindCard(c) {
    const im = $(".bg img", c),
      s = state.filteredStories[+c.dataset.i];
    let st = 0;
    im.onload = () => im.classList.add("ok");
    im.onerror = () => {
      st++;
      if (st === 1) im.src = ph(s.cat, s.id + "x");
      else if (st === 2)
        im.src = "https://picsum.photos/seed/" + hash(s.title) + "/720/1280";
      else im.remove();
    };
    if (im.complete && im.naturalWidth) im.classList.add("ok");
    let last = 0;
    c.addEventListener("dblclick", (e) => likeAt(e.clientX, e.clientY));
    c.addEventListener(
      "touchend",
      (e) => {
        const t = Date.now(),
          p = e.changedTouches[0];
        if (t - last < 300) {
          e.preventDefault();
          likeAt(p.clientX, p.clientY);
        }
        last = t;
      },
      { passive: false },
    );
  }
  function appendRange(a, b) {
    const tmp = document.createElement("div");
    let h = "";
    for (let i = a; i < b; i++) h += cardHTML(state.filteredStories[i], i);
    tmp.innerHTML = h;
    Array.from(tmp.children).forEach((c) => {
      feed.appendChild(c);
      bindCard(c);
    });
  }
  function appendChunk() {
    const n = Math.min(shown + 10, state.filteredStories.length);
    if (n > shown) {
      appendRange(shown, n);
      shown = n;
      return true;
    }
    return false;
  }
  function ensureRendered(i) {
    while (shown <= i && appendChunk());
  }
  function render() {
    feed.innerHTML = "";
    shown = 0;
    const n = state.filteredStories.length,
      em = $("#empty");
    em.hidden = n > 0;
    state.activeIndex = 0;
    if (!n) {
      em.innerHTML =
        state.category === "near"
          ? '<div>📍 No local stories yet.</div><button data-action="open-location-modal">Set my location</button>'
          : state.category === "saved"
            ? "<div>🔖 Nothing saved yet.</div>"
            : state.category === "search"
              ? "<div>🔍 No live results for “" +
                esc(state.searchQuery || "") +
                '” yet.</div><button data-action="open-search">Try another search</button>'
              : "<div>Syncing the latest stories…</div>";
      drawSegs();
      updateRail();
      return;
    }
    appendRange(0, Math.min(12, n));
    shown = Math.min(12, n);
    feed.scrollTo({ top: 0, behavior: "instant" });
    setActive(0);
  }
  function drawSegs() {
    const n = state.filteredStories.length,
      k = Math.max(1, Math.min(n, 10)),
      el = $("#segs");
    if (el.children.length !== k) {
      el.innerHTML = new Array(k + 1).join("<i></i>");
    }
    const on = n ? Math.floor((state.activeIndex / n) * k) + 1 : 0;
    Array.from(el.children).forEach((c, i) => c.classList.toggle("on", i < on));
  }
  function setActive(i) {
    state.activeIndex = i;
    autoElapsed = 0;
    updateStats();
    const s = state.filteredStories[i];
    $$(".reel-card", feed).forEach((c, j) =>
      c.classList.toggle("active", j === i),
    );
    drawSegs();
    if (!s) {
      updateRail();
      return;
    }
    if (i > 0) state.pin = "";
    syncUrl(s);
    $("#ambient").style.backgroundImage =
      'url("' + imgSrc(s).replace(/"/g, "%22") + '")';
    updateRail();
    if (S.seen.indexOf(s.id) < 0) {
      S.seen.push(s.id);
      if (S.seen.length > 500) S.seen.splice(0, 100);
      save();
    }
    clearTimeout(dwellT);
    dwellT = setTimeout(() => {
      const c = state.filteredStories[state.activeIndex];
      if (c && c.id === s.id) boost(s.cat, 0.3);
    }, 4e3);
    speak(s);
    if (i >= shown - 3) {
      if (!appendChunk()) refreshFeed(false);
    }
  }
  function goToCard(index) {
    const n = state.filteredStories.length;
    if (!n) return;
    const i = Math.max(0, Math.min(index, n - 1));
    ensureRendered(i);
    const cards = $$(".reel-card", feed);
    if (!cards[i]) return;
    state.lock = Date.now() + 700;
    setActive(i);
    cards[i].scrollIntoView({ behavior: "smooth", block: "start" });
    feed.scrollTo({ top: i * feed.clientHeight, behavior: "smooth" });
    setTimeout(syncScroll, 760);
  }
  function syncScroll() {
    if (Date.now() < state.lock || !feed.clientHeight) return;
    const i = Math.round(feed.scrollTop / feed.clientHeight);
    if (i !== state.activeIndex && state.filteredStories[i]) setActive(i);
  }
  const cur = () => state.filteredStories[state.activeIndex];
  function boost(c, d) {
    S.w[c] = Math.min(5, (S.w[c] || 1) + d);
    save();
  }
  function updateRail() {
    const s = cur(),
      L = !!s && S.likedIds.indexOf(s.id) >= 0,
      V = !!s && S.savedIds.indexOf(s.id) >= 0;
    const set = (a, on, ic, lab) => {
      const b = $('[data-action="' + a + '"]');
      b.classList.toggle("on", on);
      if (ic) $("b>span", b).textContent = ic;
      if (lab !== undefined) $("small", b).textContent = lab;
    };
    set("like", L, L ? "❤️" : "🤍", String(S.likedIds.length));
    set("listen", S.tts, S.tts ? "🎧" : "🔊", "Listen");
    set("save", V, V ? "🔖" : "📑", String(S.savedIds.length));
    $("#pill").textContent =
      S.mode === "near"
        ? "📍 " +
          (S.city || S.region || S.country || "Near me") +
          (S.cc ? ", " + S.cc : "")
        : S.mode === "custom"
          ? "🔎 " + S.q
          : S.mode === "country"
            ? flag(S.cc) + " " + nameOf(S.cc)
            : "🌐 Global";
  }
  function renderChips() {
    const sc = state.searchQuery ? [["search", "🔍 " + state.searchQuery]] : [];
    $("#chips").innerHTML = sc
      .concat(CHIPS)
      .map(
        (c) =>
          '<button class="chip' +
          (c[0] === state.category ? " on" : "") +
          '" data-action="select-category" data-category="' +
          esc(c[1].split(" ").slice(1).join(" ")) +
          '" data-key="' +
          c[0] +
          '">' +
          esc(c[1]) +
          "</button>",
      )
      .join("");
  }

  /* ---------- actions ---------- */
  function likeAt(x, y) {
    const s = cur();
    if (!s) return;
    if (S.likedIds.indexOf(s.id) < 0) {
      S.likedIds.push(s.id);
      boost(s.cat, 0.5);
      save();
      toast("❤️ Liked! More like this will appear");
    }
    updateRail();
    burst(x, y);
  }
  function burst(x, y) {
    const st = $("#stage"),
      a = st.getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      const h = document.createElement("div");
      h.className = "heart";
      h.textContent = "❤️";
      h.style.left = x - a.left + "px";
      h.style.top = y - a.top + "px";
      h.style.setProperty("--dx", Math.random() * 160 - 80 + "px");
      h.style.setProperty("--dy", -(40 + Math.random() * 140) + "px");
      h.style.setProperty("--r", Math.random() * 60 - 30 + "deg");
      st.appendChild(h);
      setTimeout(() => h.remove(), 950);
    }
  }
  function toggleLike() {
    const s = cur();
    if (!s) return;
    if (S.likedIds.indexOf(s.id) >= 0) {
      S.likedIds = S.likedIds.filter((x) => x !== s.id);
      save();
      updateRail();
      toast("💔 Like removed");
    } else {
      const r = $('[data-action="like"]').getBoundingClientRect();
      likeAt(r.left + r.width / 2, r.top);
    }
  }
  function wave(on) {
    $('[data-action="listen"]').classList.toggle("speaking", on);
  }
  function speak(s) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speaking = false;
    wave(false);
    if (!S.tts || !s) return;
    const u = new SpeechSynthesisUtterance(
      s.title + ". " + s.bullets.join(" "),
    );
    u.lang = "en";
    u.onstart = () => {
      speaking = true;
      wave(true);
    };
    u.onend = () => {
      speaking = false;
      wave(false);
      if (state.auto && S.tts && cur() && cur().id === s.id)
        setTimeout(() => goToCard(state.activeIndex + 1), 500);
    };
    u.onerror = () => {
      speaking = false;
      wave(false);
    };
    speechSynthesis.speak(u);
  }
  function toggleListen() {
    if (!("speechSynthesis" in window))
      return toast("Audio anchor is not supported in this browser");
    S.tts = !S.tts;
    save();
    updateRail();
    toast("🔊 Audio Anchor: " + (S.tts ? "ON" : "OFF"));
    speak(cur());
  }
  function toggleSave() {
    const s = cur();
    if (!s) return;
    const i = S.savedIds.indexOf(s.id);
    if (i >= 0) {
      S.savedIds.splice(i, 1);
      delete S.vault[s.id];
      toast("Removed from Vault");
    } else {
      S.savedIds.push(s.id);
      S.vault[s.id] = s;
      toast("🔖 Saved to Vault");
    }
    save();
    updateRail();
    if (state.category === "saved") {
      state.filteredStories = applyFilter();
      render();
    }
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(t);
    return new Promise((ok, no) => {
      try {
        const a = document.createElement("textarea");
        a.value = t;
        a.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(a);
        a.select();
        const r = document.execCommand("copy");
        a.remove();
        r ? ok() : no();
      } catch (e) {
        no(e);
      }
    });
  }
  function deepUrl(s) {
    if (location.protocol.indexOf("http") !== 0) return "";
    let u = location.origin + location.pathname + "?story=" + enc(s.id);
    if (!/^pb/.test(s.id)) u += "&q=" + enc(s.title.slice(0, 80));
    return u;
  }
  function syncUrl(s) {
    if (deferUrl || location.protocol.indexOf("http") !== 0) return;
    try {
      history.replaceState(
        null,
        "",
        "?" +
          (state.category === "search" && state.searchQuery
            ? "q=" + enc(state.searchQuery) + "&"
            : "") +
          "story=" +
          enc(s.id),
      );
    } catch (e) {}
  }
  function share() {
    const s = cur();
    if (!s) return;
    const d = deepUrl(s),
      line = d
        ? s.title + " — " + d + "\nSource: " + s.url
        : s.title + " — " + s.url;
    const fb = () =>
      copyText(line).then(
        () => toast("🔗 Story link copied!"),
        () => toast("Couldn't copy the link"),
      );
    if (navigator.share && d)
      navigator
        .share({ title: s.title, text: s.title + "\nSource: " + s.url, url: d })
        .catch((e) => {
          if (!e || e.name !== "AbortError") fb();
        });
    else fb();
  }
  let rTok = 0;
  function fillReader(s, paras) {
    const b = $("#rd-body");
    b.innerHTML = "";
    const h = document.createElement("h4");
    h.textContent = "KEY TAKEAWAYS";
    b.appendChild(h);
    const ul = document.createElement("ul");
    s.bullets.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    b.appendChild(ul);
    const h2 = document.createElement("h4");
    h2.textContent = "FULL STORY";
    b.appendChild(h2);
    paras.forEach((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      b.appendChild(p);
    });
  }
  function openReader() {
    const s = cur();
    if (!s) return;
    const tok = ++rTok;
    $("#rd-title").textContent = s.title;
    $("#rd-meta").textContent =
      (s.src || s.dom) + " · " + rel(s.ts) + " · " + s.read + " min read";
    $("#rd-ext").href = s.url;
    const paras = String(s.fullText || "")
      .split(/\n\n+/)
      .filter(Boolean);
    fillReader(s, paras);
    openModal("reader");
    if (
      paras.length < 5 &&
      !/^pb/.test(s.id) &&
      s.url.indexOf("news.google.com") < 0
    )
      jget(AO(s.url), 12000)
        .then((j) => {
          if (tok !== rTok) return;
          const d = new DOMParser().parseFromString(
            j.contents || "",
            "text/html",
          );
          $$(
            "script,style,nav,footer,aside,form,noscript,header,figure",
            d,
          ).forEach((e) => e.remove());
          const get = (r) =>
            $$("p", r)
              .map((p) => p.textContent.replace(/\s+/g, " ").trim())
              .filter((t) => t.length > 60);
          let ps = get(
            d.querySelector("article") || d.querySelector("main") || d.body,
          );
          if (ps.length < 2) ps = get(d.body);
          if (ps.length >= 3) fillReader(s, ps.slice(0, 40));
        })
        .catch(() => {});
  }
  function openModal(id) {
    $$(".modal-backdrop").forEach((m) => m.classList.remove("open"));
    $("#" + id).classList.add("open");
  }
  function closeModals() {
    rTok++;
    $$(".modal-backdrop").forEach((m) => m.classList.remove("open"));
  }

  /* ---------- location ---------- */
  const gps = () =>
    new Promise((ok, no) => {
      if (!navigator.geolocation) return no(new Error("nogps"));
      navigator.geolocation.getCurrentPosition(ok, no, {
        timeout: 4000,
        maximumAge: 3e5,
      });
    });
  const ipGeo = () =>
    Promise.any([
      jget("https://ipwho.is/", 6000).then((j) => {
        if (j.success === false) throw new Error("ipwho");
        return {
          city: j.city,
          region: j.region,
          cc: j.country_code,
          country: j.country,
        };
      }),
      jget("https://get.geojs.io/v1/ip/geo.json", 6000).then((j) => {
        if (!j.country_code) throw new Error("geojs");
        return {
          city: j.city,
          region: j.region,
          cc: j.country_code,
          country: j.country,
        };
      }),
    ]);
  function detect() {
    return gps()
      .then((p) =>
        jget(
          "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
            p.coords.latitude +
            "&lon=" +
            p.coords.longitude +
            "&accept-language=en",
          6000,
        ).then((r) => {
          const a = r.address || {};
          if (!a.country_code) throw new Error("rev");
          return {
            city: a.city || a.town || a.village || a.suburb || a.county || "",
            region: a.state || a.state_district || "",
            cc: a.country_code.toUpperCase(),
            country: a.country || "",
          };
        }),
      )
      .catch(() => ipGeo())
      .then((l) => {
        S.mode = "near";
        S.cc = (l.cc || "US").toUpperCase();
        S.city = l.city || "";
        S.region = l.region || "";
        S.country = l.country || nameOf(S.cc);
        S.q = "";
        S.onboarded = true;
        save();
        updateRail();
        return l;
      });
  }
  let sug = "";
  function grid(q) {
    q = (q || "").toLowerCase();
    $("#loc-grid").innerHTML = CC.filter(
      (c) =>
        !q || c[1].toLowerCase().indexOf(q) >= 0 || c[0].toLowerCase() === q,
    )
      .sort((a, b) => (b[0] === sug) - (a[0] === sug))
      .map(
        (c) =>
          '<button data-action="select-country" data-country="' +
          c[0] +
          '" class="' +
          (c[0] === sug ? "sug" : "") +
          '"><span>' +
          flag(c[0]) +
          "</span>" +
          esc(c[1]) +
          " · " +
          c[0] +
          "</button>",
      )
      .join("");
  }
  function openLoc() {
    openModal("locmodal");
    grid($("#loc-q").value);
    if (!sug)
      ipGeo()
        .then((l) => {
          sug = (l.cc || "").toUpperCase();
          grid($("#loc-q").value);
        })
        .catch(() => {});
  }
  function applyLoc() {
    S.onboarded = true;
    save();
    closeModals();
    updateRail();
    if (state.category === "near" && S.mode === "global")
      state.category = "foryou";
    renderChips();
    state.stories = compose();
    state.filteredStories = applyFilter();
    render();
    refreshFeed(true, true);
  }
  function searchLoc() {
    const v = $("#loc-q").value.trim();
    if (v.length < 2) return toast("Type a city, country or topic");
    const m = CC.find(
      (c) =>
        c[1].toLowerCase() === v.toLowerCase() ||
        c[0].toLowerCase() === v.toLowerCase(),
    );
    if (m) {
      S.mode = "country";
      S.cc = m[0];
      S.country = m[1];
      S.city = "";
      S.region = "";
      S.q = "";
    } else {
      S.mode = "custom";
      S.q = v;
      S.cc = "US";
      S.city = "";
      S.region = "";
    }
    applyLoc();
  }
  function selectCategory(key) {
    state.pin = "";
    state.category = key;
    renderChips();
    state.filteredStories = applyFilter();
    render();
    if (
      key === "near" &&
      !state.filteredStories.length &&
      S.mode !== "near" &&
      S.mode !== "custom"
    ) {
      toast("Detecting your location…");
      detect()
        .then((l) => {
          toast(
            "📍 Location set to " +
              (l.city || l.region || "your area") +
              ", " +
              (l.country || nameOf(S.cc)),
          );
          state.stories = compose();
          return refreshFeed(true, true);
        })
        .then(() => {
          state.filteredStories = applyFilter();
          render();
        })
        .catch(() => toast("Couldn't detect — use the location menu"));
    }
  }

  /* ---------- live search, auto-reel, stats ---------- */
  const AUTO_MS = 12000;
  let autoElapsed = 0,
    speaking = false,
    hover = false,
    hold = false;
  function guessCat(q) {
    q = q.toLowerCase();
    if (
      /cricket|football|soccer|formula|f1|sport|nba|ipl|olympic|tennis|match/.test(
        q,
      )
    )
      return "sports";
    if (
      /\bai\b|tech|software|chip|app|cyber|startup|robot|gadget|iphone|android/.test(
        q,
      )
    )
      return "tech";
    if (
      /stock|market|econom|business|bank|price|inflation|rupee|dollar|trade/.test(
        q,
      )
    )
      return "business";
    if (
      /space|science|nasa|isro|climate|health|research|medical|physics/.test(q)
    )
      return "science";
    if (/movie|film|music|celebr|bollywood|culture|festival|art/.test(q))
      return "culture";
    return "world";
  }
  function openSearch() {
    openModal("searchmodal");
    setTimeout(() => {
      const i = $("#search-q");
      if (i) i.focus();
    }, 60);
  }
  function runSearch(q) {
    deferUrl = false;
    q = String(q || "").trim();
    if (q.length < 2) return toast("Type a topic, event or city");
    closeModals();
    const cc = S.cc === "EU" ? "GB" : S.cc,
      cat = guessCat(q);
    state.searchQuery = q;
    state.searchResults = [];
    state.category = "search";
    state.filteredStories = [];
    renderChips();
    render();
    toast("🔍 Searching live news for “" + q + "”…");
    $("#sync").classList.add("on");
    const g = (path, b) =>
      rss(
        "https://news.google.com/rss" +
          path +
          "?hl=en-" +
          cc +
          "&gl=" +
          cc +
          "&ceid=" +
          cc +
          ":en",
        cat,
        b,
      );
    Promise.allSettled([
      rss(
        "https://news.google.com/rss/search?q=" +
          enc(q) +
          "+when:1d&hl=en-" +
          cc +
          "&gl=" +
          cc +
          "&ceid=" +
          cc +
          ":en",
        cat,
        "local",
      ),
      g("/headlines/section/geo/" + enc(q), "local"),
      gdelt(q, cat, "local"),
    ])
      .then((rs) => {
        let got = [];
        rs.forEach((r) => {
          if (r.status === "fulfilled")
            got = got.concat(r.value.filter(Boolean));
        });
        got = dedupe(got).sort((x, y) => y.ts - x.ts);
        if (state.searchQuery !== q) return;
        state.searchResults = got;
        state.category = "search";
        state.filteredStories = got;
        renderChips();
        render();
        if (got.length) {
          toast("🔍 " + got.length + " live stories for “" + q + "”");
          const p = $("#livepill");
          p.classList.add("show");
          setTimeout(() => p.classList.remove("show"), 2600);
        }
      })
      .finally(() => $("#sync").classList.remove("on"));
  }
  function paintAuto() {
    const b = $('[data-action="toggle-autoscroll"]');
    b.textContent = state.auto ? "⏸ Auto" : "▶️ Auto";
    b.classList.toggle("on", state.auto);
    $(".autobar").classList.toggle("show", state.auto);
    $("#autofill").style.width = "0%";
  }
  function toggleAuto() {
    state.auto = !state.auto;
    autoElapsed = 0;
    paintAuto();
    toast(state.auto ? "▶️ Auto-Reel ON — hands-free mode" : "⏸ Auto-Reel OFF");
  }
  function updateStats() {
    const n = state.filteredStories.length,
      p = $("#st-pos"),
      l = $("#st-live"),
      t = $("#st-time");
    if (p) p.textContent = (n ? state.activeIndex + 1 : 0) + "/" + n;
    if (l) {
      l.textContent = gotLive ? "Live" : "Cached";
      l.style.background = gotLive ? "#34c759" : "#ffd60a";
    }
    if (t)
      t.textContent = lastRefresh
        ? new Date(lastRefresh).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";
  }
  setInterval(() => {
    if (!state.auto) return;
    const paused =
      hover ||
      hold ||
      document.hidden ||
      speaking ||
      $$(".modal-backdrop.open").length > 0;
    if (!paused) autoElapsed += 100;
    $("#autofill").style.width =
      Math.min(100, (autoElapsed / AUTO_MS) * 100) + "%";
    if (autoElapsed >= AUTO_MS) {
      autoElapsed = 0;
      if (state.activeIndex >= state.filteredStories.length - 1)
        refreshFeed(true).catch(() => {});
      else goToCard(state.activeIndex + 1);
    }
  }, 100);
  $("#stage").addEventListener("mouseenter", () => {
    hover = true;
  });
  $("#stage").addEventListener("mouseleave", () => {
    hover = false;
  });
  feed.addEventListener(
    "touchstart",
    () => {
      hold = true;
    },
    { passive: true },
  );
  feed.addEventListener(
    "touchend",
    () => {
      hold = false;
    },
    { passive: true },
  );
  feed.addEventListener(
    "touchcancel",
    () => {
      hold = false;
    },
    { passive: true },
  );
  $("#search-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch($("#search-q").value);
  });

  /* ---------- single document delegator ---------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const a = btn.dataset.action;
    if (
      a === "close-modal" &&
      btn.classList.contains("modal-backdrop") &&
      e.target !== btn
    )
      return;
    switch (a) {
      case "next-card":
        goToCard(state.activeIndex + 1);
        break;
      case "prev-card":
        goToCard(state.activeIndex - 1);
        break;
      case "like":
        toggleLike();
        break;
      case "listen":
        toggleListen();
        break;
      case "read":
        openReader();
        break;
      case "save":
        toggleSave();
        break;
      case "share":
        share();
        break;
      case "open-location-modal":
        openLoc();
        break;
      case "detect-gps": {
        btn.textContent = "📍 Detecting…";
        detect()
          .then((l) => {
            toast(
              "📍 Location set to " +
                (l.city || l.region || "your area") +
                ", " +
                (l.country || nameOf(S.cc)),
            );
            applyLoc();
          })
          .catch(() => toast("Couldn't detect — pick a country"))
          .finally(() => {
            btn.textContent = "📍 Detect My Current Location (GPS / IP)";
          });
        break;
      }
      case "select-country": {
        const c = btn.dataset.country;
        S.mode = "country";
        S.cc = c;
        S.country = nameOf(c);
        S.city = "";
        S.region = "";
        S.q = "";
        applyLoc();
        toast(flag(c) + " " + nameOf(c));
        break;
      }
      case "select-global":
        S.mode = "global";
        S.cc = "US";
        S.country = "";
        S.city = "";
        S.region = "";
        S.q = "";
        applyLoc();
        break;
      case "search-location":
        searchLoc();
        break;
      case "select-category":
        selectCategory(btn.dataset.key || btn.dataset.category.toLowerCase());
        break;
      case "refresh":
        state.pin = "";
        toast("Refreshing…");
        refreshFeed(true, true).then(() => {
          goToCard(0);
          toast("⚡ Feed refreshed");
        });
        break;
      case "open-search":
        openSearch();
        break;
      case "run-search":
        runSearch(btn.dataset.q || ($("#search-q") || {}).value);
        break;
      case "toggle-autoscroll":
        toggleAuto();
        break;
      case "close-modal":
        closeModals();
        break;
    }
  });

  /* ---------- scroll engine ---------- */
  let lastWheel = 0;
  feed.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const t = Date.now(),
        gap = t - lastWheel;
      lastWheel = t;
      if (gap <= 250 || Math.abs(e.deltaY) <= 25) return;
      goToCard(state.activeIndex + (e.deltaY > 0 ? 1 : -1));
    },
    { passive: false },
  );
  let ty = 0,
    ti = 0;
  feed.addEventListener(
    "touchstart",
    (e) => {
      ty = e.touches[0].clientY;
      ti = state.activeIndex;
    },
    { passive: true },
  );
  feed.addEventListener(
    "touchend",
    (e) => {
      const dy = ty - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 40) goToCard(ti + (dy > 0 ? 1 : -1));
    },
    { passive: true },
  );
  feed.addEventListener("scroll", syncScroll, { passive: true });
  $("#loc-q").addEventListener("input", (e) => grid(e.target.value));
  $("#loc-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchLoc();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.matches && e.target.matches("input")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "Escape") {
      closeModals();
      return;
    }
    if (
      $("#locmodal").classList.contains("open") ||
      $("#searchmodal").classList.contains("open")
    )
      return;
    if (k === "ArrowDown" || k === "j" || k === "J") {
      e.preventDefault();
      goToCard(state.activeIndex + 1);
    } else if (k === "ArrowUp" || k === "k" || k === "K") {
      e.preventDefault();
      goToCard(state.activeIndex - 1);
    } else if (k === "l" || k === "L") toggleLike();
    else if (k === "m" || k === "M") toggleListen();
    else if (k === "s" || k === "S") toggleSave();
    else if (k === "a" || k === "A") toggleAuto();
    else if (k === "/") {
      e.preventDefault();
      openSearch();
    } else if (k === "r" || k === "R" || k === " ") {
      e.preventDefault();
      $("#reader").classList.contains("open") ? closeModals() : openReader();
    }
  });

  /* ---------- boot ---------- */
  function loadFallback(a) {
    fallback = (Array.isArray(a) ? a : []).filter(
      (s) => s && s.bullets && s.bullets.length === 3,
    );
  }
  function boot() {
    state.pin = DL.get("story") || "";
    deferUrl = !!(DL.get("q") || DL.get("city"));
    renderChips();
    paintAuto();
    loadFallback(window.PULSE_FALLBACK_FEED);
    state.stories = compose();
    state.filteredStories = applyFilter();
    render();
    if (location.protocol.indexOf("http") === 0)
      jget("./data/fallback-feed.json?t=" + Date.now(), 8000)
        .then((j) => {
          const a = Array.isArray(j) ? j : j.stories || [];
          if (a.length) {
            loadFallback(a);
            if (state.activeIndex <= 1 && state.category !== "search") {
              state.stories = compose();
              state.filteredStories = applyFilter();
              render();
            } else state.stories = compose();
          }
        })
        .catch(() => {});
    const dq = DL.get("q") || DL.get("city");
    if (!S.onboarded && !dq && !state.pin) openLoc();
    refreshFeed(true);
    if (dq) runSearch(dq);
    setInterval(() => {
      if (!document.hidden) refreshFeed(false);
    }, 6e5);
  }
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  )
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  boot();
})();

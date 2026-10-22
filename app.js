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

  /* ---------- engagement engine: fingerprints + persistent stores ---------- */
  const GOAL = 5;
  let NOSTORE = false;
  // 32-bit FNV-1a -> 8-char hex.
  const fnv1a = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  // Strip utm_*, #hash and trailing slash. Scheme-insensitive so http/https variants match.
  const normUrl = (u) => {
    const raw = String(u || "").trim();
    if (!raw) return "";
    try {
      const x = new URL(raw);
      [...x.searchParams.keys()].forEach((k) => {
        if (/^utm_/i.test(k)) x.searchParams.delete(k);
      });
      x.hash = "";
      return x.host + x.pathname.replace(/\/+$/, "") + x.search;
    } catch {
      return raw.replace(/#.*$/, "").replace(/\/+$/, "");
    }
  };
  const normTitle = (t) =>
    String(t == null ? "" : t)
      .trim()
      .toLowerCase();
  const getArticleId = (item) => {
    const it = item || {};
    const key =
      normUrl(it.url || it.link) ||
      normTitle(it.title) ||
      String(it.id == null ? "" : it.id);
    return fnv1a(key);
  };
  const STOP = new Set(
    "a an the and or of to in on at for with by from as is are was were be been it its this that these those will would can could has have had not no but into over after before about says say said new".split(
      " ",
    ),
  );
  // Headline signature: strip " - Source"/" | Source", non-alphanumerics and stopwords.
  const titleSig = (t) => {
    const x = String(t == null ? "" : t)
      .toLowerCase()
      .replace(/\s+[-|–—]\s+[^-|–—]{2,40}$/, "");
    const w = x
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((q) => q && !STOP.has(q));
    return w.length >= 3 ? fnv1a(w.join(" ")) : "";
  };
  const stamp = (s) => {
    if (s && typeof s === "object") {
      if (!s._cid) s._cid = getArticleId(s);
      if (!s._titleSig) s._titleSig = titleSig(s.title) || fnv1a("u:" + s._cid);
    }
    return s;
  };
  const cid = (s) => (s ? s._cid || stamp(s)._cid : "");
  const tsig = (s) => (s ? s._titleSig || stamp(s)._titleSig : "");
  const ymd = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  const todayStr = () => ymd(new Date());
  const ydayStr = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return ymd(y);
  };

  // Permanent seen-ID set: FIFO capped, loaded synchronously, debounced writes.
  const SeenStore = (() => {
    const KEY = "pulse_seen_v1",
      MAX = 10000;
    let arr = [],
      set = new Set(),
      timer = 0,
      dirty = false;
    const read = () => {
      const v = LS.get(KEY, []);
      arr = Array.isArray(v)
        ? v.filter((x) => typeof x === "string").slice(-MAX)
        : [];
      set = new Set(arr);
    };
    const flush = () => {
      clearTimeout(timer);
      timer = 0;
      if (!dirty) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(arr));
        dirty = false;
      } catch {}
    };
    read();
    return {
      has: (id) => set.has(id),
      add(id) {
        if (!id || set.has(id)) return false;
        set.add(id);
        arr.push(id);
        if (arr.length > MAX)
          arr.splice(0, arr.length - MAX).forEach((x) => set.delete(x));
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(flush, 200);
        return true;
      },
      flush,
      remove(ids) {
        const rm = new Set(ids);
        let hit = false;
        arr = arr.filter((x) => {
          if (!rm.has(x)) return true;
          set.delete(x);
          hit = true;
          return false;
        });
        if (hit) {
          dirty = true;
          flush();
        }
        return hit;
      },
      // Merge ids written by another tab without losing our unsaved ones.
      reload() {
        const mine = arr;
        read();
        mine.forEach((id) => {
          if (!set.has(id)) {
            set.add(id);
            arr.push(id);
          }
        });
      },
      get size() {
        return set.size;
      },
    };
  })();

  // Saved vault (article objects). Migrates the legacy v2 list on first run.
  const SavedStore = (() => {
    const KEY = "pulse_saved_v1";
    return {
      load() {
        let v = LS.get(KEY, null);
        const migrate = !Array.isArray(v);
        if (migrate) v = LS.get("pulse_saved_v2", []);
        if (!Array.isArray(v)) v = [];
        const seen = new Set();
        v = v
          .filter((x) => x && x.id && x.title && x.url)
          .map(stamp)
          .filter((x) => !seen.has(x._cid) && seen.add(x._cid));
        if (migrate && v.length) LS.set(KEY, v);
        return v;
      },
      save(list) {
        LS.set(KEY, list);
      },
    };
  })();

  // Daily goal + streak. A streak day counts once the daily goal is reached.
  const StreakStore = (() => {
    const KEY = "pulse_streak_v1";
    const blank = () => ({
      currentStreak: 0,
      bestStreak: 0,
      lastActiveDate: "",
      todayDate: todayStr(),
      todayReadCount: 0,
    });
    let d;
    const load = () => {
      const v = LS.get(KEY, null);
      if (v && typeof v === "object") return Object.assign(blank(), v);
      const b = blank(),
        old = LS.get("pulse_daily", null);
      if (old && typeof old === "object") {
        b.currentStreak = +old.streak || 0;
        b.bestStreak = b.currentStreak;
        b.lastActiveDate = old.last || "";
        if (old.date === b.todayDate && Array.isArray(old.read))
          b.todayReadCount = old.read.length;
      }
      return b;
    };
    const roll = () => {
      const t = todayStr();
      if (d.todayDate !== t) {
        d.todayDate = t;
        d.todayReadCount = 0;
      }
      if (
        d.currentStreak &&
        d.lastActiveDate !== t &&
        d.lastActiveDate !== ydayStr()
      )
        d.currentStreak = 0;
    };
    d = load();
    roll();
    return {
      status() {
        roll();
        const locked = d.lastActiveDate === todayStr();
        return {
          streak: d.currentStreak,
          best: d.bestStreak,
          today: d.todayReadCount,
          goal: GOAL,
          locked,
          atRisk: !locked && d.currentStreak > 0,
        };
      },
      // The FIRST read each day locks/increments the streak; the goal ring
      // (todayReadCount/GOAL) completes independently, exactly once per day.
      bump() {
        roll();
        d.todayReadCount++;
        let first = false;
        if (d.lastActiveDate !== todayStr()) {
          d.currentStreak =
            d.lastActiveDate === ydayStr() ? d.currentStreak + 1 : 1;
          d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
          d.lastActiveDate = todayStr();
          first = true;
        }
        LS.set(KEY, d);
        return { first, goalDone: d.todayReadCount === GOAL };
      },
    };
  })();

  // Fast topic inference for generic "top" stories: source host first, then keywords.
  const SRC_CAT = [
    [
      "sports",
      /espn|cricbuzz|cricinfo|skysports|sportstar|goal\.com|olympics|bleacherreport/,
    ],
    [
      "tech",
      /techcrunch|verge|wired|arstechnica|engadget|gadgets360|9to5|zdnet|cnet|tomshardware|androidauthority|hackernews|ycombinator/,
    ],
    [
      "business",
      /livemint|mint|economictimes|moneycontrol|businessstandard|bloomberg|ft\.com|cnbc|marketwatch|financialexpress|forbes|wsj/,
    ],
    [
      "science",
      /nature\.com|space\.com|sciencedaily|newscientist|sciencenews|phys\.org|isro|nasa/,
    ],
    [
      "world",
      /aljazeera|dw\.com|bbc\.com\/news\/world|france24|apnews|reuters/,
    ],
    [
      "entertainment",
      /variety|hollywoodreporter|deadline|billboard|rollingstone|pinkvilla|filmfare|bollywoodhungama|ew\.com/,
    ],
    [
      "health",
      /webmd|healthline|statnews|medicalnewstoday|who\.int|everydayhealth|healthshots/,
    ],
    [
      "india",
      /ndtv|thehindu|hindustantimes|indianexpress|timesofindia|news18|indiatoday|deccan|theprint|scroll\.in/,
    ],
  ];
  const KW_CAT = [
    [
      "sports",
      /\b(cricket|ipl|bcci|wicket|batter|bowler|innings|football|fifa|tennis|olympic|olympics|grand slam|formula 1|f1|nba|nfl|medal|tournament|league|world cup|champions? trophy|coach|striker|goalkeeper|stadium|match)\b/g,
    ],
    [
      "tech",
      /\b(ai|artificial intelligence|openai|chatgpt|google|apple|iphone|android|microsoft|nvidia|semiconductor|chip|chips|software|startup|cyber|hacker|robot|smartphone|laptop|tesla|spacex|app|gadget|data breach|cloud|algorithm|tech)\b/g,
    ],
    [
      "business",
      /\b(sensex|nifty|stock|stocks|shares|market|markets|rbi|bank|banks|inflation|gdp|economy|economic|rupee|dollar|ipo|profit|revenue|earnings|tax|gst|trade|tariff|merger|acquisition|investors?|fund|rate cut|interest rates?)\b/g,
    ],
    [
      "science",
      /\b(nasa|isro|space|scientists?|research|researchers|study|climate|vaccine|planet|telescope|species|quantum|physics|lunar|moon|mars|astronomers?|fossil|genome|discovery|asteroid)\b/g,
    ],
    [
      "world",
      /\b(ukraine|russia|gaza|israel|hamas|iran|china|beijing|washington|white house|un|nato|president|prime minister|embassy|sanctions|ceasefire|treaty|europe|eu|pakistan|bangladesh|taliban|summit)\b/g,
    ],
    [
      "entertainment",
      /\b(movie|movies|film|box office|actor|actress|bollywood|hollywood|netflix|series|album|singer|concert|trailer|oscars?|grammys?|celebrity|streaming)\b/g,
    ],
    [
      "health",
      /\b(health|hospital|doctors?|disease|virus|vaccine|cancer|diabetes|obesity|nutrition|diet|mental health|wellness|outbreak|patients?|medicine|symptoms?)\b/g,
    ],
    [
      "india",
      /\b(india|indian|modi|bjp|congress|lok sabha|rajya sabha|supreme court|delhi|mumbai|kolkata|chennai|bengaluru|bangalore|hyderabad|jharkhand|ranchi|jamshedpur|bihar|uttar pradesh|maharashtra|kerala|gujarat)\b/g,
    ],
  ];
  const inferCategory = (item) => {
    const it = item || {};
    let host = "";
    try {
      host = new URL(it.url || it.link || "").hostname;
    } catch {}
    const who = (String(it.src || "") + " " + host).toLowerCase();
    for (const [c, re] of SRC_CAT) if (re.test(who)) return c;
    const text = (
      String(it.title || "") +
      " " +
      String(it.summary || "")
    ).toLowerCase();
    let best = "",
      top = 0;
    for (const [c, re] of KW_CAT) {
      const n = (text.match(re) || []).length;
      if (n > top) {
        top = n;
        best = c;
      }
    }
    return best;
  };
  // Effective topic: real category if known, else inferred (cached on the item).
  const topicOf = (s) => {
    if (!s) return "";
    if (s._topicCategory === undefined) {
      const c = s.ocat || s.cat || "";
      s._topicCategory =
        c && c !== "top" && c !== "local" ? c : inferCategory(s) || c || "";
    }
    return s._topicCategory;
  };

  // Implicit interest weights per category and per source.
  const AffinityStore = (() => {
    const KEY = "pulse_affinity_v1",
      CAP = 200,
      KEEP = 60;
    let d = LS.get(KEY, null),
      t = 0;
    if (!d || typeof d !== "object") d = {};
    if (!d.c || typeof d.c !== "object") d.c = {};
    if (!d.s || typeof d.s !== "object") d.s = {};
    const trim = (o) => {
      const k = Object.keys(o);
      if (k.length > KEEP)
        k.sort((a, b) => o[b] - o[a])
          .slice(KEEP)
          .forEach((x) => delete o[x]);
    };
    const flush = () => {
      clearTimeout(t);
      t = 0;
      try {
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch {}
    };
    return {
      bump(s, n) {
        if (!s || s.seed) return;
        const c = String(topicOf(s)),
          r = String(s.src || "");
        if (c) d.c[c] = Math.min(CAP, (d.c[c] || 0) + n);
        if (r) {
          d.s[r] = Math.min(CAP, (d.s[r] || 0) + n);
          trim(d.s);
        }
        clearTimeout(t);
        t = setTimeout(flush, 400);
      },
      // 0..1, saturating.
      score(s) {
        const raw = 0.6 * (d.c[topicOf(s)] || 0) + 0.4 * (d.s[s.src] || 0);
        return raw / (raw + 8);
      },
      top(n) {
        return Object.keys(d.c)
          .filter((k) => d.c[k] > 0)
          .sort((a, b) => d.c[b] - d.c[a])
          .slice(0, n);
      },
      flush,
    };
  })();

  // A story is "seen" if EITHER its URL id or its headline signature was seen.
  const isSeen = (s) =>
    !!s && (SeenStore.has(cid(s)) || SeenStore.has("t:" + tsig(s)));
  const seenAdd = (s) => {
    if (isSeen(s)) return false;
    SeenStore.add(cid(s));
    SeenStore.add("t:" + tsig(s));
    return true;
  };

  // Persistent reservoir of unseen stories (cap 150) for instant backfill.
  const UnseenPoolStore = (() => {
    const KEY = "pulse_pool_v1",
      CAP = 150,
      MAXAGE = 14 * 864e5;
    const rej = new Set();
    let t = 0;
    const slim = (s) => ({
      id: s.id,
      ocat: s.ocat,
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
      bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 3) : [],
    });
    const keys = (s) => [cid(s), "t:" + tsig(s)];
    const ok = (s) =>
      s &&
      s.title &&
      s.url &&
      s.ts &&
      Date.now() - s.ts <= MAXAGE &&
      !isSeen(s);
    let items = [];
    {
      const v = LS.get(KEY, []);
      const have = new Set();
      (Array.isArray(v) ? v : []).forEach((x) => {
        if (!ok(x)) return;
        stamp(x);
        const k = keys(x);
        if (k.some((q) => have.has(q))) return;
        k.forEach((q) => have.add(q));
        items.push(x);
      });
    }
    const flush = () => {
      clearTimeout(t);
      t = 0;
      try {
        localStorage.setItem(KEY, JSON.stringify(items.map(slim)));
      } catch {}
    };
    const later = () => {
      clearTimeout(t);
      t = setTimeout(flush, 300);
    };
    return {
      add(list) {
        const have = new Set();
        items.forEach((x) => keys(x).forEach((q) => have.add(q)));
        let n = 0;
        for (const raw of list || []) {
          if (!raw || !raw.title || !raw.url || !raw.ts || raw.seed) continue;
          const c = stamp(slim(raw));
          const k = keys(c);
          if (!ok(c) || k.some((q) => have.has(q) || rej.has(q))) continue;
          k.forEach((q) => have.add(q));
          items.push(c);
          n++;
        }
        if (n) {
          if (items.length > CAP)
            items = items.sort((a, b) => b.ts - a.ts).slice(0, CAP);
          later();
        }
        return n;
      },
      evict(s) {
        const k = new Set(keys(s)),
          before = items.length;
        items = items.filter((x) => !keys(x).some((q) => k.has(q)));
        if (items.length !== before) later();
      },
      reject(s) {
        keys(s).forEach((q) => rej.add(q));
        this.evict(s);
      },
      // Best unseen, not-yet-rendered stories: topic match first, then blended score.
      pick(cat, n, ex, strict) {
        if (n <= 0) return [];
        return items
          .filter(
            (s) =>
              !isSeen(s) &&
              !(ex && keys(s).some((q) => ex.has(q))) &&
              (!strict || topicOf(s) === cat),
          )
          .map((s) => ({
            s,
            k: blend(s) + (cat !== "foryou" && topicOf(s) === cat ? 1 : 0),
          }))
          .sort((a, b) => b.k - a.k)
          .slice(0, n)
          .map((x) => x.s);
      },
      all: () => items.slice(),
      get size() {
        return items.length;
      },
      flush,
    };
  })();

  // Paging cursors for the deep-harvest JSON APIs.
  const CursorStore = (() => {
    const KEY = "pulse_cursors_v1";
    let d = LS.get(KEY, null);
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    d = Object.assign({ hn: 0, sf: 0, dev: 1, rd: "", sub: 0 }, d);
    return {
      get: (k) => d[k],
      set(k, v) {
        d[k] = v;
        try {
          localStorage.setItem(KEY, JSON.stringify(d));
        } catch {}
      },
    };
  })();

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
    {
      id: "entertainment",
      label: "Entertainment",
      topic: "ENTERTAINMENT",
      q: "entertainment",
      fb: "entertainment",
      sv: ["entertainment/in", "entertainment/us"],
      ok: ["Entertainment"],
    },
    {
      id: "health",
      label: "Health",
      topic: "HEALTH",
      q: "health",
      fb: "health",
      sv: ["health/in", "health/us"],
      ok: ["Health"],
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
    entertainment: [
      "1489599849927-2ee91cede3ba",
      "1536440136628-849c177e76a1",
      "1514525253161-7a46d19cd819",
      "1470229722913-7c0e2dbbafd3",
      "1478720568477-152d9b164e26",
      "1485846234645-a62644f84728",
    ],
    health: [
      "1505751172876-fa1923c5c528",
      "1576091160399-112ba8d25d1d",
      "1490645935967-10de6ba17061",
      "1571019613454-1cb2f99b2d8b",
      "1584515933487-779824d29309",
      "1579684385127-1ef15d508118",
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
  state.savedList = SavedStore.load();
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
    return fetch(u, {
      signal: c.signal,
      cache: NOSTORE ? "no-store" : "default",
    })
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
    entertainment: "entertainment",
    health: "health",
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
      _cid: getArticleId({ url: link, title }),
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
          _cid: getArticleId(s),
          ocat: s.cat,
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
    (LS.get("pulse.cache." + cat, []) || [])
      .filter((s) => s && s.title && s.url && !BAD.test(s.url) && fresh(s))
      .map(stamp);
  const cacheSet = (cat, items) =>
    LS.set(
      "pulse.cache." + cat,
      items.slice(0, 30).map((s) => ({
        id: s.id,
        ocat: s.ocat,
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
    if (key && !state.degraded && state.items.some((s) => !s.seed))
      cacheSet(
        key,
        state.items.filter((s) => !s.seed),
      );
  }
  function onItems(my, b, total) {
    if (my !== state.req) return;
    UnseenPoolStore.add(b);
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
    if (state.items.length >= 3000) return;
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
    const add = spread(
      dedupe(prepFeed(b, rendered), state.items),
      state.items.slice(-2),
    );
    if (!add.length) return;
    const from = state.items.length;
    state.items = state.items.concat(add);
    add.forEach((x) => keyPair(x).forEach((k) => rendered.add(k)));
    uniq(state.items, from);
    addCards(from, state.items.length, false);
    trimDom();
    setActive(state.active, true);
    refreshStats();
    scheduleChips();
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
    if (state.view.type === "saved") return showSaved();
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
      pre = cacheGet(v.cat).filter(feedOK);
      if (!pre.length)
        pre = fallback(c.fb, label, c.id === "foryou").filter(feedOK);
    } else if (city)
      pre = cacheGet("local:" + v.q.toLowerCase()).filter(feedOK);
    if (isCat && pre.length < FEED_MIN)
      pre = pre.concat(poolFill(v.cat, FEED_MIN - pre.length, keySet(pre)));
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
        loadedCats.add(v.cat);
        scheduleChips();
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
      if (
        cacheGet(v.cat).length ||
        fallback(c.fb, label, c.id === "foryou").length
      ) {
        state.shown = true;
        render([]);
        return;
      }
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
      if (city) {
        cacheSet("local:" + q.toLowerCase(), total);
        loadedCats.add("local");
        scheduleChips();
      }
      return;
    }
    await degrade(my, v, indiaP);
  }

  /* ---------- rendering ---------- */
  const skeleton = () =>
    '<article class="news-card sk"><div class="bar b0" style="opacity:.2"></div><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div></article>';
  function showSkeleton() {
    stopTTS();
    seenReset();
    feed.innerHTML = skeleton();
    feed.scrollTop = 0;
    $("#prog").style.width = "0";
  }
  function showEmpty(e) {
    seenReset();
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
      `<article class="news-card" data-i="${i}"><div class="bg" style="--g:radial-gradient(at 18% 12%,hsl(${hue} 62% 36%) 0,transparent 55%),radial-gradient(at 85% 30%,hsl(${(hue + 70) % 360} 58% 30%) 0,transparent 52%),radial-gradient(at 35% 92%,hsl(${(hue + 300) % 360} 52% 24%) 0,transparent 55%),#090a0f"><img src="${esc(s.img)}" alt="" loading="${i < 3 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer"></div><div class="shade"></div>` +
      `<div class="meta"><span class="cpill">${esc(s.cl)}</span>${s.ts ? `<span class="time">${ago(s.ts)}</span>` : ""}</div>` +
      `<div class="body"><span class="pub">✔ ${esc(s.src)}</span><h2>${esc(s.title)}</h2>${body}${ul}</div></article>`
    );
  }
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
    seenObserve(nodes);
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
      seenReset();
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
    syncCards(nodes);
    placeSentinel();
  }
  function render(items) {
    let kept = prepFeed(items, null);
    if (kept.length < FEED_MIN && state.view.type === "cat")
      kept = kept.concat(
        poolFill(state.view.cat, FEED_MIN - kept.length, keySet(kept)),
      );
    state.items = spread(dedupe(kept));
    rebuildRendered();
    state.active = 0;
    items = state.items;
    uniq(state.items, 0);
    addCards(0, items.length, true);
    feed.scrollTop = 0;
    setActive(0, true);
    refreshStats();
    scheduleChips();
    maybeTopUp();
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
    onActive(i);
    if (advancing) {
      state.autoAdv = false;
      speakCurrent();
    }
    if (n && i >= n - 3) {
      loadMore();
      maybeTopUp();
    }
  }
  function syncRail() {
    const s = state.items[state.active],
      sv = !!s && isSaved(s);
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
  function toast(m, act, fn, ms) {
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
    tt = setTimeout(() => t.classList.remove("show"), act ? 4500 : ms || 1800);
  }
  const CTX = {
    foryou: "For You • Top Stories",
    india: "India • Top Stories",
    world: "World • Live Briefing",
    tech: "Tech • Live Briefing",
    business: "Business • Live Briefing",
    sports: "Sports • Live Briefing",
    science: "Science • Live Briefing",
    entertainment: "Entertainment • Live Briefing",
    health: "Health • Live Briefing",
  };
  function setPill(t) {
    const v = state.view,
      onLocal = v.type === "query" && v.kind === "city";
    let ctx;
    if (t && t.startsWith("📍")) ctx = t;
    else if (v.type === "query")
      ctx = onLocal ? "📍 " + v.q : "Search • " + v.q;
    else if (v.type === "saved") ctx = "Saved • Your Vault";
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
  const isSaved = (s) => {
    const k = cid(s);
    return state.savedList.some((x) => cid(x) === k);
  };
  function persistSaved() {
    SavedStore.save(state.savedList);
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
    syncCards();
    const m = $("#savedmodal");
    if (m && m.classList.contains("open")) renderSaved();
  }
  function addSaved(s) {
    if (isSaved(s)) return false;
    state.savedList.unshift({
      id: s.id,
      _cid: cid(s),
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
    AffinityStore.bump(s, 4);
    markSeen(s, "save");
    return true;
  }
  function save() {
    const s = cur();
    if (!s) return;
    if (isSaved(s)) {
      const k = cid(s);
      state.savedList = state.savedList.filter((x) => cid(x) !== k);
      persistSaved();
      toast("Removed from bookmarks");
      return;
    }
    addSaved(s);
    burst(cardOf(s));
    buzz(15);
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
      markSeen(s, "share");
      AffinityStore.bump(s, 5);
    } catch {}
  }
  /* ---------- retention engine: seen tracking, rings, caught-up, pulse, preload ---------- */
  const SEEN_VIS = 0.6,
    SEEN_MS = 1500,
    DWELL_MS = 4000;
  const buzz = (ms) => {
    try {
      navigator.vibrate?.(ms);
    } catch {}
  };
  const readBumped = new Set();
  const flushAll = () => {
    UnseenPoolStore.flush();
    SeenStore.flush();
    AffinityStore.flush();
  };
  const feedOK = (s) => !!s && !isSeen(s);
  const recency = (s) =>
    s.ts ? Math.exp(-Math.max(0, Date.now() - s.ts) / (36 * 36e5)) : 0;
  // Blended For You score: recency 65% + affinity 35%. Stable sort.
  const blend = (s) => recency(s) * 0.65 + AffinityStore.score(s) * 0.35;
  function rankForYou(list) {
    return list
      .map((s, i) => ({
        s,
        i,
        k: blend(s),
      }))
      .sort((a, b) => b.k - a.k || a.i - b.i)
      .map((x) => x.s);
  }
  // Every list headed for the feed passes through here: drop seen, rank For You.
  function prepFeed(list, ex) {
    const real = lockFilter(list, ex);
    const v = state.view;
    return v.type === "cat" && v.cat === "foryou" ? rankForYou(real) : real;
  }
  const itemOf = (el) => state.items[+el.dataset.i];
  const cardOf = (s) => {
    const i = state.items.indexOf(s);
    return i < 0 ? null : feed.querySelector(`.news-card[data-i="${i}"]`);
  };
  const unseenInView = () =>
    state.items.reduce((n, s) => n + (!isSeen(s) ? 1 : 0), 0);

  /* -- viewport tracking: >=60% visible for 1.5s => seen; 4s => affinity -- */
  let seenIO = null;
  const vis = new Set(),
    dwelled = new Set();
  // Per-card state. The seen timer (1.5s) and affinity timer (4s) each need CONTINUOUS >=60%
  // visibility; dropping below cancels whichever has not fired. A card is only unobserved
  // once BOTH have completed.
  const cstate = new Map(); // el -> { a, b, seen, aff }
  const cs = (el) => {
    let c = cstate.get(el);
    if (!c) {
      c = { a: 0, b: 0, seen: false, aff: false };
      cstate.set(el, c);
    }
    return c;
  };
  function settle(el) {
    const c = cstate.get(el);
    if (!c || !c.seen || !c.aff) return;
    clearTimeout(c.a);
    clearTimeout(c.b);
    if (seenIO) seenIO.unobserve(el);
    cstate.delete(el);
    vis.delete(el);
  }
  function disarm(el) {
    const c = cstate.get(el);
    if (!c) return;
    clearTimeout(c.a);
    clearTimeout(c.b);
    c.a = c.b = 0;
  }
  function arm(el) {
    disarm(el);
    if (document.hidden) return;
    const s = itemOf(el);
    if (!s) return;
    const c = cs(el),
      id = cid(s);
    if (isSeen(s)) c.seen = true;
    if (state.view.type === "saved" || dwelled.has(id)) c.aff = true;
    if (c.seen && c.aff) return settle(el);
    if (!c.seen)
      c.a = setTimeout(() => {
        c.a = 0;
        markSeen(s, "view");
        c.seen = true;
        settle(el);
      }, SEEN_MS);
    if (!c.aff)
      c.b = setTimeout(() => {
        c.b = 0;
        c.aff = true;
        dwelled.add(id);
        AffinityStore.bump(s, 1);
        settle(el);
      }, DWELL_MS);
  }
  function seenObserve(nodes) {
    if (!seenIO)
      seenIO = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting && e.intersectionRatio >= SEEN_VIS) {
              vis.add(e.target);
              arm(e.target);
            } else {
              vis.delete(e.target);
              disarm(e.target);
            }
          }),
        { root: feed, threshold: [SEEN_VIS] },
      );
    nodes.forEach((n) => {
      if (
        n.dataset.end ||
        n.classList.contains("empty") ||
        n.classList.contains("sk")
      )
        return;
      seenIO.observe(n);
    });
  }
  function seenReset() {
    if (seenIO) seenIO.disconnect();
    cstate.forEach((c) => {
      clearTimeout(c.a);
      clearTimeout(c.b);
    });
    cstate.clear();
    vis.clear();
  }
  function markSeen(s, why) {
    if (!s) return false;
    if (!seenAdd(s)) return false;
    UnseenPoolStore.evict(s);
    const c = cardOf(s);
    if (c) {
      c.classList.add("is-seen-now");
      const st = cstate.get(c);
      if (st) {
        st.seen = true;
        clearTimeout(st.a);
        st.a = 0;
        settle(c);
      }
    }
    if (StreakStore.bump().goalDone) celebrate();
    refreshStats();
    scheduleChips();
    if (unseenInView() < BATCH_MIN) maybeTopUp();
    return true;
  }
  function celebrate() {
    const st = StreakStore.status();
    toast(
      `⚡ Daily Pulse Complete! Streak locked at ${st.streak} day${st.streak === 1 ? "" : "s"}`,
      null,
      null,
      2800,
    );
    buzz(20);
    const p = $("#streak");
    p.classList.remove("pop");
    void p.offsetWidth;
    p.classList.add("pop");
  }

  /* -- header pills -- */
  function refreshStats() {
    const u = $("#unseen"),
      saved = state.view.type === "saved";
    const n = unseenInView();
    u.hidden = saved;
    u.textContent = `${n} unseen ${n === 1 ? "story" : "stories"}`;
    const st = StreakStore.status(),
      el = $("#streak");
    const pct = Math.round(Math.min(1, st.today / st.goal) * 100);
    el.hidden = false;
    el.innerHTML = `🔥 ${st.streak}d<i class="ring" style="--p:${pct}"></i><span>${Math.min(st.today, st.goal)}/${st.goal}</span>`;
    el.classList.toggle("risk", st.atRisk);
    el.title = st.locked
      ? `Streak locked for today • best ${st.best}d • goal ${st.today}/${st.goal}`
      : `Read a story today to ${st.streak ? "keep" : "start"} your streak`;
  }

  /* -- unseen category rings -- */
  const loadedCats = new Set();
  let counts = {};
  function catCounts() {
    const out = {},
      v = state.view;
    CATS.forEach((c) => {
      const pool = new Map();
      const add = (l) =>
        l.forEach((s) => {
          if (s && !pool.has(cid(s))) pool.set(cid(s), s);
        });
      let known = loadedCats.has(c.id);
      if (c.local) {
        if (!state.city) return;
        const cached = cacheGet("local:" + state.city.toLowerCase());
        add(cached);
        known = known || cached.length > 0;
        if (
          v.type === "query" &&
          v.kind === "city" &&
          String(v.q).toLowerCase() === state.city.toLowerCase()
        )
          add(state.items);
      } else {
        const cached = cacheGet(c.id);
        add(cached);
        known = known || cached.length > 0;
        add(fallback(c.fb, "", c.id === "foryou"));
        if (v.type === "cat" && v.cat === c.id) add(state.items);
      }
      let n = 0;
      pool.forEach((s) => {
        if (!isSeen(s)) n++;
      });
      out[c.id] = { n, known };
    });
    return out;
  }
  function renderChips() {
    counts = catCounts();
    document.querySelectorAll("#chips button").forEach((b) => {
      const id = b.dataset.id;
      if (id === "saved") return;
      const base = catOf(id).label,
        k = counts[id];
      b.classList.remove("has-unseen", "all-seen");
      if (k && k.n > 0) {
        b.classList.add("has-unseen");
        b.textContent = `${base} · ${k.n}`;
      } else if (k && k.known) {
        b.classList.add("all-seen");
        b.textContent = `${base} ✓`;
      } else b.textContent = base;
    });
    refreshEnd(false);
  }
  let chipT = 0;
  function scheduleChips() {
    clearTimeout(chipT);
    chipT = setTimeout(renderChips, 150);
  }
  function bestOther() {
    const v = state.view;
    const here =
      v.type === "cat"
        ? v.cat
        : v.type === "query" && v.kind === "city"
          ? "local"
          : "";
    let best = null;
    CATS.forEach((c) => {
      const k = counts[c.id];
      if (!k || c.id === here || k.n <= 0) return;
      if (!best || k.n > best.n)
        best = { id: c.id, n: k.n, label: c.label.replace(" 📍", "") };
    });
    return best;
  }

  /* -- "all caught up" / end-of-list card -- */
  function endCardHTML() {
    if (state.view.type === "saved")
      return `<div class="pulse-caught-up-card"><div class="pcu-ring">♥</div><h2>That’s your whole vault</h2><p>${state.savedList.length} saved ${state.savedList.length === 1 ? "story" : "stories"}.</p><button data-action="jump-cat" data-id="foryou">Back to For You</button></div>`;
    if (topBusy)
      return '<div class="pulse-caught-up-card pulse-caught-up"><div class="pcu-ring">…</div><h2>Finding fresh stories</h2><p>Pulling in more unseen news.</p></div>';
    const left = unseenInView(),
      st = StreakStore.status();
    const stats = `<div class="pcu-stats"><span><b>${Math.min(st.today, st.goal)}/${st.goal}</b> daily goal</span><span><b>🔥 ${st.streak}d</b> ${st.locked ? "streak locked" : "read 1 to keep it"}</span></div>`;
    const b = bestOther();
    return `<div class="pulse-caught-up-card pulse-caught-up"><div class="pcu-ring">✓</div><h2>You’re all caught up</h2><p>${left > 0 ? "You are at the end of the stream. New stories will appear as they arrive." : "No unseen stories in this view."}</p>${stats}${b ? `<button data-action="jump-cat" data-id="${esc(b.id)}">Jump to ${esc(b.label)} (${b.n} Fresh ${b.n === 1 ? "Story" : "Stories"})</button>` : ""}<button class="alt" data-action="live-wire">Check Live Wire</button></div>`;
  }
  function endCard() {
    if (state.view.type !== "saved" && unseenInView() === 0)
      counts = catCounts();
    return `<article class="news-card empty" data-end="1">${endCardHTML()}</article>`;
  }
  function refreshEnd(fresh) {
    const e = feed.querySelector("[data-end]");
    if (!e || !e.querySelector(".pulse-caught-up-card")) return;
    if (fresh && state.view.type !== "saved" && unseenInView() === 0)
      counts = catCounts();
    e.innerHTML = endCardHTML();
  }
  function onActive(i) {
    rehydrate(i);
    preloadNext();
    if (i === state.items.length) refreshEnd(true);
  }

  /* -- Check Live Wire: re-pull the freshest snapshot + live sources, bypassing caches -- */
  let nsT = 0;
  async function liveWire() {
    toast("Checking Live Wire…");
    Object.keys(dead).forEach((k) => delete dead[k]);
    NOSTORE = true;
    clearTimeout(nsT);
    nsT = setTimeout(() => {
      NOSTORE = false;
    }, 20000);
    try {
      const r = await fetch("./data/fallback-feed.json", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.stories) && j.stories.length)
          window.PULSE_FALLBACK = j;
        UnseenPoolStore.add(fallback("top", "", true));
      }
    } catch {}
    load();
  }

  /* -- Saved vault as a feed tab (saved items stay visible here even when seen) -- */
  function showSaved() {
    navTouched = true;
    state.req++;
    state.view = { type: "saved" };
    state.loading = false;
    state.shown = true;
    state.instant = false;
    state.degraded = false;
    state.moreQ = "";
    state.more = 0;
    stopTTS();
    markChip("saved");
    setPill("");
    setLive(false);
    seenReset();
    const list = state.savedList.map((x) =>
      Object.assign({}, x, { bullets: x.bullets || [], cl: x.cl || "Saved" }),
    );
    state.items = list;
    state.active = 0;
    if (!list.length) {
      feed.innerHTML =
        '<article class="news-card empty" data-end="1" data-i="0"><div class="pulse-caught-up-card"><div class="pcu-ring">♥</div><h2>Your vault is empty</h2><p>Double-tap any story to pulse it and keep it here.</p><button data-action="jump-cat" data-id="foryou">Back to For You</button></div></article>';
      feed.scrollTop = 0;
      $("#prog").style.width = "0";
      syncRail();
    } else {
      uniq(state.items, 0);
      addCards(0, list.length, true);
      feed.scrollTop = 0;
      setActive(0, true);
    }
    refreshStats();
    scheduleChips();
  }

  /* -- one place that mirrors saved state everywhere -- */
  function syncCards(nodes) {
    (nodes || feed.querySelectorAll(".news-card[data-i]")).forEach((c) => {
      const s = c.dataset.end ? null : itemOf(c);
      c.classList.toggle("is-saved", !!s && isSaved(s));
    });
  }

  /* -- double-tap to pulse (save) -- */
  const HEART =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset="1" stop-color="#ff7a45"/></linearGradient></defs><path fill="url(#pbg)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  function burst(card) {
    if (!card) return;
    const b = document.createElement("div");
    b.className = "pulse-burst";
    b.innerHTML = HEART;
    card.appendChild(b);
    const rm = () => b.remove();
    b.addEventListener("animationend", rm, { once: true });
    setTimeout(rm, 900);
  }
  function onDoubleTap(card) {
    const s = itemOf(card);
    if (!s) return;
    burst(card);
    buzz(15);
    if (!isSaved(s)) {
      addSaved(s);
      toast("Saved to bookmarks • ", "View →", openSaved);
    }
  }
  function bindDoubleTap() {
    let down = null,
      last = { t: 0, x: 0, y: 0 };
    feed.addEventListener(
      "pointerdown",
      (e) => {
        down = { t: e.timeStamp, x: e.clientX, y: e.clientY, moved: false };
      },
      { passive: true },
    );
    feed.addEventListener(
      "pointermove",
      (e) => {
        if (
          down &&
          !down.moved &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10
        )
          down.moved = true;
      },
      { passive: true },
    );
    feed.addEventListener("pointercancel", () => {
      down = null;
    });
    feed.addEventListener("pointerup", (e) => {
      const d = down;
      down = null;
      if (!d || e.button > 0) return;
      if (
        d.moved ||
        Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 ||
        e.timeStamp - d.t > 350
      ) {
        last.t = 0;
        return;
      }
      const tgt = e.target;
      if (
        !tgt ||
        !tgt.closest ||
        tgt.closest("a, button, input, [data-no-dbltap]")
      )
        return;
      const card = tgt.closest(".news-card");
      if (
        !card ||
        card.dataset.end ||
        card.classList.contains("empty") ||
        card.classList.contains("sk")
      )
        return;
      if (
        e.timeStamp - last.t < 320 &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40
      ) {
        last.t = 0;
        onDoubleTap(card);
      } else last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    });
  }

  /* -- zero-flash scrolling: warm the next 3 unseen cards' images -- */
  const preSeen = new Set(),
    preKeep = [];
  function preloadNext() {
    let n = 0;
    for (let i = state.active + 1; i < state.items.length && n < 3; i++) {
      const s = state.items[i];
      if (!s || isSeen(s)) continue;
      n++;
      if (!s.img || preSeen.has(s.img)) continue;
      preSeen.add(s.img);
      const im = new Image();
      im.referrerPolicy = "no-referrer";
      im.decoding = "async";
      im.src = s.img;
      preKeep.push(im);
      if (preKeep.length > 12) preKeep.shift();
    }
  }

  function bindEngagement() {
    bindDoubleTap();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cstate.forEach((c) => {
          clearTimeout(c.a);
          clearTimeout(c.b);
          c.a = c.b = 0;
        });
        flushAll();
      } else {
        vis.forEach(arm);
        refreshStats();
      }
    });
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("storage", (e) => {
      if (e.key !== "pulse_seen_v1") return;
      SeenStore.reload();
      refreshStats();
      scheduleChips();
    });
    $("#rd-ext").addEventListener("click", () => {
      const s = state.rd;
      if (!s) return;
      markSeen(s, "source");
    });
  }
  /* ---------- endless unseen stream: lock set, sentinel, harvester ---------- */
  const FEED_MIN = 20,
    BATCH_MIN = 10,
    BATCH_MAX = 15;
  // renderedStreamSet: URL id + headline signature of every card in the stream.
  const rendered = new Set();
  const keyPair = (s) => [cid(s), "t:" + tsig(s)];
  const keySet = (list) => {
    const x = new Set();
    list.forEach((s) => keyPair(s).forEach((k) => x.add(k)));
    return x;
  };
  function rebuildRendered() {
    rendered.clear();
    state.items.forEach((s) => keyPair(s).forEach((k) => rendered.add(k)));
  }
  // Dual lock: drop anything seen, already rendered, or duplicated inside the batch (by URL id OR headline sig).
  function lockFilter(list, ex) {
    const batch = new Set();
    return list.filter((s) => {
      if (!s || isSeen(s)) return false;
      const [a, b] = keyPair(s);
      if (batch.has(a) || batch.has(b) || (ex && (ex.has(a) || ex.has(b))))
        return false;
      batch.add(a);
      batch.add(b);
      return true;
    });
  }

  /* -- bottom sentinel (800px lookahead) -- */
  let sentIO = null;
  function placeSentinel() {
    const old = document.getElementById("stream-sentinel");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "stream-sentinel";
    el.setAttribute("aria-hidden", "true");
    feed.appendChild(el);
    if (!sentIO)
      sentIO = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) maybeTopUp(true);
        },
        { root: feed, rootMargin: "800px 0px 800px 0px" },
      );
    sentIO.disconnect();
    sentIO.observe(el);
  }

  /* -- DOM windowing: far-above cards become empty placeholders of the same height -- */
  function trimDom() {
    if (state.items.length < 60) return;
    const lim = state.active - 25;
    feed.querySelectorAll(".news-card[data-i]:not(.ghost)").forEach((c) => {
      if (c.dataset.end || +c.dataset.i >= lim) return;
      c.classList.add("ghost");
      c.classList.remove("active");
      c.innerHTML = "";
    });
  }
  function rehydrate(i) {
    for (
      let k = Math.max(0, i - 3);
      k <= i + 3 && k < state.items.length;
      k++
    ) {
      const c = feed.querySelector(`.news-card[data-i="${k}"]`);
      if (!c || !c.classList.contains("ghost")) continue;
      const t = document.createElement("div");
      t.innerHTML = cardHTML(state.items[k], k);
      c.innerHTML = t.firstElementChild.innerHTML;
      c.classList.remove("ghost");
      bindImgs([c]);
      syncCards([c]);
      if (isSeen(state.items[k])) c.classList.add("is-seen-now");
    }
  }

  /* -- harvester stages: each one only feeds the pool -- */
  const CAT_LABEL = {
    top: "For You",
    india: "India",
    world: "World",
    tech: "Tech",
    business: "Business",
    sports: "Sports",
    science: "Science",
    entertainment: "Entertainment",
    health: "Health",
  };
  const catLabel = (id) => CAT_LABEL[id] || "News";
  // Pool filler: strictly on-topic first, then anything else (so a feed is never starved or empty).
  function poolFill(cat, n, ex) {
    const out = UnseenPoolStore.pick(cat, n, ex, cat !== "foryou");
    if (out.length < n && cat !== "foryou") {
      const ex2 = new Set(ex);
      out.forEach((s) => keyPair(s).forEach((k) => ex2.add(k)));
      out.push(...UnseenPoolStore.pick(cat, n - out.length, ex2, false));
    }
    return out;
  }
  // Other categories (caches + snapshot); the pool ranks them by affinity.
  async function harvestLocal() {
    const all = [];
    CATS.forEach((c) => {
      if (!c.local) all.push(...cacheGet(c.id));
    });
    all.push(...fallback("top", "", true));
    UnseenPoolStore.add(all);
  }
  const SUB_CAT = {
    worldnews: "world",
    news: "world",
    technology: "tech",
    programming: "tech",
    science: "science",
    space: "science",
    business: "business",
    economics: "business",
    sports: "sports",
    entertainment: "entertainment",
    movies: "entertainment",
    music: "entertainment",
    health: "health",
    india: "india",
    indianews: "india",
  };
  const SUBTOPICS = {
    top: [
      "breaking news",
      "world news",
      "technology",
      "business economy",
      "science discovery",
      "india news",
    ],
    tech: [
      "artificial intelligence",
      "cybersecurity",
      "semiconductors",
      "startup funding",
      "smartphones",
      "robotics",
    ],
    business: [
      "stock market",
      "inflation economy",
      "banking",
      "trade tariffs",
      "energy prices",
      "startups",
    ],
    world: [
      "diplomacy summit",
      "climate policy",
      "middle east",
      "europe politics",
      "asia pacific",
      "united nations",
    ],
    science: [
      "space exploration",
      "medical research",
      "climate science",
      "astronomy",
      "biotechnology",
      "physics",
    ],
    sports: [
      "cricket",
      "football",
      "tennis",
      "olympics",
      "formula 1",
      "hockey",
    ],
    india: [
      "india politics",
      "india economy",
      "india infrastructure",
      "india education",
      "india health",
      "india technology",
    ],
    entertainment: [
      "movies box office",
      "streaming series",
      "music album",
      "celebrity news",
      "awards season",
      "bollywood",
    ],
    health: [
      "public health",
      "nutrition",
      "mental health",
      "medical breakthrough",
      "fitness",
      "disease outbreak",
    ],
  };
  const WINDOWS = ["1d", "3d", "7d", "14d"];
  const HARVEST = {
    top: {
      cat: "top",
      rd: "worldnews+technology+science+business",
      apis: ["hn", "sf", "dev"],
    },
    india: { cat: "india", rd: "india+indianews", apis: [] },
    world: { cat: "world", rd: "worldnews", apis: [] },
    business: { cat: "business", rd: "business+economics", apis: [] },
    sports: { cat: "sports", rd: "sports", apis: [] },
    entertainment: {
      cat: "entertainment",
      rd: "entertainment+movies+music",
      apis: [],
    },
    health: { cat: "health", rd: "health", apis: [] },
    science: { cat: "science", rd: "science+space", apis: ["sf"] },
    tech: { cat: "tech", rd: "technology+programming", apis: ["hn", "dev"] },
  };
  const harvestKey = () => {
    const v = state.view;
    return v.type === "cat" && HARVEST[v.cat] ? v.cat : "top";
  };
  // Reddit JSON: direct first; on any failure / non-200 retry through the CORS proxy.
  async function redditPage(sub, after) {
    const url = `https://www.reddit.com/r/${sub}/hot.json?limit=30&after=${encodeURIComponent(after)}`;
    try {
      return await tfetch(url, 4000, "json");
    } catch {}
    try {
      const j = await tfetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        5000,
        "json",
      );
      return JSON.parse(j.contents);
    } catch {
      return null;
    }
  }
  const trending = () => {
    const m = new Map();
    UnseenPoolStore.all()
      .slice(0, 60)
      .forEach((s) =>
        String(s.title)
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter((w) => w.length >= 6 && !STOP.has(w))
          .forEach((w) => m.set(w, (m.get(w) || 0) + 1)),
      );
    return [...m.entries()]
      .filter((e) => e[1] >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0]);
  };
  const buildGroups = (groups) =>
    Object.keys(groups).flatMap((cat) =>
      build(groups[cat], catLabel(cat), cat, ""),
    );
  // One source list per category, rotated each cycle. Every source advances its own cursor.
  function cycleSources(key) {
    const H = HARVEST[key] || HARVEST.top,
      subs = SUBTOPICS[key] || SUBTOPICS.top;
    const cur = (k, d) => +CursorStore.get(k + "_" + key) || d;
    const rssSrc = {
      async run() {
        const si = cur("sub", 0),
          wi = cur("win", 0) % WINDOWS.length;
        CursorStore.set("sub_" + key, si + 1);
        if ((si + 1) % subs.length === 0) this.widen();
        const tr = trending();
        const q =
          (si % 3 === 2 && tr.length
            ? tr[si % tr.length]
            : subs[si % subs.length]) +
          " when:" +
          WINDOWS[wi];
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
        return build(await rss(url), catLabel(H.cat), H.cat, "");
      },
      widen() {
        CursorStore.set("win_" + key, (cur("win", 0) + 1) % WINDOWS.length);
      },
    };
    const bingSrc = {
      async run() {
        const bi = cur("bing", 0);
        CursorStore.set("bing_" + key, bi + 1);
        return build(
          await rss(bingURL(subs[bi % subs.length])),
          catLabel(H.cat),
          H.cat,
          "",
        );
      },
    };
    const rdSrc = {
      async run() {
        const j = await redditPage(
          H.rd,
          String(CursorStore.get("rd_" + key) || ""),
        );
        if (!j || !j.data || !Array.isArray(j.data.children)) return [];
        CursorStore.set("rd_" + key, j.data.after || "");
        const groups = {};
        j.data.children.forEach((c) => {
          const x = c && c.data;
          if (!x || !x.title || x.over_18 || x.stickied) return;
          const pv =
            x.preview &&
            x.preview.images &&
            x.preview.images[0] &&
            x.preview.images[0].source &&
            x.preview.images[0].source.url;
          const cat =
            key === "top"
              ? SUB_CAT[String(x.subreddit).toLowerCase()] || "world"
              : H.cat;
          (groups[cat] = groups[cat] || []).push({
            title: x.title,
            link: x.is_self
              ? "https://www.reddit.com" + x.permalink
              : x.url_overridden_by_dest || x.url,
            pubDate: new Date((x.created_utc || 0) * 1000).toISOString(),
            source: "r/" + x.subreddit,
            desc: x.is_self ? x.selftext || "" : "",
            img: pv ? pv.replace(/&amp;/g, "&") : "",
          });
        });
        return buildGroups(groups);
      },
    };
    const API = {
      hn: async () => {
        const p = +CursorStore.get("hn") || 0;
        const j = await tfetch(
          `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30&page=${p}`,
          4000,
          "json",
        );
        if (!j || !Array.isArray(j.hits)) return [];
        CursorStore.set("hn", p >= 40 ? 0 : p + 1);
        return build(
          j.hits
            .filter((x) => x.title)
            .map((x) => {
              let dom = "";
              try {
                dom = x.url
                  ? new URL(x.url).hostname.replace(/^www\./, "")
                  : "";
              } catch {}
              return {
                title: x.title,
                link:
                  x.url || "https://news.ycombinator.com/item?id=" + x.objectID,
                pubDate: x.created_at,
                source: dom || "Hacker News",
                desc: x.story_text || "",
                img: "",
              };
            }),
          catLabel("tech"),
          "tech",
          "",
        );
      },
      sf: async () => {
        const o = +CursorStore.get("sf") || 0;
        const j = await tfetch(
          `https://api.spaceflightnewsapi.net/v4/articles/?limit=30&offset=${o}`,
          4000,
          "json",
        );
        if (!j || !Array.isArray(j.results)) return [];
        CursorStore.set("sf", o >= 600 ? 0 : o + 30);
        return build(
          j.results.map((a) => ({
            title: a.title,
            link: a.url,
            pubDate: a.published_at,
            source: a.news_site || "Spaceflight News",
            desc: a.summary || "",
            img: a.image_url || "",
          })),
          catLabel("science"),
          "science",
          "",
        );
      },
      dev: async () => {
        const p = +CursorStore.get("dev") || 1;
        const j = await tfetch(
          `https://dev.to/api/articles?per_page=30&page=${p}`,
          4000,
          "json",
        );
        if (!Array.isArray(j)) return [];
        CursorStore.set("dev", p >= 40 ? 1 : p + 1);
        return build(
          j.map((a) => ({
            title: a.title,
            link: a.url,
            pubDate: a.published_at,
            source: "DEV Community",
            desc: a.description || "",
            img: a.social_image || a.cover_image || "",
          })),
          catLabel("tech"),
          "tech",
          "",
        );
      },
    };
    const list = [
      rssSrc,
      rdSrc,
      ...H.apis.map((n) => ({ run: API[n] })),
      bingSrc,
      rssSrc,
    ];
    const rot = (+CursorStore.get("rot") || 0) % list.length;
    CursorStore.set("rot", rot + 1);
    return list.slice(rot).concat(list.slice(0, rot));
  }
  // Walks sources until ~a batch of FRESH (unseen + not-rendered + new-to-pool) stories is found;
  // a source that yields none advances its cursor/window and the next source runs in the same cycle.
  async function harvestCategory(my) {
    let fresh = 0;
    const srcs = cycleSources(harvestKey());
    for (let i = 0; i < srcs.length && i < 8; i++) {
      if (my !== state.req || fresh >= BATCH_MIN) break;
      let items = [];
      try {
        items = await srcs[i].run();
      } catch {}
      const added = UnseenPoolStore.add(lockFilter(items, rendered));
      if (!added && srcs[i].widen) srcs[i].widen();
      fresh += added;
    }
  }

  /* -- the engine: append 10-15 deduplicated unseen stories without touching scroll -- */
  let topBusy = false,
    topCool = 0;
  function maybeTopUp(force) {
    if (
      state.view.type === "saved" ||
      topBusy ||
      !state.shown ||
      Date.now() < topCool
    )
      return;
    if (!force && unseenInView() >= BATCH_MIN) return;
    topUp();
  }
  async function topUp() {
    if (topBusy) return;
    const v = state.view,
      my = state.req,
      start = state.items.length;
    const have = () => state.items.length - start;
    topBusy = true;
    refreshEnd(false);
    // Both locks (seen + already-mounted) are enforced in pick() and again in mergeNew().
    const fromPool = (relaxed) => {
      if (v.type !== "cat" || my !== state.req) return;
      const n = BATCH_MAX - have();
      const cand = UnseenPoolStore.pick(
        v.cat,
        n,
        rendered,
        !relaxed && v.cat !== "foryou",
      );
      if (!cand.length) return;
      const b = state.items.length;
      mergeNew(cand);
      const got = new Set(state.items.slice(b));
      cand.forEach((s) => {
        if (!got.has(s)) UnseenPoolStore.reject(s);
      });
    };
    try {
      fromPool();
      if (have() < BATCH_MIN && state.moreQ && state.more < 1 && !state.loading)
        await loadMore();
      if (v.type === "cat") {
        for (let r = 0; r < 3 && have() < BATCH_MIN && my === state.req; r++) {
          await harvestCategory(my);
          fromPool();
        }
        if (have() < BATCH_MIN && my === state.req) {
          await harvestLocal();
          fromPool(true);
        }
      }
    } catch {}
    topBusy = false;
    topCool = have() ? 0 : Date.now() + 15000;
    refreshEnd(true);
    if (my === state.req && have() > 0 && unseenInView() < BATCH_MIN)
      setTimeout(() => maybeTopUp(), 400);
  }

  // Background pre-population of the reservoir from the other categories.
  const warmed = new Set();
  async function warmPool() {
    for (const c of CATS) {
      if (UnseenPoolStore.size >= 140) break;
      if (c.local || warmed.has(c.id)) continue;
      if (state.view.type === "cat" && state.view.cat === c.id) continue;
      warmed.add(c.id);
      try {
        const [a, b] = await Promise.all([saurav(c), topicRss(c)]);
        UnseenPoolStore.add(build(a.concat(b), catLabel(c.id), c.fb, ""));
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }
    scheduleChips();
  }

  function readFull() {
    const s = cur();
    if (!s) return;
    state.rd = s;
    if (!readBumped.has(cid(s))) {
      readBumped.add(cid(s));
      AffinityStore.bump(s, 3);
    }
    markSeen(s, "read");
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
    if (id === "saved") return showSaved();
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
        renderSaved();
        return state.view.type === "saved" ? showSaved() : undefined;
      case "saved-clear":
        state.savedList = [];
        persistSaved();
        renderSaved();
        return state.view.type === "saved" ? showSaved() : undefined;
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
      case "jump-cat":
        return setCat(a.dataset.id);
      case "live-wire":
        return liveWire();
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
  UnseenPoolStore.add(fallback("top", "", true));
  refreshStats();
  scheduleChips();
  bindEngagement();
  setTimeout(warmPool, 4000);
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
    SeenStore,
    UnseenPoolStore,
    CursorStore,
    isSeen,
    tsig,
    titleSig,
    _topUp: () => topUp(),
    SavedStore,
    StreakStore,
    AffinityStore,
    getArticleId,
  };
})();

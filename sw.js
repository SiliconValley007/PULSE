const CACHE_NAME = "pulse-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./icon.svg",
  "./manifest.json",
  "./data/fallback-feed.js",
  "./data/fallback-feed.json",
];
// Freshly scraped snapshots: always try the network first, bypassing the HTTP cache.
const FEED_RE = /\/data\/fallback-feed\.(json|js)$/;
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((c) =>
        Promise.allSettled(
          ASSETS.map((a) => c.add(new Request(a, { cache: "reload" }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(
          ks.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
// Same-origin, network-first with cache fallback. Cross-origin APIs (RSS, JSON, images) are never touched.
self.addEventListener("fetch", (event) => {
  // External APIs / proxies are never intercepted or cached.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (
    url.pathname.startsWith("/.well-known/") ||
    url.pathname.startsWith("/api/")
  )
    return;
  const isFeed = FEED_RE.test(url.pathname);
  event.respondWith(
    (async () => {
      const c = await caches.open(CACHE_NAME);
      try {
        const r = await (isFeed
          ? fetch(url.href, { cache: "no-store" })
          : fetch(event.request));
        if (r && r.ok) c.put(event.request, r.clone()).catch(() => {});
        return r;
      } catch (err) {
        const m =
          (await c.match(event.request)) ||
          (isFeed
            ? await c.match(url.pathname, { ignoreSearch: true })
            : null) ||
          (event.request.mode === "navigate"
            ? await c.match("./index.html")
            : null);
        return (
          m || new Response("Offline", { status: 503, statusText: "Offline" })
        );
      }
    })(),
  );
});

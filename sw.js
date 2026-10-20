const V = "pulse-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./icon.svg",
  "./manifest.json",
  "./data/fallback-feed.js",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(V)
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
        Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});
// Same-origin, network-first. Cross-origin APIs (RSS, JSON, images) are never touched.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;
  if (
    url.pathname.startsWith("/.well-known/") ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    (async () => {
      const c = await caches.open(V);
      try {
        const r = await fetch(event.request);
        if (r && r.ok) c.put(event.request, r.clone()).catch(() => {});
        return r;
      } catch (err) {
        const m =
          (await c.match(event.request)) ||
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

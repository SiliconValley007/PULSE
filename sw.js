const V = "pulse-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./icon.svg",
  "./manifest.json",
];
const key = (u) => new Request(u.origin + u.pathname);
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
async function networkFirst(req, u) {
  const c = await caches.open(V);
  try {
    const r = await fetch(req, { cache: "no-store" });
    if (r && r.ok) c.put(key(u), r.clone());
    return r;
  } catch (e) {
    const m = await c.match(key(u));
    if (m) return m;
    throw e;
  }
}
async function cacheFirstUpdate(req, u) {
  const c = await caches.open(V),
    k = key(u),
    m = await c.match(k);
  const net = fetch(req)
    .then((r) => {
      if (r && r.ok && r.type === "basic") c.put(k, r.clone());
      return r;
    })
    .catch(() => null);
  if (m) {
    net.catch(() => {});
    return m;
  }
  const r = await net;
  return r || new Response("Offline", { status: 503, statusText: "Offline" });
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (/\/data\/fallback-feed\.(json|js)$/.test(u.pathname))
    e.respondWith(networkFirst(req, u));
  else if (
    /\/$|\/(index\.html|styles\.css|app\.js|icon\.svg)$/.test(u.pathname)
  )
    e.respondWith(cacheFirstUpdate(req, u));
});

// Zero-dependency local server: static files + /api/rss (server-side Google News fetch, no CORS).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 8000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function upstreamURL(sp) {
  const q = (sp.get("q") || "").trim(),
    topic = (sp.get("topic") || "").trim();
  if (topic) {
    if (!/^[A-Z]{3,20}$/.test(topic)) return null;
    return topic === "TOP"
      ? "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
      : `https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-IN&gl=IN&ceid=IN:en`;
  }
  if (!q || q.length > 200) return null;
  if (sp.get("src") === "bing")
    return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&setmkt=en-IN&format=rss`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=en-IN&gl=IN&ceid=IN:en`;
}
async function fetchRss(u) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(u, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; PulseDev/1.0)" },
      signal: c.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/rss") {
      const up = upstreamURL(url.searchParams);
      if (!up) {
        res.writeHead(400);
        return res.end("bad request");
      }
      try {
        const xml = await fetchRss(up);
        res.writeHead(200, {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "no-store",
        });
        return res.end(xml);
      } catch (e) {
        res.writeHead(502);
        return res.end("upstream failed");
      }
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    if (file.split(path.sep).includes(".git")) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("Not found");
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type":
        MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500);
    res.end("Server error");
  }
});

server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `Port ${PORT} is busy. Close the other server or run: set PORT=8010 && node scripts/dev-server.mjs`
      : e,
  );
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`PULSE dev server: http://localhost:${PORT}  (Ctrl+C to stop)`);
  // Refresh data/fallback-feed.* in the background; never blocks boot.
  const p = spawn(
    process.execPath,
    [path.join(ROOT, "scripts", "scrape.mjs")],
    { cwd: ROOT, stdio: "ignore" },
  );
  p.on("error", () => {});
  p.on("exit", (code) =>
    console.log(`Background scrape finished (exit ${code}).`),
  );
});

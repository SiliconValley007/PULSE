# PULSE — live vertical news

Reels-style news PWA for GitHub Pages. Native CSS scroll-snap, no build step.

**Live sources:** saurav.tech + ok.surf (native CORS), Bing/Google News RSS via AllOrigins `/get` (or `/api/rss` on the local dev server), Reddit and Hacker News (native CORS). City search cascades city → state → country (Nominatim) and never shows unrelated articles.

**Offline / cold start:** last live feed is cached per category; otherwise `data/fallback-feed.*` (seed cards flagged `isSeed`) renders instantly and is replaced as soon as live sources answer.

**Scraper:** `scripts/scrape.mjs` (Node 20, no deps) reads Hindu / Indian Express / NDTV / BBC / Al Jazeera / TechCrunch / Economic Times / Reuters, enriches thin items from `og:image` / `og:description`, and rewrites `data/fallback-feed.*`. The workflow runs on every push (except `data/**`), every 3 hours, and on demand.

Local: `node scripts/dev-server.mjs` (or start-local.bat / start-local.sh) serves http://localhost:8000 with a built-in server-side Google News endpoint (`/api/rss`); plain `python -m http.server 8000` also works using browser-only tiers.

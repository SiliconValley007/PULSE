# PULSE — vertical short-form news

PULSE is a Reels/Shorts-style news app: one story per screen, snap scrolling, a 3-bullet "Quick Pulse" summary, voice narration, a slide-up reader, hands-free Auto-Reel mode and live search for any topic or city. It is 100% static (no build step, no framework) and runs identically from `file:///`, `localhost` and GitHub Pages.

## Architecture

| File                                     | Role                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `index.html`                             | Semantic shell. Classic deferred scripts (no ES modules), so `file://` has no CORS errors.                       |
| `styles.css`                             | 9:16 stage, desktop ambient backdrop and quick-controls pill, glass modals, animations.                          |
| `app.js`                                 | Feed engine, scrapers, geolocation, search, auto-scroll timer, TTS, reader, one `[data-action]` click delegator. |
| `data/fallback-feed.js` / `.json`        | 30 curated briefings rendered instantly, then refreshed with live stories by the GitHub Action.                  |
| `scripts/scrape.mjs`                     | Node 20 scraper that rewrites both fallback files.                                                               |
| `.github/workflows/scrape.yml`           | Runs the scraper every 6 hours, on demand and when the scraper changes.                                          |
| `icon.svg`, `manifest.json`, `.nojekyll` | Favicon/PWA icon (no 404), installable manifest (injected only on http/https), Pages without Jekyll.             |

### Live sources (all fetched in parallel, failures are silent)

Google News RSS (country, hyper-local city, custom search) via the allorigins JSON wrapper; GDELT 2.0 DOC API; Algolia Hacker News; Spaceflight News; DEV.to; Wikimedia featured feed; saurav.tech NewsAPI mirror as a lower-ranked enrichment stream. Stories with too little real text are discarded, and every card shows three substantive bullets.

### Location

"Near Me" tries browser GPS (4 s timeout) with OpenStreetMap reverse geocoding, then falls back to IP lookup (ipwho.is / geojs). You can also pick any of 49 countries, go global, or type a city.

## Keyboard shortcuts

`↑`/`↓` or `J`/`K` navigate · `L` like · `M` voice anchor · `A` auto-scroll · `R` or `Space` reader · `S` save · `/` search · `Esc` close.
Mouse wheel, touch swipe and the on-screen ↑/↓ buttons also navigate. Double-click or double-tap spawns a heart at the tap position.

## Notes

The bundled briefings are evergreen explainers rather than breaking news; live headlines load on top of them. Third-party endpoints can rate-limit or change; the app falls back to cached stories and curated imagery automatically.

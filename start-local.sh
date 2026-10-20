#!/bin/sh
cd "$(dirname "$0")"
(sleep 1; (xdg-open http://localhost:8000/ || open http://localhost:8000/) >/dev/null 2>&1) &
if command -v node >/dev/null 2>&1; then node scripts/dev-server.mjs; else python3 -m http.server 8000; fi

@echo off
cd /d "%~dp0"
start "" http://localhost:8000/
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts\dev-server.mjs
) else (
  where py >nul 2>nul && (py -m http.server 8000) || (python -m http.server 8000)
)

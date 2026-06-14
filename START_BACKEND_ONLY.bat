@echo off
cd /d "%~dp0shashi-app-social-run\backend"
echo Starting shashi backend on http://127.0.0.1:5000
echo Keep this window open. Press Ctrl+C to stop.
echo.
echo If MongoDB still says IP whitelist, wait 2 minutes after saving Atlas Network Access.
echo If this window closes, run this file again and send a screenshot of the error.
echo.
node server.js
pause

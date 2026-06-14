@echo off
cd /d "%~dp0"
echo Starting shashi app...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 3; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "shashi App Server - DO NOT CLOSE" node start-social-app.js
) else (
  echo shashi backend is already running on port 5000.
)
timeout /t 6 /nobreak >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 5; Write-Host 'Backend:' $r.backend '| MongoDB:' $r.mongo -ForegroundColor Green } catch { Write-Host 'Backend did not start. Open the minimized shashi App Server window to see the error.' -ForegroundColor Red }"
start "" "http://127.0.0.1:5000/?resetBackend=1"
echo shashi is running. Keep the shashi App Server window open.
pause

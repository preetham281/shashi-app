@echo off
cd /d "%~dp0"
echo Restarting shashi backend on port 5000...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$connection=Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($connection){ Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }"
start "shashi App Server - DO NOT CLOSE" node start-social-app.js
timeout /t 6 /nobreak >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 5; Write-Host 'Backend:' $r.backend '| MongoDB:' $r.mongo -ForegroundColor Green } catch { Write-Host 'Backend did not start. Open the shashi App Server window to see the error.' -ForegroundColor Red }"
start "" "http://127.0.0.1:5000/?resetBackend=1"
echo shashi restart command finished.
pause

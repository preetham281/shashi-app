@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-mongodb-uri-for-render.ps1"
pause

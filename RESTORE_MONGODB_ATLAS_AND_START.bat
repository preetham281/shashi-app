@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore-mongodb-atlas-and-start.ps1"
pause

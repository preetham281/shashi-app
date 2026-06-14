@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload-to-github.ps1" -RepositoryUrl "https://github.com/preetham281/shashi-app.git"
pause

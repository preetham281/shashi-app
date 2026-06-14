$Tools = "C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env"
$Frontend = "C:\Users\91955\Documents\Codex\2026-05-29\shashi app\frontend"
$env:APPDATA = Join-Path $Tools ".appdata"
Set-Location $Frontend
& "$Tools\node_modules\.bin\netlify.cmd" deploy

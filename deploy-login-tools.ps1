$Root = "C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env"
Set-Location $Root

Write-Host "Choose one login command:"
Write-Host "1. Vercel frontend login:   .\node_modules\.bin\vercel.cmd login"
Write-Host "2. Netlify frontend login:  `$env:APPDATA='$Root\.appdata'; .\node_modules\.bin\netlify.cmd login"
Write-Host "3. Railway backend login:   .\node_modules\.bin\railway.cmd login"
Write-Host ""
Write-Host "Render does not need a downloaded CLI. Use https://render.com and connect GitHub."

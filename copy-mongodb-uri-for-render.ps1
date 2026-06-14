$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Could not find backend .env at $envPath"
}

$line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONGO_URI=' } | Select-Object -First 1
if (-not $line) {
  throw 'MONGO_URI was not found in backend .env'
}

$value = ($line -replace '^MONGO_URI=', '').Trim().Trim('"').Trim("'")

if ($value -notmatch '^mongodb(\+srv)?://') {
  throw 'MONGO_URI does not start with mongodb:// or mongodb+srv://'
}

if ($value -match '<db_password>|db_password|<|>') {
  throw 'MONGO_URI still contains a password placeholder.'
}

Set-Clipboard -Value $value

Write-Host ''
Write-Host 'MongoDB URI copied to clipboard for Render.'
Write-Host 'Paste it into Render Environment Variables as the VALUE for MONGO_URI.'
Write-Host 'Do not add quotes and do not paste MONGO_URI= before it.'

$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true)]
  [string]$MongoUri
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'
$uri = $MongoUri.Trim()

if ($uri -notmatch '^mongodb(\+srv)?://') {
  throw 'MongoUri must start with mongodb:// or mongodb+srv://'
}

if ($uri -match '<password>' -or $uri -match 'your_password' -or $uri -match '<db_password>') {
  throw 'Replace the password placeholder in the MongoDB Atlas URL before running this.'
}

$lines = Get-Content -LiteralPath $envPath
if ($lines -match '^MONGO_URI=') {
  $lines = $lines | ForEach-Object {
    if ($_ -match '^MONGO_URI=') { "MONGO_URI=$uri" } else { $_ }
  }
} else {
  $lines += "MONGO_URI=$uri"
}

Set-Content -LiteralPath $envPath -Value $lines

Write-Host 'MongoDB Atlas URL connected in backend .env'
Write-Host 'Restart the backend after this change.'

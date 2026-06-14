$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true)]
  [string]$BackendUrl,

  [Parameter(Mandatory=$true)]
  [string]$FrontendUrl
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'
$configPath = Join-Path $root 'shashi-app-social-run\frontend\config.js'

function Normalize-Url($value) {
  return $value.Trim().TrimEnd('/')
}

$backend = Normalize-Url $BackendUrl
$frontend = Normalize-Url $FrontendUrl

if ($backend -notmatch '^https?://') {
  throw 'BackendUrl must start with https:// or http://'
}

if ($frontend -notmatch '^https?://') {
  throw 'FrontendUrl must start with https:// or http://'
}

$envLines = Get-Content -LiteralPath $envPath
$clientOrigin = "CLIENT_ORIGIN=http://127.0.0.1:5000,http://localhost:5000,http://10.0.2.2:5000,$frontend"

if ($envLines -match '^CLIENT_ORIGIN=') {
  $envLines = $envLines | ForEach-Object {
    if ($_ -match '^CLIENT_ORIGIN=') { $clientOrigin } else { $_ }
  }
} else {
  $envLines += $clientOrigin
}

Set-Content -LiteralPath $envPath -Value $envLines
Set-Content -LiteralPath $configPath -Value "window.SHASHI_API_BASE_URL = '$backend';"

Write-Host 'Hosting URLs connected.'
Write-Host "Backend: $backend"
Write-Host "Frontend: $frontend"
Write-Host 'Restart the backend after this change.'

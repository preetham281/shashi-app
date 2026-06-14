$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root 'shashi-app-social-run\frontend'
$androidPublic = Join-Path $root 'android\app\src\main\assets\public'

New-Item -ItemType Directory -Force -Path $androidPublic | Out-Null

$files = @(
  'index.html',
  'config.js',
  'app.js',
  'style.css',
  'socket.io.min.js'
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $frontend $file) -Destination (Join-Path $androidPublic $file) -Force
}

$frontendSrc = Join-Path $frontend 'src'
$androidSrc = Join-Path $androidPublic 'src'
if(Test-Path $frontendSrc){
  New-Item -ItemType Directory -Force -Path $androidSrc | Out-Null
  Copy-Item -LiteralPath (Join-Path $frontendSrc 'firebase.js') -Destination (Join-Path $androidSrc 'firebase.js') -Force
}

Write-Host 'Android web assets synced from frontend.'

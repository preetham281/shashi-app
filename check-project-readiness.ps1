$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'shashi-app-social-run\backend'
$frontend = Join-Path $root 'shashi-app-social-run\frontend'
$android = Join-Path $root 'android'
$envFile = Join-Path $backend '.env'
$frontendConfig = Join-Path $frontend 'config.js'

function Read-EnvValue($name) {
  if (-not (Test-Path $envFile)) { return '' }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return ($line -replace "^$name=", '').Trim().Trim('"').Trim("'")
}

function Check($label, $ok, $help) {
  if ($ok) {
    Write-Host "[OK] $label"
  } else {
    Write-Host "[MISSING] $label - $help"
  }
}

Write-Host ''
Write-Host 'shashi project readiness'
Write-Host '------------------------'

Check 'Backend folder' (Test-Path $backend) 'backend folder not found'
Check 'Android folder' (Test-Path $android) 'android folder not found'
Check 'Strong JWT secret' ((Read-EnvValue 'JWT_SECRET').Length -ge 32) 'set JWT_SECRET in backend\.env'
Check 'Mongo URI' ((Read-EnvValue 'MONGO_URI').Length -gt 0) 'set MONGO_URI in backend\.env'
Check 'MongoDB Atlas URI' ((Read-EnvValue 'MONGO_URI') -match '^mongodb(\+srv)?://.+\.mongodb\.net') 'needed for public hosting; local MongoDB only works on your computer'
Check 'Cloudinary cloud name' ((Read-EnvValue 'CLOUDINARY_CLOUD_NAME').Length -gt 0) 'needed for real cloud storage'
Check 'Cloudinary upload preset' ((Read-EnvValue 'CLOUDINARY_UPLOAD_PRESET').Length -gt 0) 'needed for real cloud storage'
Check 'Firebase google-services.json' (Test-Path (Join-Path $android 'app\google-services.json')) 'needed for Android push'
Check 'Firebase Android example file' (Test-Path (Join-Path $android 'app\google-services.example.json')) 'template file should exist'
Check 'Firebase backend credentials' ((Read-EnvValue 'GOOGLE_APPLICATION_CREDENTIALS').Length -gt 0 -or (Read-EnvValue 'FIREBASE_CONFIG').Length -gt 0) 'needed for sending push'
Check 'Backend env example' (Test-Path (Join-Path $backend '.env.example')) 'safe production template should exist'
Check 'Frontend config has no fake URL' ((Test-Path $frontendConfig) -and -not ((Get-Content $frontendConfig -Raw) -match 'your-backend-url|example\.com')) 'remove placeholder backend URL from frontend\config.js'
Check 'Deployment status route' ((Test-Path (Join-Path $backend 'server.js')) -and ((Get-Content (Join-Path $backend 'server.js') -Raw) -match '/api/deployment/status')) 'backend should expose safe deployment readiness status'
Check 'Gradle installed' (Test-Path "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.14.3-all") 'run Android build once from normal Windows'

function Compare-ProjectFile($name, $source, $copy) {
  $sourcePath = Join-Path $root $source
  $copyPath = Join-Path $root $copy
  $ready = (Test-Path $sourcePath) -and (Test-Path $copyPath) -and ((Get-FileHash $sourcePath).Hash -eq (Get-FileHash $copyPath).Hash)
  Check $name $ready 'run npm.cmd run sync:web to update Android web assets'
}

Compare-ProjectFile 'Android index connected to frontend' 'shashi-app-social-run\frontend\index.html' 'android\app\src\main\assets\public\index.html'
Compare-ProjectFile 'Android config connected to frontend' 'shashi-app-social-run\frontend\config.js' 'android\app\src\main\assets\public\config.js'
Compare-ProjectFile 'Android app.js connected to frontend' 'shashi-app-social-run\frontend\app.js' 'android\app\src\main\assets\public\app.js'
Compare-ProjectFile 'Android style connected to frontend' 'shashi-app-social-run\frontend\style.css' 'android\app\src\main\assets\public\style.css'

Write-Host ''

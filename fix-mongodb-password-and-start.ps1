param(
  [string]$DatabaseUser,
  [string]$DatabasePassword
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'

function Encode-UriPart {
  param([string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Could not find backend .env at $envPath"
}

$line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONGO_URI=' } | Select-Object -First 1
if (-not $line) {
  throw 'MONGO_URI was not found in backend .env'
}

$currentUri = ($line -replace '^MONGO_URI=', '').Trim().Trim('"').Trim("'")
if ($currentUri -notmatch '^mongodb(\+srv)?://') {
  throw 'MONGO_URI is not a valid MongoDB URL yet.'
}

$withoutScheme = $currentUri -replace '^mongodb(\+srv)?://', ''
$lastAt = $withoutScheme.LastIndexOf('@')
if ($lastAt -lt 1) {
  throw 'MONGO_URI does not contain database user information.'
}

$currentUserInfo = $withoutScheme.Substring(0, $lastAt)
$currentRest = $withoutScheme.Substring($lastAt + 1)
$currentUser = ''
if ($currentUserInfo -match '^([^:]+):') {
  $currentUser = [System.Uri]::UnescapeDataString($Matches[1])
}

if (-not $DatabaseUser) {
  $shownUser = if ($currentUser) { $currentUser } else { 'your Atlas database user' }
  $inputUser = Read-Host "Database username [$shownUser]"
  $DatabaseUser = if ($inputUser) { $inputUser } else { $shownUser }
}

if (-not $DatabasePassword) {
  $securePassword = Read-Host 'Database password' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $DatabasePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not $DatabaseUser -or -not $DatabasePassword) {
  throw 'Database username and password are required.'
}

$restParts = $currentRest -split '\?', 2
$baseRest = $restParts[0]
$queryItems = @()
if ($restParts.Count -gt 1 -and $restParts[1]) {
  $queryItems = @($restParts[1].Split('&') | Where-Object { $_ })
}

function Add-QueryItem {
  param([string]$Item)
  if (-not $Item) { return }
  $key = ($Item -split '=', 2)[0]
  if (-not ($script:queryItems | Where-Object { $_ -match "^$([regex]::Escape($key))=" })) {
    $script:queryItems += $Item
  }
}

@('tls=true', 'authSource=admin', 'retryWrites=true', 'w=majority', 'appName=shashi') | ForEach-Object {
  Add-QueryItem $_
}

if ($baseRest -match 'o9zbzfo\.mongodb\.net' -and -not ($queryItems | Where-Object { $_ -match '^replicaSet=' })) {
  Add-QueryItem 'replicaSet=atlas-ad2rl6-shard-0'
}

$encodedUser = Encode-UriPart $DatabaseUser
$encodedPassword = Encode-UriPart $DatabasePassword
$fixedUri = "mongodb://$encodedUser`:$encodedPassword@$baseRest`?$($queryItems -join '&')"

$backupPath = "$envPath.backup-before-password-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $envPath -Destination $backupPath -Force

$lines = Get-Content -LiteralPath $envPath
$lines = $lines | ForEach-Object {
  if ($_ -match '^MONGO_URI=') {
    "MONGO_URI=`"$fixedUri`""
  } else {
    $_
  }
}
Set-Content -LiteralPath $envPath -Value $lines

$savedLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONGO_URI=' } | Select-Object -First 1
$savedUri = ($savedLine -replace '^MONGO_URI=', '').Trim().Trim('"').Trim("'")
if ($savedUri -match '<db_password>|db_password|<|>') {
  throw 'Password was not saved. The MongoDB URL still contains <db_password>. Run this file again and type only the real Database User password.'
}

Write-Host ''
Write-Host 'MongoDB password saved correctly.'
Write-Host "Backup created: $backupPath"
Write-Host ''
Write-Host 'Stopping old backend on port 5000...'

$netstat = cmd /c "netstat -ano | findstr :5000"
$pids = @()
foreach ($netLine in $netstat) {
  if ($netLine -match 'LISTENING\s+(\d+)$') {
    $pids += $Matches[1]
  }
}
$pids = @($pids | Select-Object -Unique)
foreach ($pid in $pids) {
  cmd /c "taskkill /PID $pid /F" | Out-Host
}

Write-Host ''
Write-Host 'Starting shashi backend...'
Set-Location -LiteralPath $root
cmd /c npm.cmd start

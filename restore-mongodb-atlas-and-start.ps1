param(
  [string]$MongoUri
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'

function Merge-QueryItems {
  param(
    [string]$Query,
    [string[]]$RequiredItems
  )

  $items = @()
  if ($Query) {
    $items = @($Query.TrimStart('?').Split('&') | Where-Object { $_ })
  }

  foreach ($required in $RequiredItems) {
    $key = ($required -split '=', 2)[0]
    $exists = $items | Where-Object { $_ -match "^$([regex]::Escape($key))=" }
    if (-not $exists) {
      $items += $required
    }
  }

  return ($items -join '&')
}

function Repair-MongoUri {
  param([string]$Uri)

  $clean = $Uri.Trim().Trim('"').Trim("'")
  if ($clean -notmatch '^mongodb(\+srv)?://') {
    throw 'That does not look like a MongoDB Atlas connection string.'
  }

  if ($clean -match '^mongodb\+srv://(?<userinfo>.+)@(?<host>[^/?]+)(?<path>/[^?]*)?(?<query>\?.*)?$') {
    $userInfo = $Matches.userinfo
    $hostName = $Matches.host
    $databasePath = $Matches.path
    $query = $Matches.query
    if (-not $databasePath -or $databasePath -eq '/') {
      $databasePath = '/shashiapp'
    }

    try {
      $srvRecords = Resolve-DnsName "_mongodb._tcp.$hostName" -Type SRV -ErrorAction Stop |
        Where-Object { $_.NameTarget -and $_.Port } |
        Sort-Object NameTarget

      $txtOptions = ''
      $txt = Resolve-DnsName $hostName -Type TXT -ErrorAction Stop |
        Where-Object { $_.Strings } |
        Select-Object -First 1
      if ($txt -and $txt.Strings) {
        $txtOptions = ($txt.Strings -join '')
      }

      if ($srvRecords) {
        $hosts = ($srvRecords | ForEach-Object { "$($_.NameTarget.TrimEnd('.')):$($_.Port)" }) -join ','
        $merged = Merge-QueryItems -Query $query -RequiredItems @('tls=true')
        if ($txtOptions) {
          $merged = Merge-QueryItems -Query $merged -RequiredItems $txtOptions.Split('&')
        }
        $merged = Merge-QueryItems -Query $merged -RequiredItems @('retryWrites=true', 'w=majority', 'appName=shashi')
        return "mongodb://$userInfo@$hosts$databasePath`?$merged"
      }
    } catch {
      $merged = Merge-QueryItems -Query $query -RequiredItems @('retryWrites=true', 'w=majority', 'appName=shashi')
      return "mongodb+srv://$userInfo@$hostName$databasePath`?$merged"
    }
  }

  if ($clean -match '^mongodb://(?<userinfo>.+)@(?<hosts>[^/]+)(?<path>/[^?]*)?(?<query>\?.*)?$') {
    $userInfo = $Matches.userinfo
    $hosts = $Matches.hosts
    $databasePath = $Matches.path
    $query = $Matches.query
    if (-not $databasePath -or $databasePath -eq '/') {
      $databasePath = '/shashiapp'
    }

    $required = @('tls=true', 'authSource=admin', 'retryWrites=true', 'w=majority', 'appName=shashi')
    if ($hosts -match 'o9zbzfo\.mongodb\.net' -and $query -notmatch 'replicaSet=') {
      $required += 'replicaSet=atlas-ad2rl6-shard-0'
    }

    $merged = Merge-QueryItems -Query $query -RequiredItems $required
    return "mongodb://$userInfo@$hosts$databasePath`?$merged"
  }

  throw 'The MongoDB connection string could not be repaired.'
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Could not find backend .env at $envPath"
}

if (-not $MongoUri) {
  try {
    $clipboardText = Get-Clipboard -Raw -ErrorAction Stop
    if ($clipboardText -match 'mongodb(\+srv)?://') {
      $MongoUri = $clipboardText.Trim()
      Write-Host 'MongoDB Atlas URL found in clipboard.'
    }
  } catch {
    $MongoUri = ''
  }
}

if (-not $MongoUri) {
  Write-Host ''
  Write-Host 'Paste your MongoDB Atlas connection string below.'
  Write-Host 'It starts with mongodb+srv:// or mongodb://'
  $MongoUri = Read-Host 'MongoDB Atlas URL'
}

$fixedUri = Repair-MongoUri -Uri $MongoUri

$backupPath = "$envPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $envPath -Destination $backupPath -Force

$lines = Get-Content -LiteralPath $envPath
$found = $false
$lines = $lines | ForEach-Object {
  if ($_ -match '^MONGO_URI=') {
    $found = $true
    "MONGO_URI=$fixedUri"
  } else {
    $_
  }
}
if (-not $found) {
  $lines += "MONGO_URI=$fixedUri"
}
Set-Content -LiteralPath $envPath -Value $lines

Write-Host ''
Write-Host 'MongoDB Atlas URL saved safely.'
Write-Host "Backup created: $backupPath"

Write-Host ''
Write-Host 'Stopping any old backend on port 5000...'
$netstat = cmd /c "netstat -ano | findstr :5000"
$pids = @()
foreach ($line in $netstat) {
  if ($line -match 'LISTENING\s+(\d+)$') {
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

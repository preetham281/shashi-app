param(
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'shashi-app-social-run\backend\.env'
$line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONGO_URI=' } | Select-Object -First 1
if(-not $line){
  throw 'MONGO_URI was not found in backend .env'
}

$mongoUri = ($line -replace '^MONGO_URI=', '').Trim()
if($mongoUri -notmatch '^mongodb\+srv://'){
  Write-Host 'MONGO_URI is already not using mongodb+srv. No change needed.'
  exit 0
}

$uri = [System.Uri]$mongoUri
$hostName = $uri.Host
$srvRecords = Resolve-DnsName "_mongodb._tcp.$hostName" -Type SRV -ErrorAction Stop |
  Where-Object { $_.NameTarget -and $_.Port } |
  Sort-Object NameTarget
$txt = Resolve-DnsName $hostName -Type TXT -ErrorAction Stop |
  Where-Object { $_.Strings } |
  Select-Object -First 1

if(-not $srvRecords){
  throw 'Could not find Atlas shard addresses.'
}

$txtOptions = ''
if($txt -and $txt.Strings){
  $txtOptions = ($txt.Strings -join '')
}

$userInfo = $uri.UserInfo
$database = $uri.AbsolutePath.Trim('/')
if(-not $database){ $database = 'shashiapp' }

$hosts = ($srvRecords | ForEach-Object { "$($_.NameTarget.TrimEnd('.')):$($_.Port)" }) -join ','
$queryParts = @('ssl=true')
if($txtOptions){
  $txtOptions.Split('&') | ForEach-Object {
    if($_ -and $queryParts -notcontains $_){ $queryParts += $_ }
  }
}
if($uri.Query){
  $uri.Query.TrimStart('?').Split('&') | ForEach-Object {
    if($_ -and $queryParts -notcontains $_){ $queryParts += $_ }
  }
}

$directUri = "mongodb://$userInfo@$hosts/$database?$($queryParts -join '&')"

if($WhatIfOnly){
  Write-Host 'Direct Atlas URI can be created. Not writing because WhatIfOnly was used.'
  exit 0
}

$lines = Get-Content -LiteralPath $envPath
$lines = $lines | ForEach-Object {
  if($_ -match '^MONGO_URI='){ "MONGO_URI=$directUri" } else { $_ }
}
Set-Content -LiteralPath $envPath -Value $lines

Write-Host 'MongoDB Atlas URI changed to direct shard connection.'
Write-Host "Atlas host: $hostName"
Write-Host "Shard count: $($srvRecords.Count)"
Write-Host 'Restart the backend after this change.'

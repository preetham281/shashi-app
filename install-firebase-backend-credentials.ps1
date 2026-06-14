param(
  [string]$PathToServiceAccountJson = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'shashi-app-social-run\backend'
$envPath = Join-Path $backend '.env'
$secretsDir = Join-Path $backend 'secrets'
$target = Join-Path $secretsDir 'firebase-service-account.json'

function Find-ServiceAccountJson {
  $searchRoots = @(
    (Join-Path $env:USERPROFILE 'Downloads'),
    (Join-Path $env:USERPROFILE 'Desktop')
  )

  foreach($searchRoot in $searchRoots){
    if(Test-Path $searchRoot){
      $files = Get-ChildItem -Path $searchRoot -Recurse -Include '*.json' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
      foreach($file in $files){
        try{
          $json = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
          if($json.type -eq 'service_account' -and $json.private_key -and $json.client_email){
            return $file.FullName
          }
        }catch{
        }
      }
    }
  }

  return ''
}

$source = $PathToServiceAccountJson.Trim()
if(-not $source){
  $source = Find-ServiceAccountJson
}

if(-not $source -or -not (Test-Path $source)){
  throw 'Firebase service account JSON was not found. Download it from Firebase Console > Project settings > Service accounts.'
}

$serviceAccount = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json
if($serviceAccount.type -ne 'service_account' -or -not $serviceAccount.private_key -or -not $serviceAccount.client_email){
  throw 'This JSON is not a Firebase backend service account file.'
}

New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

$lines = Get-Content -LiteralPath $envPath
$credentialsLine = "GOOGLE_APPLICATION_CREDENTIALS=$target"
if($lines -match '^GOOGLE_APPLICATION_CREDENTIALS='){
  $lines = $lines | ForEach-Object {
    if($_ -match '^GOOGLE_APPLICATION_CREDENTIALS='){ $credentialsLine } else { $_ }
  }
}else{
  $lines += $credentialsLine
}

if($lines -match '^FIREBASE_CONFIG='){
  $lines = $lines | ForEach-Object {
    if($_ -match '^FIREBASE_CONFIG='){ 'FIREBASE_CONFIG=' } else { $_ }
  }
}

Set-Content -LiteralPath $envPath -Value $lines

Write-Host 'Firebase backend credentials installed.'
Write-Host "Project ID: $($serviceAccount.project_id)"
Write-Host "Client email: $($serviceAccount.client_email)"
Write-Host 'Restart the backend after this change.'

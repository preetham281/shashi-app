param(
  [string]$PathToGoogleServicesJson = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'android\app\google-services.json'

function Find-GoogleServicesJson {
  $searchRoots = @(
    (Join-Path $env:USERPROFILE 'Downloads'),
    (Join-Path $env:USERPROFILE 'Desktop')
  )

  foreach($searchRoot in $searchRoots){
    if(Test-Path $searchRoot){
      $file = Get-ChildItem -Path $searchRoot -Recurse -Filter 'google-services.json' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
      if($file){ return $file.FullName }
    }
  }

  return ''
}

$source = $PathToGoogleServicesJson.Trim()
if(-not $source){
  $source = Find-GoogleServicesJson
}

if(-not $source -or -not (Test-Path $source)){
  throw 'google-services.json was not found. Download it from Firebase Console, then run this script again.'
}

$json = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json
$packageName = $json.client[0].client_info.android_client_info.package_name
if($packageName -ne 'com.shashi.app'){
  throw "This Firebase file is for package '$packageName'. shashi Android package must be 'com.shashi.app'."
}

Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "Firebase Android push file installed:"
Write-Host $target

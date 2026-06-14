$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$androidStudioJava = @(
  'C:\Program Files\Android\Android Studio\jbr',
  'C:\Program Files\Android\Android Studio1\jbr'
) | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1

if (-not $env:JAVA_HOME -and $androidStudioJava) {
  $env:JAVA_HOME = $androidStudioJava
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue) -and -not $env:JAVA_HOME) {
  Write-Host ''
  Write-Host 'Java is missing. Install Android Studio first, then run this file again.'
  Write-Host 'Android Studio includes the Java/Android tools needed to build the APK.'
  Write-Host ''
  exit 1
}

$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'

Write-Host 'Syncing latest PC design into Android...'
& (Join-Path $root 'sync-android-web.ps1')

$directGradle = Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3\bin\gradle.bat'
if (Test-Path $directGradle) {
  & $directGradle -p android assembleDebug
} else {
  .\android\gradlew.bat -p android assembleDebug
}

$apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  Write-Host ''
  Write-Host "APK created:"
  Write-Host $apk
}

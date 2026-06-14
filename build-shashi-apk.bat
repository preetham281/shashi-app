@echo off
setlocal

cd /d "%~dp0"

if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
) else if exist "C:\Program Files\Android\Android Studio1\jbr\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
)

if not defined JAVA_HOME (
  echo Java was not found. Open Android Studio once, let setup finish, then run this again.
  pause
  exit /b 1
)

set "PATH=%JAVA_HOME%\bin;%PATH%"
set "GRADLE_USER_HOME=%USERPROFILE%\.gradle"

echo Using Java:
java -version

if exist "%LOCALAPPDATA%\Android\Sdk" (
  echo sdk.dir=%LOCALAPPDATA:\=/%/Android/Sdk> android\local.properties
)

echo Syncing latest PC design into Android...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-android-web.ps1"
if errorlevel 1 (
  echo Android design sync failed.
  pause
  exit /b 1
)

echo Building native Android app...
if exist "%USERPROFILE%\.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3\bin\gradle.bat" (
  call "%USERPROFILE%\.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3\bin\gradle.bat" -p android assembleDebug
) else (
  call android\gradlew.bat -p android assembleDebug
)
if errorlevel 1 (
  echo APK build failed. If it says it cannot download Gradle, connect internet and run this file from normal Windows.
  echo If it says Android SDK missing, open Android Studio and finish the Setup Wizard.
  pause
  exit /b 1
)

echo.
echo APK created:
echo %CD%\android\app\build\outputs\apk\debug\app-debug.apk
pause

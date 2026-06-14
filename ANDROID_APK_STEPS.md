# SHASHI Android APK

The Android project is ready in the `android` folder.

## Backend URL

The APK cannot use `localhost` to reach your computer. Use one of these:

- Android emulator: `http://10.0.2.2:5000`
- Real phone on the same Wi-Fi: `http://YOUR_COMPUTER_IP:5000`
- After deployment: your public backend URL

Open SHASHI, tap the profile button, enter the backend URL, and tap **Save URL**.

## Build APK

From this folder:

```powershell
cd "C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env"
.\android\gradlew.bat -p android assembleDebug
```

The APK will be created here:

```text
C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env\android\app\build\outputs\apk\debug\app-debug.apk
```

## Before Testing On Phone

Start the backend first, keep MongoDB running, and make sure the phone is on the same Wi-Fi as the computer.

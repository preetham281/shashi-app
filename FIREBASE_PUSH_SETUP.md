# shashi Firebase Push Setup

Push notification code is already added. To activate real phone pushes:

1. Open Firebase Console.
2. Create/select project.
3. Add Android app with package name:

```text
com.shashi.app
```

4. Download `google-services.json`.
5. Put it here:

```text
C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env\android\app\google-services.json
```

There is also a template here:

```text
C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env\android\app\google-services.example.json
```

6. In Firebase Console, create a service account private key JSON.
7. Put its path in backend `.env`:

```text
GOOGLE_APPLICATION_CREDENTIALS=C:\full\path\firebase-service-account.json
```

8. Run backend and build/install Android app again.

The Android app registers its push token after login.

Backend push status can be checked here while the server is running:

```text
http://127.0.0.1:5000/api/notifications/push/status
```

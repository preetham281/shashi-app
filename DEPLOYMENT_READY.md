# shashi Deployment Ready Notes

The project now has deployment config files:

- Backend Render config: `shashi-app-social-run/backend/render.yaml`
- Backend Railway config: `shashi-app-social-run/backend/railway.json`
- Backend Procfile: `shashi-app-social-run/backend/Procfile`
- Frontend Netlify config: `shashi-app-social-run/frontend/netlify.toml`
- Frontend Vercel config: `shashi-app-social-run/frontend/vercel.json`
- Backend safe env template: `shashi-app-social-run/backend/.env.example`

## Readiness Status URL

When the backend is running, open:

```text
http://127.0.0.1:5000/api/deployment/status
```

On public hosting, open:

```text
https://your-backend-url/api/deployment/status
```

It shows what is ready and what is still missing without showing private keys.

## Backend Environment Variables

Set these in Render/Railway:

```text
NODE_ENV=production
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_long_random_secret
CLIENT_ORIGIN=https://your-frontend-url
```

Optional real storage/push:

```text
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
FIREBASE_CONFIG=optional_firebase_json
```

## Android App Backend URL

After backend deployment, open the native app settings and set:

```text
https://your-backend-url
```

## What Still Requires You

- Hosting account deployment click/login
- Firebase files
- Android build from normal Windows if Codex cannot download dependencies

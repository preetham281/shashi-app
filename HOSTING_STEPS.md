# shashi Hosting Steps

Run these commands from a normal Windows terminal, not inside the restricted Codex sandbox.

## 1. Backend hosting

Use Railway or Render for `shashi-app-social-run/backend`.

Backend needs these environment variables:

```env
NODE_ENV=production
MONGO_URI=your_mongodb_atlas_url
JWT_SECRET=your_long_secret
CLIENT_ORIGIN=https://your-frontend-url
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset
GOOGLE_APPLICATION_CREDENTIALS=
FIREBASE_CONFIG=
```

Important: public hosting cannot use local MongoDB `127.0.0.1`. Use MongoDB Atlas.

To connect your Atlas URL locally after you copy it from MongoDB Atlas:

```powershell
cd C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env
powershell -ExecutionPolicy Bypass -File .\connect-atlas.ps1 -MongoUri "mongodb+srv://username:password@cluster.mongodb.net/shashiapp?retryWrites=true&w=majority"
```

## 2. Frontend hosting

Use Netlify or Vercel for `shashi-app-social-run/frontend`.

After backend is hosted, connect the frontend to it:

```powershell
cd C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env
powershell -ExecutionPolicy Bypass -File .\connect-hosting.ps1 -BackendUrl "https://your-backend-url" -FrontendUrl "https://your-frontend-url"
```

Then deploy the frontend folder.

## 3. Local commands

Run the project locally:

```powershell
npm.cmd start
```

Sync web files into Android:

```powershell
npm.cmd run sync:web
```

Check project readiness:

```powershell
powershell -ExecutionPolicy Bypass -File .\check-project-readiness.ps1
```

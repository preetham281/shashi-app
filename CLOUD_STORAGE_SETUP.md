# Cloud Storage Setup

Cloud upload code is already added. It currently uses local fallback storage until keys are added.

## Recommended Provider: Cloudinary

Add these to:

```text
C:\Users\91955\Documents\Codex\2026-05-29\files-mentioned-by-the-user-env\shashi-app-social-run\backend\.env
```

```text
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

Use an unsigned upload preset for this app.

## Firebase Storage

Prepared in config, but not fully connected yet:

```text
FIREBASE_STORAGE_BUCKET=your_bucket
```

## AWS S3

Prepared in config, but not fully connected yet:

```text
AWS_REGION=your_region
AWS_S3_BUCKET=your_bucket
```

Cloudinary is the easiest next step.

function storageStatus(){
  const firebaseBucket = process.env.FIREBASE_STORAGE_BUCKET || '';
  const cloudinaryPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESENT || '';
  return {
    activeProvider: process.env.STORAGE_PROVIDER || 'local-data-url',
    cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && cloudinaryPreset),
    firebase: Boolean(firebaseBucket && firebaseBucket !== 'google-services.json'),
    s3: Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION),
    fallback: 'local-data-url'
  };
}

const MAX_UPLOAD_DATA_URL_LENGTH = Number(process.env.MAX_UPLOAD_DATA_URL_LENGTH || 12 * 1024 * 1024);

function cleanUploadString(value, maxLength){
  return String(value || '').trim().slice(0, maxLength);
}

function validateUploadPayload({ file, fileName, mediaType, folder }){
  const cleaned = {
    file: cleanUploadString(file, MAX_UPLOAD_DATA_URL_LENGTH + 1),
    fileName: cleanUploadString(fileName, 180).replace(/[\\/:*?"<>|]/g, '_'),
    mediaType: cleanUploadString(mediaType, 120),
    folder: cleanUploadString(folder, 80).replace(/[^a-zA-Z0-9/_-]/g, '')
  };

  if(!cleaned.file){
    const error = new Error('File is required');
    error.status = 400;
    throw error;
  }

  if(cleaned.file.length > MAX_UPLOAD_DATA_URL_LENGTH){
    const error = new Error('Upload is too large');
    error.status = 413;
    throw error;
  }

  if(!/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(cleaned.file) && !/^https:\/\//i.test(cleaned.file)){
    const error = new Error('Unsupported upload format');
    error.status = 400;
    throw error;
  }

  return cleaned;
}

async function uploadToCloudinary({ file, folder }){
  const cloudinaryPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESENT || '';
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', cloudinaryPreset);
  form.append('folder', folder || 'shashi');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: form
    }
  );

  const data = await response.json();
  if(!response.ok){
    throw new Error(data.error && data.error.message ? data.error.message : 'Cloudinary upload failed');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    provider: 'cloudinary'
  };
}

function localFallbackUpload({ file, fileName, mediaType, message }){
  return {
    url: file,
    provider: 'local-data-url',
    fileName,
    mediaType,
    message: message || 'Stored as a local data URL. Fix Cloudinary/Firebase/S3 settings for real cloud files.'
  };
}

exports.status = async (req, res) => {
  res.json(storageStatus());
};

exports.upload = async (req, res) => {
  try {
    const { file, fileName, mediaType, folder } = validateUploadPayload(req.body);

    const provider = (process.env.STORAGE_PROVIDER || 'local-data-url').toLowerCase();
    if(provider === 'cloudinary' && storageStatus().cloudinary){
      try{
        const result = await uploadToCloudinary({ file, folder });
        return res.json({
          ...result,
          fileName,
          mediaType
        });
      }catch(error){
        return res.json(localFallbackUpload({
          file,
          fileName,
          mediaType,
          message: 'Cloud upload failed, so the app used local fallback.'
        }));
      }
    }

    if(provider === 'firebase' && !storageStatus().firebase){
      return res.json(localFallbackUpload({
        file,
        fileName,
        mediaType,
        message: 'Firebase Storage is selected but not configured, so the app used local fallback.'
      }));
    }

    if(provider === 's3' && !storageStatus().s3){
      return res.json(localFallbackUpload({
        file,
        fileName,
        mediaType,
        message: 'AWS S3 is selected but not configured, so the app used local fallback.'
      }));
    }

    res.json(localFallbackUpload({ file, fileName, mediaType }));
  } catch(error) {
    res.status(error.status || 500).json({ message: error.message || 'Upload failed' });
  }
};

import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

/**
 * True when all three Cloudinary credentials are set (replace placeholders in `.env`).
 */
export function isCloudinaryConfigured() {
  return Boolean(cloudName && apiKey && apiSecret);
}

const DEFAULT_FOLDER = () => process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || 'sales-project';

/**
 * Build a delivery URL with automatic format/quality (CDN-optimized for images/video where supported).
 */
export function buildOptimizedDeliveryUrl(result) {
  if (!result?.public_id) return result?.secure_url ?? null;
  const resourceType = result.resource_type || 'image';
  try {
    if (resourceType === 'raw') return result.secure_url;
    return cloudinary.url(result.public_id, {
      secure: true,
      resource_type: resourceType,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });
  } catch {
    return result.secure_url;
  }
}

/**
 * Upload a single buffer to Cloudinary; returns secure URL + optimized delivery URL.
 * @param {Buffer} buffer
 * @param {{ originalname?: string, mimetype?: string }} fileMeta
 * @param {Record<string, unknown>} [extraOptions] — passed to upload_stream
 */
export function uploadBufferToCloudinary(buffer, fileMeta = {}, extraOptions = {}) {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(new Error('Cloudinary is not configured (missing CLOUDINARY_* env vars).'));
  }

  const folder = DEFAULT_FOLDER();
  const uploadOptions = {
    folder,
    resource_type: 'auto',
    use_filename: Boolean(fileMeta.originalname),
    unique_filename: true,
    overwrite: false,
    ...extraOptions,
  };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
      if (err) return reject(err);
      const optimizedUrl = buildOptimizedDeliveryUrl(result);
      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration,
        optimized_url: optimizedUrl,
      });
    });
    stream.end(buffer);
  });
}

export default cloudinary;

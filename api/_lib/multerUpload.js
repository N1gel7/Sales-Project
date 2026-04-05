import multer from 'multer';

/** Max size per file (bytes) — keep aligned with Cloudinary / server limits */
export const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_FILE_BYTES) || 25 * 1024 * 1024;

/** Max files in one multipart request */
export const MAX_FILES_PER_REQUEST = Number(process.env.UPLOAD_MAX_FILES) || 10;

/**
 * Accept only image, video, or audio MIME types (Sprint 2 — real media uploads).
 */
function mediaFileFilter(req, file, cb) {
  const mime = (file.mimetype || '').toLowerCase();
  const ok =
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/');
  if (ok) return cb(null, true);
  cb(new Error(`Unsupported type "${file.mimetype}". Allowed: image/*, video/*, audio/*.`));
}

/**
 * Multer configured for in-memory buffers (serverless-friendly) + media-only filter.
 */
export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter: mediaFileFilter,
});

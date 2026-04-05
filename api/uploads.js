import { uploadMedia, MAX_FILE_SIZE_BYTES } from './_lib/multerUpload.js';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from './_lib/cloudinary.js';
import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

function parseCoords(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

async function handler(req, res) {
  const { method } = req;

  try {
    if (method === 'GET') {
      const { data: uploads, error: uErr } = await supabase.from('uploads').select('*').order('created_at', { ascending: false });
      if (uErr) throw uErr;

      const { data: users, error: usErr } = await supabase.from('users').select('id, name, code');
      if (usErr) throw usErr;
      const userMap = {};
      users.forEach((u) => {
        userMap[u.id] = u;
      });

      const formatted = uploads.map((u) => {
        const c = u.coords;
        let coordsOut = c;
        if (typeof c === 'string') {
          try {
            coordsOut = JSON.parse(c);
          } catch {
            coordsOut = null;
          }
        }
        return {
          _id: u.id,
          filename: u.filename,
          type: u.type,
          note: u.note,
          fileUrl: u.file_url,
          transcription: u.transcription,
          translation: u.translation,
          coords: coordsOut,
          createdAt: u.created_at,
          user: u.user_id ? { name: userMap[u.user_id]?.name, code: userMap[u.user_id]?.code } : null,
        };
      });
      return res.status(200).json(formatted);
    }

    if (method === 'POST') {
      await runMiddleware(req, res, uploadMedia.array('files', 10));

      const files = req.files || [];
      const body = req.body || {};
      const note = body.note ?? null;
      const transcription = body.transcription ?? null;
      const translation = body.translation ?? null;
      const coords = parseCoords(body.coords);

      if (files.length === 0 && !body.fileUrl && !body.file_url) {
        return res.status(400).json({ error: 'No files provided. Send multipart/form-data with field "files" or JSON with fileUrl.' });
      }

      if (files.length > 0 && !isCloudinaryConfigured()) {
        return res.status(503).json({
          error: 'Media upload is unavailable',
          details: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env (see placeholders).',
        });
      }

      const cloudinaryResults =
        files.length > 0
          ? await Promise.all(
              files.map((file) =>
                uploadBufferToCloudinary(file.buffer, {
                  originalname: file.originalname,
                  mimetype: file.mimetype,
                })
              )
            )
          : [];

      const inserts =
        cloudinaryResults.length > 0
          ? cloudinaryResults.map((result, index) => {
              const file = files[index];
              const deliveryUrl = result.optimized_url || result.secure_url;
              return {
                filename: file.originalname,
                type: file.mimetype,
                note: note || null,
                file_url: deliveryUrl,
                transcription: transcription || null,
                translation: translation || null,
                coords: coords || null,
                user_id: req.user?.id || null,
              };
            })
          : [
              {
                filename: body.filename || 'Unknown',
                type: body.type || null,
                note: note || null,
                file_url: body.fileUrl || body.file_url || null,
                transcription: transcription || null,
                translation: translation || null,
                coords: coords || null,
                user_id: req.user?.id || null,
              },
            ];

      const { data: insertedRecords, error } = await supabase.from('uploads').insert(inserts).select('*');

      if (error) throw error;

      for (const u of insertedRecords) {
        await logActivity({
          type: 'upload_media',
          action: `File "${u.filename}" uploaded`,
          actorId: req.user?.id,
          refId: u.id,
          refType: 'upload',
        });
      }

      const formatted = insertedRecords.map((u, i) => {
        const c = u.coords;
        let coordsOut = c;
        if (typeof c === 'string') {
          try {
            coordsOut = JSON.parse(c);
          } catch {
            coordsOut = null;
          }
        }
        const row = {
          _id: u.id,
          filename: u.filename,
          type: u.type,
          note: u.note,
          fileUrl: u.file_url,
          transcription: u.transcription,
          translation: u.translation,
          coords: coordsOut,
          createdAt: u.created_at,
        };
        if (i < cloudinaryResults.length) {
          row.secureUrl = cloudinaryResults[i].secure_url;
          row.optimizedUrl = cloudinaryResults[i].optimized_url;
          row.publicId = cloudinaryResults[i].public_id;
        }
        return row;
      });

      return res.status(201).json(formatted);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Uploads error:', error);
    if (error.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File too large (max ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB per file)`,
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: error.message || 'Too many files or unexpected field name.' });
      }
    }
    if (error.message && String(error.message).includes('Unsupported type')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message && error.message.includes('Cloudinary is not configured')) {
      return res.status(503).json({ error: error.message });
    }
    if (error.http_code) {
      return res.status(502).json({ error: 'Cloudinary upload failed', details: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

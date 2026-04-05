import multer from 'multer';
import cloudinary from './_lib/cloudinary.js';
import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

// Vercel specific: disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List uploads with user info ──
    if (method === 'GET') {
      const { data: uploads, error: uErr } = await supabase.from('uploads').select('*').order('created_at', { ascending: false });
      if (uErr) throw uErr;

      const { data: users, error: usErr } = await supabase.from('users').select('id, name, code');
      if (usErr) throw usErr;
      const userMap = {};
      users.forEach(u => userMap[u.id] = u);

      const formatted = uploads.map(u => ({
        _id: u.id, filename: u.filename, type: u.type, note: u.note, fileUrl: u.file_url,
        transcription: u.transcription, translation: u.translation, 
        coords: typeof u.coords === 'string' ? JSON.parse(u.coords) : u.coords, 
        createdAt: u.created_at,
        user: u.user_id ? { name: userMap[u.user_id]?.name, code: userMap[u.user_id]?.code } : null
      }));
      return res.status(200).json(formatted);
    }

    // ── POST: Create upload records ──
    if (method === 'POST') {
      // Process multipart form data (array of up to 10 files)
      await runMiddleware(req, res, upload.array('files', 10));

      const files = req.files || [];
      const body = req.body || {};
      
      const { note, transcription, translation, coords } = body;

      if (files.length === 0 && !body.fileUrl && !body.file_url) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Stream uploaded files to Cloudinary
      const uploadPromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'sales-project' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const cloudinaryResults = await Promise.all(uploadPromises);

      // Create inserts array
      const inserts = cloudinaryResults.length > 0 ? cloudinaryResults.map((result, index) => ({
        filename: files[index].originalname,
        type: files[index].mimetype,
        note: note || null,
        file_url: result.secure_url,
        transcription: transcription || null,
        translation: translation || null,
        coords: coords || null,
        user_id: req.user?.id || null
      })) : [{
        filename: body.filename || 'Unknown',
        type: body.type || null,
        note: note || null,
        file_url: body.fileUrl || body.file_url || null,
        transcription: transcription || null,
        translation: translation || null,
        coords: coords || null,
        user_id: req.user?.id || null
      }];

      const { data: insertedRecords, error } = await supabase.from('uploads').insert(inserts).select('*');
      
      if (error) throw error;

      // Log activity for each uploaded file
      for (const u of insertedRecords) {
        await logActivity({
          type: 'upload_media', action: `File "${u.filename}" uploaded`,
          actorId: req.user?.id, refId: u.id, refType: 'upload'
        });
      }

      const formatted = insertedRecords.map(u => ({
        _id: u.id, filename: u.filename, type: u.type, note: u.note, fileUrl: u.file_url,
        transcription: u.transcription, translation: u.translation, 
        coords: typeof u.coords === 'string' ? JSON.parse(u.coords) : u.coords, 
        createdAt: u.created_at
      }));
      
      return res.status(201).json(formatted);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Uploads error:', error);
    if (error.message && error.message === 'File too large') {
      return res.status(413).json({ error: 'File size limit exceeded (25MB max)' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

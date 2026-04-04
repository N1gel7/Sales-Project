import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

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

    // ── POST: Create an upload record ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { filename, type, note, fileUrl, file_url, transcription, translation, coords } = body || {};

      if (!filename) return res.status(400).json({ error: 'Filename is required' });

      const { data: u, error } = await supabase.from('uploads').insert([{
        filename, type: type || null, note: note || null, file_url: fileUrl || file_url || null,
        transcription: transcription || null, translation: translation || null,
        coords: coords || null, user_id: req.user?.id || null
      }]).select('*').single();
      
      if (error) throw error;

      await logActivity({
        type: 'upload_media', action: `File "${filename}" uploaded`,
        actorId: req.user?.id, refId: u.id, refType: 'upload'
      });

      const formatted = {
        _id: u.id, filename: u.filename, type: u.type, note: u.note, fileUrl: u.file_url,
        transcription: u.transcription, translation: u.translation, 
        coords: typeof u.coords === 'string' ? JSON.parse(u.coords) : u.coords, 
        createdAt: u.created_at
      };
      return res.status(201).json(formatted);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Uploads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

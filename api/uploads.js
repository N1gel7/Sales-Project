import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List uploads with user info ──
    if (method === 'GET') {
      const result = await pool.query(
        `SELECT u.id AS "_id", u.filename, u.type, u.note, u.file_url AS "fileUrl",
                u.transcription, u.translation, u.coords,
                u.created_at AS "createdAt",
                json_build_object('code', usr.code, 'name', usr.name) AS "user"
         FROM uploads u
         LEFT JOIN users usr ON u.user_id = usr.id
         ORDER BY u.created_at DESC`
      );
      return res.status(200).json(result.rows);
    }

    // ── POST: Create an upload record ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { filename, type, note, fileUrl, file_url, transcription, translation, coords } = body || {};

      if (!filename) return res.status(400).json({ error: 'Filename is required' });

      const result = await pool.query(
        `INSERT INTO uploads (filename, type, note, file_url, transcription, translation, coords, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id AS "_id", filename, type, note, file_url AS "fileUrl",
                   transcription, translation, coords, created_at AS "createdAt"`,
        [filename, type || null, note || null, fileUrl || file_url || null,
         transcription || null, translation || null,
         coords ? JSON.stringify(coords) : null, req.user?.id || null]
      );

      await logActivity({
        type: 'upload_media', action: `File "${filename}" uploaded`,
        actorId: req.user?.id, refId: result.rows[0]._id, refType: 'upload'
      });

      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Uploads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

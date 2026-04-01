import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;
  const userId = req.user?.id;

  try {
    // ── GET: List notifications for the current user ──
    if (method === 'GET') {
      const { unread } = req.query || {};
      let query = `
        SELECT id AS "_id", type, title, message, ref_id AS "refId", ref_type AS "refType",
               read, created_at AS "createdAt"
        FROM notifications
        WHERE user_id = $1
      `;
      const params = [userId];

      if (unread === 'true') {
        query += ` AND read = false`;
      }
      query += ' ORDER BY created_at DESC LIMIT 50';

      const result = await pool.query(query, params);
      return res.status(200).json(result.rows);
    }

    // ── PATCH: Mark a notification as read ──
    if (method === 'PATCH') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const notifId = body?.notificationId || body?.id;
      if (!notifId) return res.status(400).json({ error: 'Notification ID required' });

      await pool.query(
        'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
        [notifId, userId]
      );
      return res.status(200).json({ message: 'Notification marked as read' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

/**
 * General purpose router — the frontend calls this with ?type= to reach
 * different resources. This delegates to real PostgreSQL queries.
 */
async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;
  const type = req.query?.type || '';
  const chatId = req.query?.chatId;

  try {
    // ── Notifications ──
    if (type === 'notifications') {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT id AS "_id", type, title, message, ref_id AS "refId", ref_type AS "refType",
                  read, created_at AS "createdAt"
           FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [req.user?.id]
        );
        return res.json(result.rows);
      }
      if (method === 'PATCH') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const notifId = body?.notificationId || body?.id;
        if (notifId) {
          await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
            [notifId, req.user?.id]);
        }
        return res.json({ message: 'Notification updated' });
      }
      return res.json([]);
    }

    // ── Uploads ──
    if (type === 'uploads') {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT u.id AS "_id", u.filename, u.type, u.note, u.file_url AS "fileUrl",
                  u.transcription, u.translation, u.coords, u.created_at AS "createdAt",
                  json_build_object('code', usr.code, 'name', usr.name) AS "user"
           FROM uploads u LEFT JOIN users usr ON u.user_id = usr.id
           ORDER BY u.created_at DESC`
        );
        return res.json(result.rows);
      }
      if (method === 'POST') {
        // For file uploads, the body may come as FormData (handled by multer upstream).
        // This is a fallback JSON handler.
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { filename, type: ftype, note, fileUrl, file_url, transcription, translation, coords } = body || {};
        const result = await pool.query(
          `INSERT INTO uploads (filename, type, note, file_url, transcription, translation, coords, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id AS "_id", filename, type, note, file_url AS "fileUrl", created_at AS "createdAt"`,
          [filename || 'untitled', ftype || null, note || null, fileUrl || file_url || null,
           transcription || null, translation || null, coords ? JSON.stringify(coords) : null, req.user?.id]
        );
        return res.status(201).json(result.rows[0]);
      }
      return res.json([]);
    }

    // ── Chats ──
    if (type === 'chats') {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT c.id AS "_id", c.name, c.type, c.participants, c.is_active AS "isActive",
                  c.last_message AS "lastMessage", c.created_at AS "createdAt",
                  json_build_object('_id', u.id, 'name', u.name, 'role', u.role) AS "createdBy"
           FROM chats c LEFT JOIN users u ON c.created_by = u.id
           ORDER BY c.updated_at DESC`
        );
        return res.json(result.rows);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { name, type: ctype, participants } = body || {};
        const result = await pool.query(
          `INSERT INTO chats (name, type, created_by, participants)
           VALUES ($1, $2, $3, $4)
           RETURNING id AS "_id", name, type, participants, is_active AS "isActive", created_at AS "createdAt"`,
          [name || 'New Chat', ctype || 'group', req.user?.id, participants ? JSON.stringify(participants) : '[]']
        );
        return res.status(201).json(result.rows[0]);
      }
      return res.json([]);
    }

    // ── Chat Messages ──
    if (type === 'chat-messages' && chatId) {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT m.id AS "_id", m.content, m.type, m.read_by AS "readBy", m.created_at AS "createdAt",
                  json_build_object('id', u.id, 'name', u.name, 'role', u.role) AS sender
           FROM messages m LEFT JOIN users u ON m.sender_id = u.id
           WHERE m.chat_id = $1 ORDER BY m.created_at ASC`,
          [chatId]
        );
        return res.json(result.rows);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { content, type: mtype } = body || {};
        const result = await pool.query(
          `INSERT INTO messages (chat_id, sender_id, content, type)
           VALUES ($1, $2, $3, $4)
           RETURNING id AS "_id", content, type, read_by AS "readBy", created_at AS "createdAt"`,
          [chatId, req.user?.id, content || '', mtype || 'text']
        );
        const msg = result.rows[0];
        msg.sender = { id: req.user?.id, name: req.user?.name, role: req.user?.role };
        // Update last_message on the chat
        await pool.query(
          `UPDATE chats SET last_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify({ content, sender: msg.sender, sentAt: msg.createdAt }), chatId]
        );
        return res.status(201).json(msg);
      }
      if (method === 'PUT') {
        // Mark messages as read
        await pool.query(
          `UPDATE messages SET read_by = read_by || $1::jsonb WHERE chat_id = $2`,
          [JSON.stringify([{ user: req.user?.id, readAt: new Date().toISOString() }]), chatId]
        );
        return res.json({ message: 'Messages marked as read' });
      }
      return res.json([]);
    }

    // ── Reports ──
    if (type === 'reports') {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT r.id AS "_id", r.title, r.description, r.type, r.attachments,
                  r.tags, r.status, r.visibility, r.comments, r.likes,
                  r.created_at AS "createdAt", r.updated_at AS "updatedAt",
                  json_build_object('id', u.id, 'name', u.name, 'role', u.role) AS author
           FROM reports r LEFT JOIN users u ON r.author_id = u.id
           ORDER BY r.created_at DESC`
        );
        return res.json(result.rows);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { title, description, type: rtype, attachments, tags, status, visibility } = body || {};
        const result = await pool.query(
          `INSERT INTO reports (title, description, type, author_id, attachments, tags, status, visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id AS "_id", title, description, type, attachments, tags, status, visibility,
                     comments, likes, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [title || 'Untitled', description || null, rtype || 'sales_report', req.user?.id,
           attachments ? JSON.stringify(attachments) : '[]', tags || '{}', status || 'draft', visibility || 'team']
        );
        const report = result.rows[0];
        report.author = { id: req.user?.id, name: req.user?.name, role: req.user?.role };
        return res.status(201).json(report);
      }
      return res.json([]);
    }

    // ── Logout All ──
    if (type === 'logout-all') {
      return res.json({ message: 'Logged out (JWT-based, remove token client-side)' });
    }

    // ── Seed (dev only) ──
    if (type === 'seed') {
      return res.json({ message: 'Use npm run db:init to seed the database' });
    }

    // ── Fallback ──
    return res.status(200).json({ status: 'ok', message: 'General handler' });

  } catch (error) {
    console.error('General handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

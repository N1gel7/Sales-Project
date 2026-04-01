import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method, url } = req;

  try {
    // Determine if this is a messages sub-request: /api/chats/[id]/messages or ?chatId=...
    const isMessages = url.includes('/messages') || req.query?.chatId;
    const chatId = req.query?.chatId || url.match(/\/chats\/(\d+)\/messages/)?.[1];

    // ─── MESSAGES ───
    if (isMessages && chatId) {
      if (method === 'GET') {
        const result = await pool.query(
          `SELECT m.id AS "_id", m.content, m.type, m.read_by AS "readBy",
                  m.created_at AS "createdAt",
                  json_build_object('id', u.id, 'name', u.name, 'role', u.role) AS sender
           FROM messages m
           LEFT JOIN users u ON m.sender_id = u.id
           WHERE m.chat_id = $1
           ORDER BY m.created_at ASC`,
          [chatId]
        );
        return res.json(result.rows);
      }

      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { content, type } = body || {};
        if (!content) return res.status(400).json({ error: 'Message content is required' });

        const result = await pool.query(
          `INSERT INTO messages (chat_id, sender_id, content, type)
           VALUES ($1, $2, $3, $4)
           RETURNING id AS "_id", content, type, read_by AS "readBy", created_at AS "createdAt"`,
          [chatId, req.user?.id || null, content, type || 'text']
        );

        const msg = result.rows[0];
        msg.sender = { id: req.user?.id, name: req.user?.name, role: req.user?.role };

        // Update chat last_message
        await pool.query(
          `UPDATE chats SET last_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify({ content, sender: msg.sender, sentAt: msg.createdAt }), chatId]
        );

        return res.status(201).json(msg);
      }

      // PUT: mark as read
      if (method === 'PUT') {
        await pool.query(
          `UPDATE messages SET read_by = read_by || $1::jsonb WHERE chat_id = $2`,
          [JSON.stringify([{ user: req.user?.id, readAt: new Date().toISOString() }]), chatId]
        );
        return res.json({ message: 'Messages marked as read' });
      }

      return res.status(405).end();
    }

    // ─── CHATS ───
    if (method === 'GET') {
      const result = await pool.query(
        `SELECT c.id AS "_id", c.name, c.type, c.participants, c.is_active AS "isActive",
                c.last_message AS "lastMessage", c.created_at AS "createdAt",
                json_build_object('_id', u.id, 'name', u.name, 'role', u.role) AS "createdBy"
         FROM chats c
         LEFT JOIN users u ON c.created_by = u.id
         ORDER BY c.updated_at DESC`
      );
      return res.json(result.rows);
    }

    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, type, participants } = body || {};
      if (!name) return res.status(400).json({ error: 'Chat name is required' });

      const result = await pool.query(
        `INSERT INTO chats (name, type, created_by, participants)
         VALUES ($1, $2, $3, $4)
         RETURNING id AS "_id", name, type, participants, is_active AS "isActive",
                   created_at AS "createdAt"`,
        [name, type || 'group', req.user?.id || null,
         participants ? JSON.stringify(participants) : '[]']
      );

      return res.status(201).json(result.rows[0]);
    }

    return res.status(200).json([]);
  } catch (error) {
    console.error('Chats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

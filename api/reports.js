import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List reports with author info ──
    if (method === 'GET') {
      const result = await pool.query(
        `SELECT r.id AS "_id", r.title, r.description, r.type, r.attachments,
                r.tags, r.status, r.visibility, r.comments, r.likes,
                r.created_at AS "createdAt", r.updated_at AS "updatedAt",
                json_build_object('id', u.id, 'name', u.name, 'role', u.role) AS author
         FROM reports r
         LEFT JOIN users u ON r.author_id = u.id
         ORDER BY r.created_at DESC`
      );
      return res.status(200).json(result.rows);
    }

    // ── POST: Create a report ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, description, type, attachments, tags, status, visibility } = body || {};

      if (!title) return res.status(400).json({ error: 'Report title is required' });

      const result = await pool.query(
        `INSERT INTO reports (title, description, type, author_id, attachments, tags, status, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id AS "_id", title, description, type, attachments, tags, status, visibility,
                   comments, likes, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [title, description || null, type || 'sales_report', req.user?.id || null,
         attachments ? JSON.stringify(attachments) : '[]',
         tags || '{}', status || 'draft', visibility || 'team']
      );

      const report = result.rows[0];
      report.author = { id: req.user?.id, name: req.user?.name, role: req.user?.role };

      return res.status(201).json(report);
    }

    return res.status(200).json([]);
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

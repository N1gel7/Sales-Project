import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List all categories ──
    if (method === 'GET') {
      const result = await pool.query(
        `SELECT id AS "_id", name, fields,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM categories
         ORDER BY name ASC`
      );
      return res.status(200).json(result.rows);
    }

    // ── POST: Create a new category ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, fields } = body || {};

      if (!name) return res.status(400).json({ error: 'Category name is required' });

      const result = await pool.query(
        `INSERT INTO categories (name, fields)
         VALUES ($1, $2)
         RETURNING id AS "_id", name, fields, created_at AS "createdAt"`,
        [name.trim(), fields ? JSON.stringify(fields) : '[]']
      );
      return res.status(201).json(result.rows[0]);
    }

    // ── PATCH/PUT: Update a category ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, name, fields } = body || {};
      const catId = _id || id;

      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      const result = await pool.query(
        `UPDATE categories SET name = COALESCE($1, name), fields = COALESCE($2, fields),
                updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id AS "_id", name, fields, updated_at AS "updatedAt"`,
        [name || null, fields ? JSON.stringify(fields) : null, catId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
      return res.status(200).json(result.rows[0]);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const catId = body?._id || body?.id || req.query?.id;
      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      await pool.query('DELETE FROM categories WHERE id = $1', [catId]);
      return res.status(200).json({ message: 'Category deleted' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Categories error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A category with that name already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

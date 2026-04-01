import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List products (with optional search/category filter) ──
    if (method === 'GET') {
      const { q, category } = req.query || {};
      let query = `
        SELECT p.id AS "_id", p.name, p.price, p.category, p.details, p.attributes,
               p.created_at AS "createdAt", p.updated_at AS "updatedAt"
        FROM products p
      `;
      const params = [];
      const conditions = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`p.name ILIKE $${params.length}`);
      }
      if (category) {
        params.push(category);
        conditions.push(`p.category = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY p.created_at DESC';

      const result = await pool.query(query, params);
      return res.status(200).json(result.rows);
    }

    // ── POST: Create product ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, price, category, details, attributes } = body || {};

      if (!name) return res.status(400).json({ error: 'Product name is required' });

      const result = await pool.query(
        `INSERT INTO products (name, price, category, details, attributes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id AS "_id", name, price, category, details, attributes,
                   created_at AS "createdAt"`,
        [name, price || 0, category || null, details || null, attributes ? JSON.stringify(attributes) : '{}']
      );
      return res.status(201).json(result.rows[0]);
    }

    // ── PATCH/PUT: Update product ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, name, price, category, details, attributes } = body || {};
      const prodId = _id || id || req.query?.id;

      if (!prodId) return res.status(400).json({ error: 'Product ID is required' });

      const result = await pool.query(
        `UPDATE products 
         SET name = COALESCE($1, name), price = COALESCE($2, price), 
             category = COALESCE($3, category), details = COALESCE($4, details),
             attributes = COALESCE($5, attributes), updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id AS "_id", name, price, category, details, attributes,
                   updated_at AS "updatedAt"`,
        [name || null, price ?? null, category || null, details || null,
         attributes ? JSON.stringify(attributes) : null, prodId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json(result.rows[0]);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const prodId = body?._id || body?.id || req.query?.id;
      if (!prodId) return res.status(400).json({ error: 'Product ID is required' });

      await pool.query('DELETE FROM products WHERE id = $1', [prodId]);
      return res.status(200).json({ message: 'Product deleted' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Products error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

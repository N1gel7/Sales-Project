import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List invoices ──
    if (method === 'GET') {
      const result = await pool.query(
        `SELECT id AS "_id", client, product, price, status, location, emailed,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM invoices
         ORDER BY created_at DESC`
      );
      return res.status(200).json(result.rows);
    }

    // ── POST: Create invoice ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { client, product, price, status, location } = body || {};

      if (!client || !product) {
        return res.status(400).json({ error: 'Client and product are required' });
      }

      const result = await pool.query(
        `INSERT INTO invoices (client, product, price, status, location, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id AS "_id", client, product, price, status, location, emailed,
                   created_at AS "createdAt"`,
        [client, product, price || 0, status || 'draft',
         location ? JSON.stringify(location) : null, req.user?.id || null]
      );

      await logActivity({
        type: 'invoice_created', action: `Invoice for "${client}" created`,
        actorId: req.user?.id, refId: result.rows[0]._id, refType: 'invoice',
        meta: { client, product, price }
      });

      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

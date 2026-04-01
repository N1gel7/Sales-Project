import { getDbPool } from '../_lib/db.js';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const pool = getDbPool();
  const { limit } = req.query || {};

  try {
    const result = await pool.query(
      `SELECT al.id AS "_id", al.type, al.action, al.ref_id, al.ref_type, al.meta,
              al.created_at AS "timestamp",
              u.name AS "user"
       FROM activity_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [Number(limit) || 20]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity' });
  }
}

export default withAuth(handler);

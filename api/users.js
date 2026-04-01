import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const pool = getDbPool();

  if (req.method !== 'GET') return res.status(405).end();

  try {
    const result = await pool.query(
      `SELECT id AS "_id", name, email, code, role, active, avatar_url AS "avatarUrl",
              created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Users GET error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export default withAuth(handler);

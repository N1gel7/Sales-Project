import { supabase } from '../_lib/db.js';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { limit } = req.query || {};
  const queryLimit = Number(limit) || 20;

  try {
    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(queryLimit);

    if (logsError) throw logsError;

    // Fetch users for mapping
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name');

    if (usersError) throw usersError;

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    const formattedLogs = logs.map(al => ({
      _id: al.id,
      type: al.type,
      action: al.action,
      ref_id: al.ref_id,
      ref_type: al.ref_type,
      meta: al.meta,
      timestamp: al.created_at,
      user: userMap[al.actor_id] || 'Unknown'
    }));

    return res.json(formattedLogs);
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity' });
  }
}

export default withAuth(handler);

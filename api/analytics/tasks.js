import { withAuth } from '../_lib/authMiddleware.js';
import { getTaskCompletionRatesSQL } from '../_lib/analytics.js';

/**
 * GET /api/analytics/tasks
 *
 * Returns task completion rates — overall system-wide + broken down per user.
 * Computed via SQL JOIN between tasks and users with GROUP BY assignee_id.
 * Falls back to in-process JS aggregation if RPC functions aren't deployed.
 *
 * Response shape:
 * {
 *   overall: { total, completed, rate }
 *   byUser: [{ userId, userName, userCode, total, completed, rate }]
 *   statusBreakdown: { pending, in_progress, completed, overdue, cancelled }
 * }
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { overall, byUser } = await getTaskCompletionRatesSQL();

    // Also fetch status breakdown for the detailed breakdown view
    const { supabase } = await import('../_lib/db.js');
    const { data: tasks, error: tErr } = await supabase
      .from('tasks')
      .select('status');

    if (tErr) throw tErr;

    const statusBreakdown = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    (tasks || []).forEach(t => {
      if (statusBreakdown[t.status] !== undefined) statusBreakdown[t.status]++;
    });

    return res.status(200).json({
      overall,
      byUser,
      statusBreakdown,
    });
  } catch (error) {
    console.error('[analytics/tasks] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch task analytics' });
  }
}

export default withAuth(handler);

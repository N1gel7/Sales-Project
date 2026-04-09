import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

/**
 * GET  /api/activity-logs          — paginated feed with actor info JOINed
 * GET  /api/activity-logs?type=X   — filter by event type
 * GET  /api/activity-logs?actor=id — filter by user
 * GET  /api/activity-logs?ref_id=X — filter by related entity
 * GET  /api/activity-logs?limit=N&page=N — pagination
 *
 * Only admins and managers can view the full log.
 * Sales reps can only view their own activity (actor==self is enforced below).
 */
async function handler(req, res) {
  const { method } = req;

  if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, actor, ref_id, ref_type, limit = 50, page = 1 } = req.query || {};
    const userRole = req.user?.role;
    const userId   = req.user?.id;

    const pageSize = Math.min(Number(limit) || 50, 200); // cap at 200
    const offset   = (Math.max(Number(page) || 1, 1) - 1) * pageSize;

    // ── Build Supabase query ──────────────────────────────────────────────────
    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Role guard: sales reps only see their own events
    if (userRole === 'sales') {
      query = query.eq('actor_id', userId);
    } else if (actor) {
      // Admins/managers can filter by actor
      query = query.eq('actor_id', actor);
    }

    if (type)     query = query.eq('type', type);
    if (ref_id)   query = query.eq('ref_id', ref_id);
    if (ref_type) query = query.eq('ref_type', ref_type);

    const { data: logs, error: logsErr, count } = await query;
    if (logsErr) throw logsErr;

    // ── JOIN in user names (one extra query, cached in map) ──────────────────
    const actorIds = [...new Set((logs || []).map(l => l.actor_id).filter(Boolean))];
    let userMap = {};

    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, role, code')
        .in('id', actorIds);

      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    // ── Format response ───────────────────────────────────────────────────────
    const formatted = (logs || []).map(log => {
      const actor = log.actor_id ? userMap[log.actor_id] : null;
      return {
        _id:       log.id,
        type:      log.type,
        action:    log.action,
        refId:     log.ref_id,
        refType:   log.ref_type,
        meta:      log.meta || {},
        timestamp: log.created_at,
        actor: actor
          ? { id: actor.id, name: actor.name, role: actor.role, code: actor.code }
          : { id: log.actor_id, name: 'Unknown', role: null, code: null },
      };
    });

    return res.status(200).json({
      logs: formatted,
      pagination: {
        total: count || 0,
        page: Number(page) || 1,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
      },
    });
  } catch (error) {
    console.error('[activity-logs] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
}

export default withAuth(handler);

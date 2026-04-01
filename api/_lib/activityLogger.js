import { getDbPool } from './db.js';

/**
 * Log an activity event to the activity_logs table.
 * Call this from mutation handlers to create an audit trail.
 *
 * @param {object} opts
 * @param {string} opts.type      - e.g. 'task_created', 'invoice_sent', 'upload_media'
 * @param {string} opts.action    - human-readable description
 * @param {number} opts.actorId   - user id of the person performing the action
 * @param {number} [opts.refId]   - related entity id
 * @param {string} [opts.refType] - related entity type ('task', 'invoice', etc.)
 * @param {object} [opts.meta]    - flexible metadata
 */
export async function logActivity({ type, action, actorId, refId, refType, meta }) {
  try {
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO activity_logs (type, action, actor_id, ref_id, ref_type, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [type, action || null, actorId || null, refId || null, refType || null, meta ? JSON.stringify(meta) : '{}']
    );
  } catch (err) {
    // Never let logging failures crash the main request
    console.error('Activity log error:', err.message);
  }
}

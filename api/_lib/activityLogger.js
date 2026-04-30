import { supabase } from './db.js';

// Activity Event Type Constants
export const ActivityTypes = {
  // Tasks
  TASK_CREATED:   'task_created',
  TASK_UPDATED:   'task_updated',
  TASK_DELETED:   'task_deleted',
  TASK_COMPLETED: 'task_completed',
  TASK_ASSIGNED:  'task_assigned',

  // Invoices
  INVOICE_CREATED: 'invoice_created',
  INVOICE_UPDATED: 'invoice_updated',
  INVOICE_EMAILED: 'invoice_emailed',

  // Auth / Users
  USER_LOGIN:         'user_login',
  USER_LOGOUT:        'user_logout',
  USER_CREATED:       'user_created',
  USER_UPDATED:       'user_updated',
  USER_DEACTIVATED:   'user_deactivated',
  PASSWORD_RESET:     'password_reset',

  // Uploads / Media
  UPLOAD_CREATED: 'upload_created',
  UPLOAD_DELETED: 'upload_deleted',

  // Reports
  REPORT_CREATED:   'report_created',
  REPORT_PUBLISHED: 'report_published',

  // Products / Categories
  PRODUCT_CREATED:  'product_created',
  PRODUCT_UPDATED:  'product_updated',
  PRODUCT_DELETED:  'product_deleted',
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',

  // System / General
  SYSTEM_EVENT: 'system_event',
};

// Logs a single activity event to the activity_logs table.
export async function logActivity({ type, action, actorId, refId, refType, meta } = {}) {
  try {
    if (!type) {
      console.warn('[activityLogger] logActivity called without a type — skipping.');
      return;
    }

    const { error } = await supabase.from('activity_logs').insert([{
      type,
      action:   action   || null,
      actor_id: actorId  || null,
      ref_id:   refId    ? String(refId) : null,
      ref_type: refType  || null,
      meta:     meta     || {},
    }]);

    if (error) throw error;
  } catch (err) {
    // Never let logging failures crash the main request
    console.error('[activityLogger] Failed to write activity log:', err.message);
  }
}

// Batch-logs multiple events in a single insert.
export async function logActivities(events = []) {
  if (!events.length) return;

  try {
    const rows = events
      .filter(e => e && e.type) // skip malformed entries
      .map(({ type, action, actorId, refId, refType, meta }) => ({
        type,
        action:   action   || null,
        actor_id: actorId  || null,
        ref_id:   refId    ? String(refId) : null,
        ref_type: refType  || null,
        meta:     meta     || {},
      }));

    if (!rows.length) return;

    const { error } = await supabase.from('activity_logs').insert(rows);
    if (error) throw error;
  } catch (err) {
    console.error('[activityLogger] Failed to batch-write activity logs:', err.message);
  }
}

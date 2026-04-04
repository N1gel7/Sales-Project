import { supabase } from './db.js';

export async function logActivity({ type, action, actorId, refId, refType, meta }) {
  try {
    const { error } = await supabase.from('activity_logs').insert([{
      type, 
      action: action || null, 
      actor_id: actorId || null, 
      ref_id: refId ? String(refId) : null, 
      ref_type: refType || null, 
      meta: meta || {}
    }]);
    if (error) throw error;
  } catch (err) {
    // Never let logging failures crash the main request
    console.error('Activity log error:', err.message);
  }
}

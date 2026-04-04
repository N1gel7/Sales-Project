import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method } = req;
  const userId = req.user?.id;

  try {
    // ── GET: List notifications for the current user ──
    if (method === 'GET') {
      const { unread } = req.query || {};
      
      let query = supabase.from('notifications').select('*').eq('user_id', userId);
      if (unread === 'true') {
        query = query.eq('read', false);
      }
      query = query.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map(n => ({
        _id: n.id, type: n.type, title: n.title, message: n.message,
        refId: n.ref_id, refType: n.ref_type, read: n.read, createdAt: n.created_at
      }));
      return res.status(200).json(formatted);
    }

    // ── PATCH: Mark a notification as read ──
    if (method === 'PATCH') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const notifId = body?.notificationId || body?.id;
      if (!notifId) return res.status(400).json({ error: 'Notification ID required' });

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId)
        .eq('user_id', userId);
        
      if (error) throw error;
      return res.status(200).json({ message: 'Notification marked as read' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

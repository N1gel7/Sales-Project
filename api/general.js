import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

function safeParseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

// General purpose dynamic router.
async function handler(req, res) {
  const { method } = req;
  const type = req.query?.type || '';
  const chatId = req.query?.chatId;

  try {
    // Notifications
    if (type === 'notifications') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('notifications')
          .select('*').eq('user_id', req.user?.id).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        const formatted = data.map(n => ({
          _id: n.id, type: n.type, title: n.title, message: n.message, refId: n.ref_id, refType: n.ref_type,
          read: n.read, createdAt: n.created_at
        }));
        return res.json(formatted);
      }
      if (method === 'PATCH') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const notifId = body?.notificationId || body?.id;
        if (notifId) {
          await supabase.from('notifications').update({ read: true }).eq('id', notifId).eq('user_id', req.user?.id);
        }
        return res.json({ message: 'Notification updated' });
      }
      return res.json([]);
    }

    // Uploads
    if (type === 'uploads') {
      if (method === 'GET') {
        let query = supabase.from('uploads').select('*').order('created_at', { ascending: false });
        if (req.user?.role === 'sales') {
          query = query.eq('user_id', req.user.id);
        }
        const { data: uploads, error: uErr } = await query;
        if (uErr) throw uErr;
        const { data: users } = await supabase.from('users').select('id, name, code');
        const userMap = {};
        (users||[]).forEach(u => userMap[u.id] = u);

        const formatted = uploads.map(u => ({
          _id: u.id, filename: u.filename, type: u.type, note: u.note, fileUrl: u.file_url,
          transcription: u.transcription, translation: u.translation, coords: typeof u.coords === 'string' ? JSON.parse(u.coords) : u.coords, 
          createdAt: u.created_at, user: u.user_id ? { name: userMap[u.user_id]?.name, code: userMap[u.user_id]?.code } : null
        }));
        return res.json(formatted);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { filename, type: ftype, note, fileUrl, file_url, transcription, translation, coords } = body || {};
        
        const { data: u, error } = await supabase.from('uploads').insert([{
          filename: filename || 'untitled', type: ftype || null, note: note || null, file_url: fileUrl || file_url || null,
          transcription: transcription || null, translation: translation || null, coords: coords || null, user_id: req.user?.id
        }]).select('*').single();
        if (error) throw error;
        
        return res.status(201).json({
          _id: u.id, filename: u.filename, type: u.type, note: u.note, fileUrl: u.file_url, createdAt: u.created_at
        });
      }
      return res.json([]);
    }


    // Reports
    if (type === 'reports') {
      if (method === 'GET') {
        const reportType = req.query?.reportType || req.query?.typeFilter || null;
        const status = req.query?.status || null;

        let reportsQuery = supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (req.user?.role === 'sales') {
          reportsQuery = reportsQuery.eq('author_id', req.user.id);
        }
        if (reportType && reportType !== 'all') reportsQuery = reportsQuery.eq('type', reportType);
        if (status && status !== 'all') reportsQuery = reportsQuery.eq('status', status);

        const { data: reports, error: rErr } = await reportsQuery;
        if (rErr) throw rErr;
        const { data: users } = await supabase.from('users').select('id, name, role');
        const userMap = {};
        (users||[]).forEach(u => userMap[u.id] = u);

        const formatted = (reports || []).map(r => ({
          _id: r.id, title: r.title, description: r.description, type: r.type,
          attachments: safeParseJson(r.attachments, []),
          tags: safeParseJson(r.tags, []),
          status: r.status,
          visibility: r.visibility,
          comments: safeParseJson(r.comments, []),
          likes: safeParseJson(r.likes, []),
          createdAt: r.created_at, updatedAt: r.updated_at,
          author: r.author_id ? { id: r.author_id, name: userMap[r.author_id]?.name, role: userMap[r.author_id]?.role } : null
        }));
        return res.json(formatted);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { title, description, type: rtype, attachments, tags, status, visibility } = body || {};
        
        const { data: r, error } = await supabase.from('reports').insert([{
          title: title || 'Untitled', description: description || null, type: rtype || 'sales_report', author_id: req.user?.id,
          attachments: attachments ? JSON.stringify(attachments) : '[]', tags: tags || '{}', status: status || 'draft', visibility: visibility || 'team'
        }]).select('*').single();
        if (error) throw error;
        
        return res.status(201).json({
          _id: r.id, title: r.title, description: r.description, type: r.type,
          attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
          tags: r.tags, status: r.status, visibility: r.visibility, comments: r.comments, likes: r.likes,
          createdAt: r.created_at, updatedAt: r.updated_at,
          author: { id: req.user?.id, name: req.user?.name, role: req.user?.role }
        });
      }
      return res.json([]);
    }

    // Seed
    if (type === 'seed') {
      return res.json({ message: 'Use npm run db:init to seed the database' });
    }

    // Fallback
    return res.status(200).json({ status: 'ok', message: 'General handler' });

  } catch (error) {
    console.error('General handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

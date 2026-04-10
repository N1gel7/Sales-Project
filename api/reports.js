import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List reports with author info ──
    if (method === 'GET') {
      const { data: reports, error: rErr } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (rErr) throw rErr;

      const { data: users, error: uErr } = await supabase.from('users').select('id, name, role');
      if (uErr) throw uErr;

      const userMap = {};
      users.forEach(u => userMap[u.id] = { id: u.id, name: u.name, role: u.role });

      const formatted = reports.map(r => ({
        _id: r.id, title: r.title, description: r.description, type: r.type,
        attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
        tags: r.tags, status: r.status, visibility: r.visibility, comments: r.comments, likes: r.likes,
        createdAt: r.created_at, updatedAt: r.updated_at,
        author: r.author_id ? userMap[r.author_id] || null : null
      }));
      return res.status(200).json(formatted);
    }

    // ── POST: Create a report ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, description, type, attachments, tags, status, visibility } = body || {};

      if (!title) return res.status(400).json({ error: 'Report title is required' });

      const { data: report, error: rErr } = await supabase
        .from('reports')
        .insert([{
          title, description: description || null, type: type || 'sales_report',
          author_id: req.user?.id || null, attachments: attachments ? JSON.stringify(attachments) : '[]',
          tags: tags || '{}', status: status || 'draft', visibility: visibility || 'team'
        }])
        .select('*')
        .single();
      
      if (rErr) throw rErr;

      const formatted = {
        _id: report.id, title: report.title, description: report.description, type: report.type,
        attachments: typeof report.attachments === 'string' ? JSON.parse(report.attachments) : report.attachments,
        tags: report.tags, status: report.status, visibility: report.visibility, comments: report.comments, likes: report.likes,
        createdAt: report.created_at, updatedAt: report.updated_at,
        author: { id: req.user?.id, name: req.user?.name, role: req.user?.role }
      };

      return res.status(201).json(formatted);
    }

    // ── PATCH: Toggle reaction (like) ──
    if (method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { reportId } = body || {};
      if (!reportId) return res.status(400).json({ error: 'reportId is required' });

      const { data: report, error: getErr } = await supabase
        .from('reports')
        .select('id, likes')
        .eq('id', reportId)
        .single();
      if (getErr || !report) return res.status(404).json({ error: 'Report not found' });

      const currentLikes = Array.isArray(report.likes) ? report.likes : [];
      const alreadyLiked = currentLikes.some((entry) => entry?.user === req.user?.id);
      const nextLikes = alreadyLiked
        ? currentLikes.filter((entry) => entry?.user !== req.user?.id)
        : [...currentLikes, { user: req.user?.id, likedAt: new Date().toISOString() }];

      const { error: updateErr } = await supabase
        .from('reports')
        .update({ likes: nextLikes, updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (updateErr) throw updateErr;

      return res.status(200).json({ liked: !alreadyLiked, likes: nextLikes });
    }

    return res.status(200).json([]);
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

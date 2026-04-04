import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

/**
 * General purpose router — the frontend calls this with ?type= to reach
 * different resources. This delegates to Supabase JS queries.
 */
async function handler(req, res) {
  const { method } = req;
  const type = req.query?.type || '';
  const chatId = req.query?.chatId;

  try {
    // ── Notifications ──
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

    // ── Uploads ──
    if (type === 'uploads') {
      if (method === 'GET') {
        const { data: uploads, error: uErr } = await supabase.from('uploads').select('*').order('created_at', { ascending: false });
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

    // ── Chats ──
    if (type === 'chats') {
      if (method === 'GET') {
        const { data: chats, error: cErr } = await supabase.from('chats').select('*').order('updated_at', { ascending: false });
        if (cErr) throw cErr;
        const { data: users } = await supabase.from('users').select('id, name, role');
        const userMap = {};
        (users||[]).forEach(u => userMap[u.id] = u);

        const formatted = chats.map(c => ({
          _id: c.id, name: c.name, type: c.type, participants: c.participants, isActive: c.is_active,
          lastMessage: c.last_message, createdAt: c.created_at,
          createdBy: c.created_by ? { _id: c.created_by, name: userMap[c.created_by]?.name, role: userMap[c.created_by]?.role } : null
        }));
        return res.json(formatted);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { name, type: ctype, participants } = body || {};
        
        const { data: c, error } = await supabase.from('chats').insert([{
          name: name || 'New Chat', type: ctype || 'group', created_by: req.user?.id, participants: participants || []
        }]).select('*').single();
        if (error) throw error;
        
        return res.status(201).json({
          _id: c.id, name: c.name, type: c.type, participants: c.participants, isActive: c.is_active, createdAt: c.created_at
        });
      }
      return res.json([]);
    }

    // ── Chat Messages ──
    if (type === 'chat-messages' && chatId) {
      if (method === 'GET') {
        const { data: messages, error: mErr } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        if (mErr) throw mErr;
        const { data: users } = await supabase.from('users').select('id, name, role');
        const userMap = {};
        (users||[]).forEach(u => userMap[u.id] = u);

        const formatted = messages.map(m => ({
          _id: m.id, content: m.content, type: m.type, readBy: m.read_by, createdAt: m.created_at,
          sender: m.sender_id ? { id: m.sender_id, name: userMap[m.sender_id]?.name, role: userMap[m.sender_id]?.role } : null
        }));
        return res.json(formatted);
      }
      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { content, type: mtype } = body || {};
        
        const { data: m, error } = await supabase.from('messages').insert([{
          chat_id: chatId, sender_id: req.user?.id, content: content || '', type: mtype || 'text'
        }]).select('*').single();
        if (error) throw error;
        
        const senderInfo = { id: req.user?.id, name: req.user?.name, role: req.user?.role };
        await supabase.from('chats').update({
          last_message: { content, sender: senderInfo, sentAt: m.created_at },
          updated_at: new Date().toISOString()
        }).eq('id', chatId);

        return res.status(201).json({
           _id: m.id, content: m.content, type: m.type, readBy: m.read_by, createdAt: m.created_at, sender: senderInfo
        });
      }
      if (method === 'PUT') {
        const { data: currentMessageRows } = await supabase.from('messages').select('id, read_by').eq('chat_id', chatId);
        for (let m of currentMessageRows || []) {
           let reads = m.read_by || [];
           reads.push({ user: req.user?.id, readAt: new Date().toISOString() });
           await supabase.from('messages').update({ read_by: reads }).eq('id', m.id);
        }
        return res.json({ message: 'Messages marked as read' });
      }
      return res.json([]);
    }

    // ── Reports ──
    if (type === 'reports') {
      if (method === 'GET') {
        const { data: reports, error: rErr } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (rErr) throw rErr;
        const { data: users } = await supabase.from('users').select('id, name, role');
        const userMap = {};
        (users||[]).forEach(u => userMap[u.id] = u);

        const formatted = reports.map(r => ({
          _id: r.id, title: r.title, description: r.description, type: r.type,
          attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
          tags: r.tags, status: r.status, visibility: r.visibility, comments: r.comments, likes: r.likes,
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

    // ── Logout All ──
    if (type === 'logout-all') {
      return res.json({ message: 'Logged out (JWT-based, remove token client-side)' });
    }

    // ── Seed (dev only) ──
    if (type === 'seed') {
      return res.json({ message: 'Use npm run db:init to seed the database' });
    }

    // ── Fallback ──
    return res.status(200).json({ status: 'ok', message: 'General handler' });

  } catch (error) {
    console.error('General handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handleTyping(req, res) {
  const { method } = req;

  if (method === 'POST') {
    // Typing presence is intentionally disabled for serverless compatibility.
    return res.status(200).json({ ok: true });
  }

  if (method === 'GET') {
    return res.status(200).json([]);
  }

  return res.status(405).end();
}

async function handler(req, res) {
  const { method, url } = req;

  try {
    // Route typing requests
    if (req.query?.action === 'typing') return await handleTyping(req, res);

    const isMessages = url.includes('/messages') || req.query?.chatId;
    const chatId = req.params?.id || req.query?.chatId || url.match(/\/chats\/([^/]+)\/messages/)?.[1];

    // ─── MESSAGES ───
    if (isMessages && chatId) {
      if (method === 'GET') {
        const { data: messages, error: mErr } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        if (mErr) throw mErr;

        const { data: users, error: uErr } = await supabase.from('users').select('id, name, role');
        if (uErr) throw uErr;

        const userMap = {};
        users.forEach(u => userMap[u.id] = u);

        const formatted = messages.map(m => ({
          _id: m.id, content: m.content, type: m.type, readBy: m.read_by, createdAt: m.created_at,
          sender: m.sender_id ? { id: m.sender_id, name: userMap[m.sender_id]?.name, role: userMap[m.sender_id]?.role } : null
        }));
        return res.json(formatted);
      }

      if (method === 'POST') {
        let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { content, type } = body || {};
        if (!content) return res.status(400).json({ error: 'Message content is required' });

        const { data: msg, error: iErr } = await supabase
          .from('messages')
          .insert([{ chat_id: chatId, sender_id: req.user?.id || null, content, type: type || 'text' }])
          .select('*')
          .single();
        if (iErr) throw iErr;

        const senderInfo = { id: req.user?.id, name: req.user?.name, role: req.user?.role };
        
        await supabase.from('chats').update({
          last_message: { content, sender: senderInfo, sentAt: msg.created_at },
          updated_at: new Date().toISOString()
        }).eq('id', chatId);

        const formattedMsg = {
          _id: msg.id, content: msg.content, type: msg.type, readBy: msg.read_by, createdAt: msg.created_at,
          sender: senderInfo
        };
        return res.status(201).json(formattedMsg);
      }

      if (method === 'PUT') {
        const { data: currentMessageRows } = await supabase.from('messages').select('id, read_by').eq('chat_id', chatId);
        
        // Marking as read requires fetching current read arrays or using RPC. Doing simple update logic for now.
        for (let m of currentMessageRows || []) {
           let reads = m.read_by || [];
           reads.push({ user: req.user?.id, readAt: new Date().toISOString() });
           await supabase.from('messages').update({ read_by: reads }).eq('id', m.id);
        }
        
        return res.json({ message: 'Messages marked as read' });
      }
      return res.status(405).end();
    }

    // ─── CHATS ───
    if (method === 'GET') {
      const { data: chats, error: cErr } = await supabase.from('chats').select('*').order('updated_at', { ascending: false });
      if (cErr) throw cErr;

      const { data: users, error: uErr } = await supabase.from('users').select('id, name, role');
      if (uErr) throw uErr;

      const userMap = {};
      users.forEach(u => userMap[u.id] = u);

      const formatted = chats.map(c => ({
        _id: c.id, name: c.name, type: c.type, participants: c.participants, isActive: c.is_active,
        lastMessage: c.last_message, createdAt: c.created_at,
        createdBy: c.created_by ? { _id: c.created_by, name: userMap[c.created_by]?.name, role: userMap[c.created_by]?.role } : null
      }));
      return res.json(formatted);
    }

    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, type, participants } = body || {};
      if (!name) return res.status(400).json({ error: 'Chat name is required' });

      const { data: chat, error: iErr } = await supabase
        .from('chats')
        .insert([{
          name, type: type || 'group', created_by: req.user?.id || null, participants: participants || []
        }])
        .select('*')
        .single();
      if (iErr) throw iErr;

      const formatted = {
        _id: chat.id, name: chat.name, type: chat.type, participants: chat.participants, isActive: chat.is_active, createdAt: chat.created_at
      };
      return res.status(201).json(formatted);
    }

    if (method === 'PATCH') {
      const chatId = req.params?.id || req.query?.chatId;
      if (!chatId) return res.status(400).json({ error: 'Chat ID is required' });

      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { addParticipants } = body || {};

      if (!addParticipants || !Array.isArray(addParticipants) || addParticipants.length === 0) {
        return res.status(400).json({ error: 'addParticipants array is required' });
      }

      // Fetch current chat
      const { data: chat, error: fErr } = await supabase.from('chats').select('*').eq('id', chatId).single();
      if (fErr) throw fErr;
      if (!chat) return res.status(404).json({ error: 'Chat not found' });

      // Merge participants (avoid duplicates by user id)
      const existing = chat.participants || [];
      const existingUserIds = new Set(existing.map(p => (typeof p.user === 'object' ? p.user : p.user)));
      const newParticipants = addParticipants.filter(p => !existingUserIds.has(p.user));
      const merged = [...existing, ...newParticipants];

      const { data: updated, error: uErr } = await supabase
        .from('chats')
        .update({ participants: merged, updated_at: new Date().toISOString() })
        .eq('id', chatId)
        .select('*')
        .single();
      if (uErr) throw uErr;

      return res.json({
        _id: updated.id, name: updated.name, type: updated.type,
        participants: updated.participants, isActive: updated.is_active
      });
    }

    return res.status(200).json([]);
  } catch (error) {
    console.error('Chats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

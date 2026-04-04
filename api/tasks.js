import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List tasks ──
    if (method === 'GET') {
      const { status, assignee, priority, category } = req.query || {};

      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (category) query = query.eq('category', category);

      if (assignee) {
        const { data: aUser } = await supabase.from('users').select('id').eq('email', assignee).single();
        if (aUser) {
          query = query.eq('assignee_id', aUser.id);
        } else {
          return res.status(200).json([]);
        }
      }

      const { data: tasks, error: tErr } = await query;
      if (tErr) throw tErr;

      const { data: users, error: uErr } = await supabase.from('users').select('id, name, email');
      if (uErr) throw uErr;

      const userMap = {};
      users.forEach(u => userMap[u.id] = u);

      const formatted = tasks.map(t => ({
        _id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, category: t.category,
        dueAt: t.due_at, comments: typeof t.comments === 'string' ? JSON.parse(t.comments) : t.comments,
        createdAt: t.created_at, updatedAt: t.updated_at,
        assignee: t.assignee_id ? { id: t.assignee_id, name: userMap[t.assignee_id]?.name, email: userMap[t.assignee_id]?.email } : null
      }));

      return res.status(200).json(formatted);
    }

    // ── POST: Create a new task ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, description, assignee, status, priority, category, dueAt } = body || {};

      if (!title) return res.status(400).json({ error: 'Task title is required' });

      let assigneeId = null;
      let assigneeObj = null;
      if (assignee) {
        const { data: aUser } = await supabase.from('users').select('id, name, email').eq('email', assignee).single();
        if (aUser) {
          assigneeId = aUser.id;
          assigneeObj = aUser;
        }
      }

      const { data: newTask, error: iErr } = await supabase.from('tasks').insert([{
        title, description: description || null, assignee_id: assigneeId, created_by: req.user?.id || null,
        status: status || 'pending', priority: priority || 'medium', category: category || null, due_at: dueAt || null
      }]).select('*').single();
      if (iErr) throw iErr;

      const formatted = {
        _id: newTask.id, title: newTask.title, description: newTask.description, status: newTask.status,
        priority: newTask.priority, category: newTask.category, dueAt: newTask.due_at, comments: newTask.comments,
        createdAt: newTask.created_at, assignee: assigneeObj
      };

      await logActivity({
        type: 'task_created', action: `Task "${title}" created`,
        actorId: req.user?.id, refId: newTask.id, refType: 'task'
      });

      return res.status(201).json(formatted);
    }

    // ── PATCH/PUT: Update a task ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, title, description, status, priority, category, dueAt, comments } = body || {};
      const taskId = _id || id || req.query?.id;

      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      const updates = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (category !== undefined) updates.category = category;
      if (dueAt !== undefined) updates.due_at = dueAt;
      if (comments !== undefined) updates.comments = comments;

      const { data: updatedTask, error: uErr } = await supabase.from('tasks')
        .update(updates).eq('id', taskId).select('*').single();
        
      if (uErr) {
        // Assume 404 if error
        return res.status(404).json({ error: 'Task not found' });
      }

      if (status) {
        await logActivity({
          type: 'task_updated', action: `Task status changed to "${status}"`,
          actorId: req.user?.id, refId: taskId, refType: 'task', meta: { status }
        });
      }

      const formatted = {
        _id: updatedTask.id, title: updatedTask.title, description: updatedTask.description, status: updatedTask.status,
        priority: updatedTask.priority, category: updatedTask.category, dueAt: updatedTask.due_at, comments: updatedTask.comments,
        updatedAt: updatedTask.updated_at
      };

      return res.status(200).json(formatted);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const taskId = body?._id || body?.id || req.query?.id;
      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      const { error: dErr } = await supabase.from('tasks').delete().eq('id', taskId);
      if (dErr) throw dErr;

      await logActivity({
        type: 'task_deleted', action: 'Task deleted',
        actorId: req.user?.id, refId: taskId, refType: 'task'
      });

      return res.status(200).json({ message: 'Task deleted successfully' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);

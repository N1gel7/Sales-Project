import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';
import { notifyTaskAssignment } from './_lib/taskNotifications.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s) {
  return typeof s === 'string' && UUID_RE.test(s);
}

function parseComments(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function resolveAssigneeFromBody(body) {
  if (!body) return null;
  const { assigneeId, assignee } = body;
  if (assigneeId != null && String(assigneeId).trim() !== '' && isUuid(String(assigneeId))) {
    const { data } = await supabase.from('users').select('id, name, email, code').eq('id', assigneeId).single();
    return data || null;
  }
  if (assignee != null && typeof assignee === 'string' && assignee.trim() !== '') {
    const a = assignee.trim();
    if (isUuid(a)) {
      const { data } = await supabase.from('users').select('id, name, email, code').eq('id', a).single();
      return data || null;
    }
    const { data } = await supabase
      .from('users')
      .select('id, name, email, code')
      .eq('email', a.toLowerCase())
      .single();
    return data || null;
  }
  return null;
}

function formatTaskRow(t, userMap) {
  const assignee = t.assignee_id ? userMap[t.assignee_id] : null;
  const assigner = t.created_by ? userMap[t.created_by] : null;
  return {
    _id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    dueAt: t.due_at,
    location: t.location || null,
    comments: parseComments(t.comments),
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    assignee: assignee
      ? { id: assignee.id, name: assignee.name, email: assignee.email, code: assignee.code || '' }
      : null,
    createdBy: assigner
      ? { id: assigner.id, name: assigner.name, code: assigner.code || '', email: assigner.email }
      : null,
  };
}

async function loadUserMap() {
  const { data: users, error } = await supabase.from('users').select('id, name, email, code');
  if (error) throw error;
  const userMap = {};
  (users || []).forEach((u) => {
    userMap[u.id] = u;
  });
  return userMap;
}

/**
 * Handles Task Management API endpoints.
 * Supports task CRUD operations and commenting.
 * 
 * Route: `/api/tasks` or `/api/tasks/:id` or `/api/tasks/:id/comments`
 * 
 * @param {import('http').IncomingMessage} req - The HTTP request object.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * 
 * @example
 * // GET /api/tasks?status=pending
 * // Returns a list of tasks, filtered by optional query params.
 * 
 * @example
 * // POST /api/tasks
 * // Creates a new task. Requires: `req.body.title`.
 */
async function handler(req, res) {
  const { method } = req;
  const paramId = req.params?.id;
  const pathOnly = (req.path || req.url?.split('?')[0] || '').replace(/\/$/, '');
  const isCommentsPath = Boolean(paramId) && pathOnly.endsWith('/comments');

  try {
    if (method === 'POST' && paramId && isCommentsPath) {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const text = body?.text?.trim();
      if (!text) return res.status(400).json({ error: 'Comment text is required' });

      const { data: task, error: gErr } = await supabase.from('tasks').select('*').eq('id', paramId).single();
      if (gErr || !task) return res.status(404).json({ error: 'Task not found' });

      const comments = parseComments(task.comments);
      comments.push({
        text,
        authorId: req.user?.id,
        author: {
          name: req.user?.name || 'User',
          code: req.user?.code || '',
        },
        createdAt: new Date().toISOString(),
      });

      const { data: updated, error: uErr } = await supabase
        .from('tasks')
        .update({ comments, updated_at: new Date().toISOString() })
        .eq('id', paramId)
        .select('*')
        .single();
      if (uErr) throw uErr;

      const userMap = await loadUserMap();
      return res.status(201).json(formatTaskRow(updated, userMap));
    }

    if (method === 'GET' && paramId) {
      const { data: task, error } = await supabase.from('tasks').select('*').eq('id', paramId).single();
      if (error || !task) return res.status(404).json({ error: 'Task not found' });
      const userMap = await loadUserMap();
      return res.status(200).json(formatTaskRow(task, userMap));
    }

    if (method === 'GET') {
      const { status, assignee, priority, category } = req.query || {};

      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

      if (req.user?.role === 'sales') {
        query = query.or(`assignee_id.eq.${req.user.id},created_by.eq.${req.user.id}`);
      }

      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (category) query = query.eq('category', category);

      if (assignee) {
        if (isUuid(assignee)) {
          query = query.eq('assignee_id', assignee);
        } else {
          const { data: aUser } = await supabase.from('users').select('id').eq('email', assignee).single();
          if (aUser) query = query.eq('assignee_id', aUser.id);
          else return res.status(200).json([]);
        }
      }

      const { data: tasks, error: tErr } = await query;
      if (tErr) throw tErr;

      const userMap = await loadUserMap();
      const formatted = (tasks || []).map((t) => formatTaskRow(t, userMap));
      return res.status(200).json(formatted);
    }

    if (method === 'POST' && !paramId) {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, description, status, priority, category, dueAt, location } = body || {};

      if (!title) return res.status(400).json({ error: 'Task title is required' });

      const assigneeObj = await resolveAssigneeFromBody(body);
      const assigneeId = assigneeObj?.id || null;
      const assignerId = req.user?.id || null;

      const insertPayload = {
        title,
        description: description || null,
        assignee_id: assigneeId,
        created_by: assignerId,
        status: status || 'pending',
        priority: priority || 'medium',
        category: category || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        location: location || null,
      };

      const { data: newTask, error: iErr } = await supabase.from('tasks').insert([insertPayload]).select('*').single();
      if (iErr) throw iErr;

      if (assigneeId) {
        await notifyTaskAssignment({
          assigneeId,
          taskId: newTask.id,
          taskTitle: title,
          assignerName: req.user?.name,
        });
      }

      await logActivity({
        type: 'task_created',
        action: `Task "${title}" created`,
        actorId: req.user?.id,
        refId: newTask.id,
        refType: 'task',
      });

      const userMap = await loadUserMap();
      return res.status(201).json(formatTaskRow(newTask, userMap));
    }

    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const taskId = paramId || body?._id || body?.id || req.query?.id;
      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      const { data: existing, error: exErr } = await supabase.from('tasks').select('*').eq('id', taskId).single();
      if (exErr || !existing) return res.status(404).json({ error: 'Task not found' });

      const { title, description, status, priority, category, dueAt, comments } = body || {};
      const updates = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (category !== undefined) updates.category = category;
      if (dueAt !== undefined) updates.due_at = dueAt ? new Date(dueAt).toISOString() : null;
      if (comments !== undefined) updates.comments = comments;
      if (body.location !== undefined) updates.location = body.location;

      let assigneeExplicit = false;
      let newAssigneeId = existing.assignee_id;
      if (body.assigneeId !== undefined || body.assignee !== undefined) {
        assigneeExplicit = true;
        const assigneeObj = await resolveAssigneeFromBody(body);
        newAssigneeId = assigneeObj?.id || null;
        updates.assignee_id = newAssigneeId;
      }

      const { data: updatedTask, error: uErr } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select('*')
        .single();

      if (uErr) return res.status(404).json({ error: 'Task not found' });

      const prevAssignee = existing.assignee_id ? String(existing.assignee_id) : '';
      const nextAssignee = newAssigneeId ? String(newAssigneeId) : '';
      if (assigneeExplicit && nextAssignee && prevAssignee !== nextAssignee) {
        await notifyTaskAssignment({
          assigneeId: newAssigneeId,
          taskId,
          taskTitle: updatedTask.title,
          assignerName: req.user?.name,
        });
      }

      if (status) {
        await logActivity({
          type: 'task_updated',
          action: `Task status changed to "${status}"`,
          actorId: req.user?.id,
          refId: taskId,
          refType: 'task',
          meta: { status },
        });
      }

      const userMap = await loadUserMap();
      return res.status(200).json(formatTaskRow(updatedTask, userMap));
    }

    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const taskId = paramId || body?._id || body?.id || req.query?.id;
      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      const { error: dErr } = await supabase.from('tasks').delete().eq('id', taskId);
      if (dErr) throw dErr;

      await logActivity({
        type: 'task_deleted',
        action: 'Task deleted',
        actorId: req.user?.id,
        refId: taskId,
        refType: 'task',
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

import { getDbPool } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

async function handler(req, res) {
  const pool = getDbPool();
  const { method } = req;

  try {
    // ── GET: List tasks (with optional filters) ──
    if (method === 'GET') {
      const { status, assignee, priority, category } = req.query || {};

      let query = `
        SELECT t.id AS "_id", t.title, t.description, t.status, t.priority, t.category,
               t.due_at AS "dueAt", t.comments, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
               json_build_object(
                 'id', a.id, 'name', a.name, 'email', a.email
               ) AS assignee
        FROM tasks t
        LEFT JOIN users a ON t.assignee_id = a.id
      `;
      const params = [];
      const conditions = [];

      if (status) {
        params.push(status);
        conditions.push(`t.status = $${params.length}`);
      }
      if (assignee) {
        params.push(assignee);
        conditions.push(`a.email = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        conditions.push(`t.priority = $${params.length}`);
      }
      if (category) {
        params.push(category);
        conditions.push(`t.category = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      return res.status(200).json(result.rows);
    }

    // ── POST: Create a new task ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, description, assignee, status, priority, category, dueAt } = body || {};

      if (!title) return res.status(400).json({ error: 'Task title is required' });

      // Resolve assignee by email if provided
      let assigneeId = null;
      if (assignee) {
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [assignee]);
        assigneeId = userRes.rows[0]?.id || null;
      }

      const result = await pool.query(
        `INSERT INTO tasks (title, description, assignee_id, created_by, status, priority, category, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id AS "_id", title, description, status, priority, category,
                   due_at AS "dueAt", comments, created_at AS "createdAt"`,
        [title, description || null, assigneeId, req.user?.id || null,
         status || 'pending', priority || 'medium', category || null, dueAt || null]
      );

      const newTask = result.rows[0];

      // Fetch the assignee info for the response
      if (assigneeId) {
        const aRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [assigneeId]);
        newTask.assignee = aRes.rows[0] || null;
      } else {
        newTask.assignee = null;
      }

      await logActivity({
        type: 'task_created', action: `Task "${title}" created`,
        actorId: req.user?.id, refId: newTask._id, refType: 'task'
      });

      return res.status(201).json(newTask);
    }

    // ── PATCH/PUT: Update a task ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, title, description, status, priority, category, dueAt, comments } = body || {};
      const taskId = _id || id || req.query?.id;

      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      const result = await pool.query(
        `UPDATE tasks
         SET title = COALESCE($1, title), description = COALESCE($2, description),
             status = COALESCE($3, status), priority = COALESCE($4, priority),
             category = COALESCE($5, category), due_at = COALESCE($6, due_at),
             comments = COALESCE($7, comments), updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING id AS "_id", title, description, status, priority, category,
                   due_at AS "dueAt", comments, updated_at AS "updatedAt"`,
        [title || null, description || null, status || null, priority || null,
         category || null, dueAt || null, comments ? JSON.stringify(comments) : null, taskId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

      if (status) {
        await logActivity({
          type: 'task_updated', action: `Task status changed to "${status}"`,
          actorId: req.user?.id, refId: taskId, refType: 'task', meta: { status }
        });
      }

      return res.status(200).json(result.rows[0]);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const taskId = body?._id || body?.id || req.query?.id;
      if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

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

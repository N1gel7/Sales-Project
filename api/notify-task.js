// Simple notifications stub; logs notification and returns ok
import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  await dbConnect(process.env.MONGODB_URI);
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  // In real impl, push/email would go here
  console.log('Notify assignee:', task.assignee, 'for task', task.title);
  return res.status(200).json({ ok: true });
}



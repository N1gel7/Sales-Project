import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const { status, assignee, priority, category } = req.query || {};
    const filter = {};
    if (status) filter.status = status;
    if (assignee) filter['assignee.id'] = assignee;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    
    const docs = await Task.find(filter).populate('assignee.id', 'name email').sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  
  if (req.method === 'POST') {
    const doc = await Task.create(req.body);
    await doc.populate('assignee.id', 'name email');
    return res.status(201).json(doc);
  }
  
  if (req.method === 'PUT') {
    const { id, ...updateData } = req.body;
    const doc = await Task.findByIdAndUpdate(id, updateData, { new: true }).populate('assignee.id', 'name email');
    if (!doc) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json(doc);
  }
  
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const doc = await Task.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json({ message: 'Task deleted successfully' });
  }
  
  return res.status(405).end();
}

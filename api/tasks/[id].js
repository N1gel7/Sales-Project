import { dbConnect } from './_lib/db.js';
import Task from '../../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  const { id } = req.query;
  
  if (req.method === 'GET') {
    try {
      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(200).json(task);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  }
  
  if (req.method === 'PATCH') {
    try {
      const { status, ...updateData } = req.body;
      const task = await Task.findByIdAndUpdate(id, updateData, { new: true });
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(200).json(task);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update task' });
    }
  }
  
  if (req.method === 'DELETE') {
    try {
      const task = await Task.findByIdAndDelete(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  }
  
  return res.status(405).end();
}

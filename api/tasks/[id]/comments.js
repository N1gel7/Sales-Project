import { dbConnect } from './_lib/db.js';
import Task from '../../../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  const { id } = req.query;
  
  if (req.method === 'GET') {
    try {
      const task = await Task.findById(id).select('comments');
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(200).json(task.comments || []);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { text, author } = req.body;
      
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
      }
      
      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Add comment to task
      task.comments.push({
        text: text.trim(),
        author: author || { id: 'unknown', name: 'Unknown User', code: 'UNK' },
        createdAt: new Date()
      });
      
      await task.save();
      
      return res.status(201).json(task.comments[task.comments.length - 1]);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to add comment' });
    }
  }
  
  return res.status(405).end();
}

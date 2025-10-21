import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    try {
      const { unread } = req.query;
      
      // Get all tasks with notifications
      const tasks = await Task.find({ 'notifications.0': { $exists: true } })
        .select('title notifications assignee')
        .sort({ createdAt: -1 });
      
      // Flatten all notifications
      let allNotifications = [];
      tasks.forEach(task => {
        task.notifications.forEach(notification => {
          if (unread === 'true' && notification.read) return;
          
          allNotifications.push({
            id: `${task._id}-${notification._id}`,
            taskId: task._id,
            taskTitle: task.title,
            type: notification.type,
            message: notification.message,
            read: notification.read,
            createdAt: notification.createdAt
          });
        });
      });
      
      // Sort by creation date
      allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json(allNotifications);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
  
  return res.status(405).end();
}

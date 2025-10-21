import { dbConnect } from '../_lib/db.js';
import Task from '../../models/Task.js';
import Invoice from '../../models/Invoice.js';
import Upload from '../../models/Upload.js';

export default async function handler(req, res) {
  try {
    await dbConnect(process.env.MONGODB_URI);
    
    if (req.method === 'GET') {
      const { limit = 10 } = req.query;
      
      // Get recent activities from different collections
      const [recentTasks, recentInvoices, recentUploads] = await Promise.all([
        Task.find({}).sort({ createdAt: -1 }).limit(parseInt(limit)).lean(),
        Invoice.find({}).sort({ createdAt: -1 }).limit(parseInt(limit)).lean(),
        Upload.find({}).sort({ createdAt: -1 }).limit(parseInt(limit)).lean()
      ]);
      
      // Combine and format activities
      const activities = [];
      
      // Add task activities
      recentTasks.forEach(task => {
        activities.push({
          id: `task_${task._id}`,
          type: 'task',
          action: `Task "${task.title}" ${task.status}`,
          user: task.assignee?.name || 'Unknown',
          timestamp: task.createdAt,
          status: task.status
        });
      });
      
      // Add invoice activities
      recentInvoices.forEach(invoice => {
        activities.push({
          id: `invoice_${invoice._id}`,
          type: 'invoice',
          action: `Invoice created for ${invoice.client}`,
          user: 'System',
          timestamp: invoice.createdAt,
          amount: invoice.price
        });
      });
      
      // Add upload activities
      recentUploads.forEach(upload => {
        activities.push({
          id: `upload_${upload._id}`,
          type: 'upload',
          action: `File uploaded: ${upload.filename}`,
          user: 'System',
          timestamp: upload.createdAt,
          filename: upload.filename
        });
      });
      
      // Sort by timestamp and limit
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.json(activities.slice(0, parseInt(limit)));
    }
    
    return res.status(405).end();
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';
import Invoice from '../models/Invoice.js';
import Upload from '../models/Upload.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  try {
    await dbConnect(process.env.MONGODB_URI);
    
    if (req.method === 'GET') {
      const { startDate, endDate, userId, type } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [tasks, invoices, uploads, users] = await Promise.all([
      Task.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      Invoice.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      Upload.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      User.find({}).lean()
    ]);
    
    // Calculate task stats
    const taskStats = {
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
    
    // Calculate sales stats
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.price || 0), 0);
    const totalInvoices = invoices.length;
    const averageInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    
    const salesStats = {
      totalRevenue,
      totalInvoices,
      averageInvoice
    };
    
    // Daily sales (last 7 days)
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      const dayInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate.toDateString() === date.toDateString();
      });
      
      dailySales.push({
        _id: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        },
        revenue: dayInvoices.reduce((sum, inv) => sum + (inv.price || 0), 0),
        count: dayInvoices.length
      });
    }
    
      // Handle activity request
      if (type === 'activity') {
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
        
        return res.json(activities.slice(0, parseInt(limit)));
      }
      
      // Default stats response
      res.json({
        taskStats,
        salesStats,
        dailySales,
        dateRange: { start, end }
      });
    }
    
    return res.status(405).end();
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

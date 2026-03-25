import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';
import Invoice from '../models/Invoice.js';
import Upload from '../models/Upload.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const { startDate, endDate, userId } = req.query;
    
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
    
    res.json({
      taskStats,
      salesStats,
      dailySales,
      dateRange: { start, end }
    });
  }
  
  return res.status(405).end();
}

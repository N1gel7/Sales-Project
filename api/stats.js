import { dbConnect } from './_lib/db.js';
import Invoice from '../models/Invoice.js';
import Task from '../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales, monthSales, tasksDone, tasksTotal] = await Promise.all([
    Invoice.aggregate([{ $match: { createdAt: { $gte: startOfDay } } }, { $group: { _id: null, sum: { $sum: '$price' } } }]),
    Invoice.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, sum: { $sum: '$price' } } }]),
    Task.countDocuments({ status: 'done' }),
    Task.countDocuments({})
  ]);

  res.json({
    todaySales: todaySales[0]?.sum || 0,
    monthSales: monthSales[0]?.sum || 0,
    tasksDone,
    tasksTotal
  });
}



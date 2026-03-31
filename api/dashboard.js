import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Hardcoded mock stats
  const taskStats = {
    pending: 12,
    in_progress: 5,
    completed: 28,
    overdue: 3,
    cancelled: 2
  };

  const salesStats = {
    totalRevenue: 45670.50,
    totalInvoices: 154,
    averageInvoice: 296.56
  };

  // Daily sales (last 7 days)
  const end = new Date();
  const dailySales = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    dailySales.push({
      _id: {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      },
      revenue: Math.floor(Math.random() * 5000) + 1000,
      count: Math.floor(Math.random() * 20) + 5
    });
  }

  const employeeActivity = [
    { _id: 'user_admin', name: 'Admin User', code: 'ADM001', completedTasks: 25 },
    { _id: 'user_manager', name: 'Manager User', code: 'MGR001', completedTasks: 18 },
    { _id: 'user_rep1', name: 'Sales Rep', code: 'SAL001', completedTasks: 32 }
  ];

  const productPerformance = [
    { _id: 'Smartphone X', revenue: 15000, count: 30 },
    { _id: 'Laptop Pro', revenue: 25000, count: 10 },
    { _id: 'Wireless Earbuds', revenue: 5000, count: 50 }
  ];

  const locationActivity = [
    { _id: { lat: 5.6037, lng: -0.1870 }, count: 15, types: ['Sale', 'Visit'] },
    { _id: { lat: 5.6342, lng: -0.2104 }, count: 8, types: ['Prospect'] }
  ];

  return res.status(200).json({
    taskStats,
    salesStats,
    dailySales,
    employeeActivity,
    productPerformance,
    locationActivity,
    dateRange: { 
      start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), 
      end: end.toISOString()
    }
  });
}


export default withAuth(handler);

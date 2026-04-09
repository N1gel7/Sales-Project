/**
 * GET /api/dashboard
 *
 * Legacy dashboard route — now delegates to the same SQL aggregation
 * helpers used by /api/dashboard/stats for consistency.
 * Kept for backwards compatibility with older frontend calls.
 */
import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import {
  getDailySalesSQL,
  getMonthlySalesSQL,
  getTaskCompletionRatesSQL,
  getProductPerformanceSQL,
} from './_lib/analytics.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [
      dailySalesResult,
      completionResult,
      productResult,
      { data: taskStatRows },
      { data: uploads },
    ] = await Promise.all([
      getDailySalesSQL(7),
      getTaskCompletionRatesSQL(),
      getProductPerformanceSQL(10),
      supabase.from('tasks').select('status, assignee_id'),
      supabase.from('uploads').select('coords'),
    ]);

    // Task stats
    const taskStats = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    (taskStatRows || []).forEach(t => { if (taskStats[t.status] !== undefined) taskStats[t.status]++; });

    // Sales stats
    const totalRevenue = dailySalesResult.reduce((sum, d) => sum + d.revenue, 0);
    const totalInvoices = dailySalesResult.reduce((sum, d) => sum + d.count, 0);
    const salesStats = {
      totalRevenue,
      totalInvoices,
      averageInvoice: totalInvoices > 0 ? Number((totalRevenue / totalInvoices).toFixed(2)) : 0,
    };

    // Daily sales (shaped for legacy compatibility)
    const dailySales = dailySalesResult.map(d => ({
      _id: { year: d.year, month: d.month, day: d.day },
      revenue: d.revenue,
      count: d.count,
    }));

    // Employee activity from SQL JOIN result
    const employeeActivity = completionResult.byUser.map(u => ({
      _id: u.userId,
      name: u.userName,
      code: u.userCode,
      completedTasks: u.completed,
    })).sort((a, b) => b.completedTasks - a.completedTasks);

    // Product performance from SQL GROUP BY
    const productPerformance = productResult;

    // Location activity from uploads
    const locMap = {};
    (uploads || []).forEach(u => {
      if (!u.coords) return;
      const key = typeof u.coords === 'string' ? u.coords : JSON.stringify(u.coords);
      if (!locMap[key]) locMap[key] = { _id: key, count: 0, types: ['Upload'] };
      locMap[key].count++;
    });
    const locationActivity = Object.values(locMap).sort((a, b) => b.count - a.count).slice(0, 20);

    const end = new Date();
    return res.status(200).json({
      taskStats, salesStats, dailySales, employeeActivity, productPerformance, locationActivity,
      dateRange: { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: end.toISOString() },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

export default withAuth(handler);

import { supabase } from '../_lib/db.js';
import { withAuth } from '../_lib/authMiddleware.js';
import {
  getDailySalesSQL,
  getMonthlySalesSQL,
  getTaskCompletionRatesSQL,
  getProductPerformanceSQL,
} from '../_lib/analytics.js';

/**
 * GET /api/dashboard/stats
 *
 * Aggregates dashboard KPIs using SQL GROUP BY + JOIN queries via Supabase RPC.
 * Falls back to in-process JS aggregation if RPC functions are not yet deployed.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // ── Run all aggregations in parallel ──────────────────────────────────────
    const [
      dailySalesResult,
      monthlySalesResult,
      completionResult,
      productResult,
      { data: uploads },
    ] = await Promise.all([
      getDailySalesSQL(7),
      getMonthlySalesSQL(12),
      getTaskCompletionRatesSQL(),
      getProductPerformanceSQL(10),
      supabase.from('uploads').select('coords, type'),
    ]);

    // ── Task stats: status breakdown from completion result ───────────────────
    // Re-query minimal task data just for status breakdown (lightweight)
    const { data: taskStatRows } = await supabase
      .from('tasks')
      .select('status');

    const taskStats = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    (taskStatRows || []).forEach(t => {
      if (taskStats[t.status] !== undefined) taskStats[t.status]++;
    });

    // ── Sales stats summary ───────────────────────────────────────────────────
    const totalRevenue = dailySalesResult.reduce((sum, d) => sum + d.revenue, 0);
    const totalInvoices = dailySalesResult.reduce((sum, d) => sum + d.count, 0);
    // Use 30-day monthly slice for overall "all-time" totals from monthly data
    const allTimeRevenue = monthlySalesResult.reduce((sum, m) => sum + m.revenue, 0);
    const allTimeInvoices = monthlySalesResult.reduce((sum, m) => sum + m.count, 0);
    const salesStats = {
      totalRevenue: allTimeRevenue,
      totalInvoices: allTimeInvoices,
      averageInvoice: allTimeInvoices > 0
        ? Number((allTimeRevenue / allTimeInvoices).toFixed(2))
        : 0,
      last7DaysRevenue: totalRevenue,
      last7DaysInvoices: totalInvoices,
    };

    // ── Daily sales (last 7 days) — shaped for legacy dashboard compatibility ─
    const dailySales = dailySalesResult.map(d => ({
      _id: { year: d.year, month: d.month, day: d.day },
      revenue: d.revenue,
      count: d.count,
    }));

    // ── Monthly sales trend (last 12 months) ─────────────────────────────────
    const monthlySales = monthlySalesResult.map(m => ({
      _id: { year: m.year, month: m.month },
      revenue: m.revenue,
      count: m.count,
    }));

    // ── Employee activity: completion rate per user (from SQL JOIN) ───────────
    const employeeActivity = completionResult.byUser.map(u => ({
      _id: u.userId,
      name: u.userName,
      code: u.userCode,
      completedTasks: u.completed,
      totalTasks: u.total,
      completionRate: u.rate,
    })).sort((a, b) => b.completedTasks - a.completedTasks);

    // ── Task completion summary ───────────────────────────────────────────────
    const taskCompletion = completionResult.overall;

    // ── Product performance (from SQL GROUP BY) ───────────────────────────────
    const productPerformance = productResult;

    // ── Location activity: from uploads with coordinates ─────────────────────
    function parseUploadCoords(coords) {
      if (coords == null) return null;
      let c = coords;
      if (typeof c === 'string') {
        try { c = JSON.parse(c); } catch { return null; }
      }
      if (typeof c !== 'object') return null;
      const lat = Number(c.lat ?? c.latitude);
      const lng = Number(c.lng ?? c.longitude ?? c.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }

    const locMap = {};
    (uploads || []).forEach(u => {
      const pt = parseUploadCoords(u.coords);
      if (!pt) return;
      const key = `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`;
      const typeLabel = u.type ? String(u.type).split('/')[0] || 'file' : 'upload';
      if (!locMap[key]) {
        locMap[key] = { _id: { lat: pt.lat, lng: pt.lng }, count: 0, types: [] };
      }
      locMap[key].count++;
      if (!locMap[key].types.includes(typeLabel)) locMap[key].types.push(typeLabel);
    });
    const locationActivity = Object.values(locMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Compose response ──────────────────────────────────────────────────────
    const end = new Date();
    return res.status(200).json({
      taskStats,
      taskCompletion,
      salesStats,
      dailySales,
      monthlySales,
      employeeActivity,
      productPerformance,
      locationActivity,
      dateRange: {
        start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}

export default withAuth(handler);

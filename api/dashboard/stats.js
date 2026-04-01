import { getDbPool } from '../_lib/db.js';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const pool = getDbPool();

  try {
    // ── Task stats: count by status ──
    const taskStatsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress')  AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')    AS completed,
        COUNT(*) FILTER (WHERE status = 'overdue')      AS overdue,
        COUNT(*) FILTER (WHERE status = 'cancelled')    AS cancelled
      FROM tasks
    `);
    const taskStats = taskStatsRes.rows[0] || { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    // Convert string counts to numbers
    Object.keys(taskStats).forEach(k => { taskStats[k] = Number(taskStats[k]); });

    // ── Sales stats: aggregate invoices ──
    const salesStatsRes = await pool.query(`
      SELECT
        COALESCE(SUM(price), 0)   AS "totalRevenue",
        COUNT(*)                  AS "totalInvoices",
        COALESCE(AVG(price), 0)   AS "averageInvoice"
      FROM invoices
    `);
    const salesStats = salesStatsRes.rows[0];
    salesStats.totalRevenue = Number(salesStats.totalRevenue);
    salesStats.totalInvoices = Number(salesStats.totalInvoices);
    salesStats.averageInvoice = Number(Number(salesStats.averageInvoice).toFixed(2));

    // ── Daily sales (last 7 days from invoices) ──
    const dailySalesRes = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM created_at)::int AS year,
        EXTRACT(MONTH FROM created_at)::int AS month,
        EXTRACT(DAY   FROM created_at)::int AS day,
        COALESCE(SUM(price), 0) AS revenue,
        COUNT(*)                AS count
      FROM invoices
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY year, month, day
      ORDER BY year, month, day
    `);
    const dailySales = dailySalesRes.rows.map(r => ({
      _id: { year: r.year, month: r.month, day: r.day },
      revenue: Number(r.revenue),
      count: Number(r.count)
    }));

    // ── Employee activity: completed tasks per user ──
    const empRes = await pool.query(`
      SELECT u.id AS "_id", u.name, u.code,
             COUNT(t.id) AS "completedTasks"
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status = 'completed'
      GROUP BY u.id, u.name, u.code
      ORDER BY "completedTasks" DESC
    `);
    const employeeActivity = empRes.rows.map(r => ({
      ...r, completedTasks: Number(r.completedTasks)
    }));

    // ── Product performance: revenue from invoices by product ──
    const prodRes = await pool.query(`
      SELECT product AS "_id",
             COALESCE(SUM(price), 0) AS revenue,
             COUNT(*) AS count
      FROM invoices
      GROUP BY product
      ORDER BY revenue DESC
      LIMIT 10
    `);
    const productPerformance = prodRes.rows.map(r => ({
      ...r, revenue: Number(r.revenue), count: Number(r.count)
    }));

    // ── Location activity: from uploads with coordinates ──
    const locRes = await pool.query(`
      SELECT coords AS location, COUNT(*) AS count
      FROM uploads
      WHERE coords IS NOT NULL
      GROUP BY coords
      LIMIT 20
    `);
    const locationActivity = locRes.rows.map(r => ({
      _id: r.location, count: Number(r.count), types: ['Upload']
    }));

    const end = new Date();
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
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}

export default withAuth(handler);

import { withAuth } from '../_lib/authMiddleware.js';
import {
  getDailySalesSQL,
  getMonthlySalesSQL,
  getProductPerformanceSQL,
} from '../_lib/analytics.js';

/**
 * GET /api/analytics/sales
 *
 * Query params:
 *   period=daily|monthly  (default: daily)
 *   days=7                (for daily; how many days back)
 *   months=12             (for monthly; how many months back)
 *   limit=10              (for product performance)
 *
 * Returns aggregated sales data computed via SQL GROUP BY JOINs.
 * Falls back to in-process JS aggregation if RPC functions aren't deployed.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { period = 'daily', days = 7, months = 12, limit = 10 } = req.query || {};

  try {
    if (period === 'monthly') {
      const monthlyData = await getMonthlySalesSQL(Number(months));
      const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
      const totalInvoices = monthlyData.reduce((sum, m) => sum + m.count, 0);

      return res.status(200).json({
        period: 'monthly',
        data: monthlyData.map(m => ({
          _id: { year: m.year, month: m.month },
          revenue: m.revenue,
          count: m.count,
          topRep: m.topRep,
        })),
        summary: {
          totalRevenue,
          totalInvoices,
          averageMonthlyRevenue: monthlyData.length > 0
            ? Number((totalRevenue / monthlyData.length).toFixed(2))
            : 0,
        },
      });
    }

    // Default: daily
    const [dailyData, productData] = await Promise.all([
      getDailySalesSQL(Number(days)),
      getProductPerformanceSQL(Number(limit)),
    ]);

    const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const totalInvoices = dailyData.reduce((sum, d) => sum + d.count, 0);

    return res.status(200).json({
      period: 'daily',
      data: dailyData.map(d => ({
        _id: { year: d.year, month: d.month, day: d.day },
        date: d.date,
        revenue: d.revenue,
        count: d.count,
        topRep: d.topRep,
      })),
      productPerformance: productData,
      summary: {
        totalRevenue,
        totalInvoices,
        averageDailyRevenue: dailyData.length > 0
          ? Number((totalRevenue / dailyData.length).toFixed(2))
          : 0,
        peakDay: dailyData.length > 0
          ? dailyData.reduce((max, d) => d.revenue > max.revenue ? d : max, dailyData[0])
          : null,
      },
    });
  } catch (error) {
    console.error('[analytics/sales] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
}

export default withAuth(handler);

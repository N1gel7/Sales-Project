import { supabase } from '../_lib/db.js';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [{ data: tasks }, { data: invoices }, { data: users }, { data: uploads }] = await Promise.all([
      supabase.from('tasks').select('status, assignee_id'),
      supabase.from('invoices').select('price, product, created_at'),
      supabase.from('users').select('id, name, code'),
      supabase.from('uploads').select('coords, type')
    ]);

    // ── Task stats: count by status ──
    const taskStats = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    (tasks || []).forEach(t => { if (taskStats[t.status] !== undefined) taskStats[t.status]++; });

    // ── Sales stats: aggregate invoices ──
    let totalRevenue = 0;
    (invoices || []).forEach(i => totalRevenue += (i.price || 0));
    const totalInvoices = (invoices || []).length;
    const averageInvoice = totalInvoices > 0 ? (totalRevenue / totalInvoices).toFixed(2) : 0;
    const salesStats = { totalRevenue, totalInvoices, averageInvoice: Number(averageInvoice) };

    // ── Daily sales (last 7 days from invoices) ──
    const dailySalesMap = {};
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);

    (invoices || []).forEach(i => {
      const d = new Date(i.created_at);
      if (d >= sevenDaysAgo) {
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (!dailySalesMap[key]) dailySalesMap[key] = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), revenue: 0, count: 0 };
        dailySalesMap[key].revenue += (i.price || 0);
        dailySalesMap[key].count++;
      }
    });
    const dailySales = Object.values(dailySalesMap).sort((a,b) => {
       return new Date(a.year, a.month-1, a.day) - new Date(b.year, b.month-1, b.day);
    }).map(v => ({ _id: { year: v.year, month: v.month, day: v.day }, revenue: v.revenue, count: v.count }));

    // ── Employee activity: completed tasks per user ──
    const empMap = {};
    (users || []).forEach(u => empMap[u.id] = { _id: u.id, name: u.name, code: u.code, completedTasks: 0 });
    (tasks || []).forEach(t => {
      if (t.status === 'completed' && t.assignee_id && empMap[t.assignee_id]) {
        empMap[t.assignee_id].completedTasks++;
      }
    });
    const employeeActivity = Object.values(empMap).sort((a,b) => b.completedTasks - a.completedTasks);

    // ── Product performance: revenue from invoices by product ──
    const prodMap = {};
    (invoices || []).forEach(i => {
      if (!i.product) return;
      if (!prodMap[i.product]) prodMap[i.product] = { _id: i.product, revenue: 0, count: 0 };
      prodMap[i.product].revenue += (i.price || 0);
      prodMap[i.product].count++;
    });
    const productPerformance = Object.values(prodMap).sort((a,b) => b.revenue - a.revenue).slice(0, 10);

    // ── Location activity: from uploads with coordinates (shape matches Dashboard: _id: { lat, lng }) ──
    function parseUploadCoords(coords) {
      if (coords == null) return null;
      let c = coords;
      if (typeof c === 'string') {
        try {
          c = JSON.parse(c);
        } catch {
          return null;
        }
      }
      if (typeof c !== 'object') return null;
      const lat = Number(c.lat ?? c.latitude);
      const lng = Number(c.lng ?? c.longitude ?? c.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }

    const locMap = {};
    (uploads || []).forEach((u) => {
      const pt = parseUploadCoords(u.coords);
      if (!pt) return;
      const key = `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`;
      const typeLabel = u.type ? String(u.type).split('/')[0] || 'file' : 'upload';
      if (!locMap[key]) {
        locMap[key] = { _id: { lat: pt.lat, lng: pt.lng }, count: 0, types: [] };
      }
      locMap[key].count++;
      if (!locMap[key].types.includes(typeLabel)) {
        locMap[key].types.push(typeLabel);
      }
    });
    const locationActivity = Object.values(locMap).sort((a, b) => b.count - a.count).slice(0, 20);

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

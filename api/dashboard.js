import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import {
  getDailySalesSQL,
  getMonthlySalesSQL,
  getTaskCompletionRatesSQL,
  getProductPerformanceSQL,
} from './_lib/analytics.js';

// ── Health Check (public) ──
async function handleHealth(req, res) {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
}

// ── Dashboard Stats ──
async function handleStats(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const userRole = req.user?.role;
  const userId = req.user?.id;

  let uploadsQuery = supabase.from('uploads').select('coords, type, user_id');
  if (userRole === 'sales') {
    uploadsQuery = uploadsQuery.eq('user_id', userId);
  }

  const [
    dailySalesResult, monthlySalesResult, completionResult, productResult,
    { data: uploads }, { data: users },
  ] = await Promise.all([
    getDailySalesSQL(7, userRole === 'sales' ? userId : null), 
    getMonthlySalesSQL(12, userRole === 'sales' ? userId : null), 
    getTaskCompletionRatesSQL(userRole === 'sales' ? userId : null),
    getProductPerformanceSQL(10, userRole === 'sales' ? userId : null),
    uploadsQuery,
    supabase.from('users').select('id, code'),
  ]);

  let tasksQuery = supabase.from('tasks').select('status');
  if (userRole === 'sales') {
    tasksQuery = tasksQuery.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
  }
  const { data: taskStatRows } = await tasksQuery;
  const taskStats = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
  (taskStatRows || []).forEach(t => { if (taskStats[t.status] !== undefined) taskStats[t.status]++; });

  const totalRevenue = dailySalesResult.reduce((sum, d) => sum + d.revenue, 0);
  const totalInvoices = dailySalesResult.reduce((sum, d) => sum + d.count, 0);
  const allTimeRevenue = monthlySalesResult.reduce((sum, m) => sum + m.revenue, 0);
  const allTimeInvoices = monthlySalesResult.reduce((sum, m) => sum + m.count, 0);

  const salesStats = {
    totalRevenue: allTimeRevenue, totalInvoices: allTimeInvoices,
    averageInvoice: allTimeInvoices > 0 ? Number((allTimeRevenue / allTimeInvoices).toFixed(2)) : 0,
    last7DaysRevenue: totalRevenue, last7DaysInvoices: totalInvoices,
  };

  const dailySales = dailySalesResult.map(d => ({ _id: { year: d.year, month: d.month, day: d.day }, revenue: d.revenue, count: d.count }));
  const monthlySales = monthlySalesResult.map(m => ({ _id: { year: m.year, month: m.month }, revenue: m.revenue, count: m.count }));

  const employeeActivity = completionResult.byUser.map(u => ({
    _id: u.userId, name: u.userName, code: u.userCode,
    completedTasks: u.completed, totalTasks: u.total, completionRate: u.rate,
  })).sort((a, b) => b.completedTasks - a.completedTasks);

  const taskCompletion = completionResult.overall;
  const productPerformance = productResult;

  function parseUploadCoords(coords) {
    if (coords == null) return null;
    let c = coords;
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
    if (typeof c !== 'object') return null;
    const lat = Number(c.lat ?? c.latitude);
    const lng = Number(c.lng ?? c.longitude ?? c.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  const userMap = {};
  (users || []).forEach(u => userMap[u.id] = u.code || '');

  const locMap = {};
  (uploads || []).forEach(u => {
    const uCode = userMap[u.user_id] || '';
    if (uCode.toLowerCase().includes('admin')) return;
    const pt = parseUploadCoords(u.coords);
    if (!pt) return;
    const key = `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`;
    const typeLabel = u.type ? String(u.type).split('/')[0] || 'file' : 'upload';
    if (!locMap[key]) locMap[key] = { _id: { lat: pt.lat, lng: pt.lng }, count: 0, types: [] };
    locMap[key].count++;
    if (!locMap[key].types.includes(typeLabel)) locMap[key].types.push(typeLabel);
  });
  const locationActivity = Object.values(locMap).sort((a, b) => b.count - a.count).slice(0, 20);

  const end = new Date();
  return res.status(200).json({
    taskStats, taskCompletion, salesStats, dailySales, monthlySales,
    employeeActivity, productPerformance, locationActivity,
    dateRange: { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: end.toISOString() },
  });
}

// ── Dashboard Activity Feed ──
async function handleActivity(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { limit } = req.query || {};
  const queryLimit = Number(limit) || 20;

  const userRole = req.user?.role;
  const userId = req.user?.id;

  let query = supabase.from('activity_logs').select('*');
  if (userRole === 'sales') {
    query = query.eq('actor_id', userId);
  }
  
  const { data: logs, error: logsError } = await query.order('created_at', { ascending: false }).limit(queryLimit);
  if (logsError) throw logsError;

  const { data: users, error: usersError } = await supabase.from('users').select('id, name');
  if (usersError) throw usersError;

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  const formattedLogs = logs.map(al => ({
    _id: al.id, type: al.type, action: al.action, ref_id: al.ref_id, ref_type: al.ref_type,
    meta: al.meta, timestamp: al.created_at, user: userMap[al.actor_id] || 'Unknown'
  }));

  return res.json(formattedLogs);
}

// ── Activity Logs (full, paginated) ──
async function handleActivityLogs(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type, actor, ref_id, ref_type, limit = 50, page = 1 } = req.query || {};
  const userRole = req.user?.role;
  const userId = req.user?.id;
  const pageSize = Math.min(Number(limit) || 50, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * pageSize;

  let query = supabase.from('activity_logs').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

  if (userRole === 'sales') query = query.eq('actor_id', userId);
  else if (actor) query = query.eq('actor_id', actor);
  if (type) query = query.eq('type', type);
  if (ref_id) query = query.eq('ref_id', ref_id);
  if (ref_type) query = query.eq('ref_type', ref_type);

  const { data: logs, error: logsErr, count } = await query;
  if (logsErr) throw logsErr;

  const actorIds = [...new Set((logs || []).map(l => l.actor_id).filter(Boolean))];
  let userMap = {};
  if (actorIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, name, role, code').in('id', actorIds);
    (users || []).forEach(u => { userMap[u.id] = u; });
  }

  const formatted = (logs || []).map(log => {
    const act = log.actor_id ? userMap[log.actor_id] : null;
    return {
      _id: log.id, type: log.type, action: log.action, refId: log.ref_id, refType: log.ref_type,
      meta: log.meta || {}, timestamp: log.created_at,
      actor: act ? { id: act.id, name: act.name, role: act.role, code: act.code }
                 : { id: log.actor_id, name: 'Unknown', role: null, code: null },
    };
  });

  return res.status(200).json({
    logs: formatted,
    pagination: { total: count || 0, page: Number(page) || 1, pageSize, totalPages: count ? Math.ceil(count / pageSize) : 0 },
  });
}

// ── Analytics: Sales ──
async function handleAnalyticsSales(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { period = 'daily', days = 7, months = 12, limit = 10 } = req.query || {};

  if (period === 'monthly') {
    const monthlyData = await getMonthlySalesSQL(Number(months));
    const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
    const totalInvoices = monthlyData.reduce((sum, m) => sum + m.count, 0);

    return res.status(200).json({
      period: 'monthly',
      data: monthlyData.map(m => ({ _id: { year: m.year, month: m.month }, revenue: m.revenue, count: m.count, topRep: m.topRep })),
      summary: { totalRevenue, totalInvoices, averageMonthlyRevenue: monthlyData.length > 0 ? Number((totalRevenue / monthlyData.length).toFixed(2)) : 0 },
    });
  }

  const [dailyData, productData] = await Promise.all([getDailySalesSQL(Number(days)), getProductPerformanceSQL(Number(limit))]);
  const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalInvoices = dailyData.reduce((sum, d) => sum + d.count, 0);

  return res.status(200).json({
    period: 'daily',
    data: dailyData.map(d => ({ _id: { year: d.year, month: d.month, day: d.day }, date: d.date, revenue: d.revenue, count: d.count, topRep: d.topRep })),
    productPerformance: productData,
    summary: {
      totalRevenue, totalInvoices,
      averageDailyRevenue: dailyData.length > 0 ? Number((totalRevenue / dailyData.length).toFixed(2)) : 0,
      peakDay: dailyData.length > 0 ? dailyData.reduce((max, d) => d.revenue > max.revenue ? d : max, dailyData[0]) : null,
    },
  });
}

// ── Analytics: Tasks ──
async function handleAnalyticsTasks(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { overall, byUser } = await getTaskCompletionRatesSQL();
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('status');
  if (tErr) throw tErr;

  const statusBreakdown = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
  (tasks || []).forEach(t => { if (statusBreakdown[t.status] !== undefined) statusBreakdown[t.status]++; });

  return res.status(200).json({ overall, byUser, statusBreakdown });
}

// ── Notifications ──
async function handleNotifications(req, res) {
  const { method } = req;
  const userId = req.user?.id;

  if (method === 'GET') {
    const { unread } = req.query || {};
    let query = supabase.from('notifications').select('*').eq('user_id', userId);
    if (unread === 'true') query = query.eq('read', false);
    query = query.order('created_at', { ascending: false }).limit(50);

    const { data, error } = await query;
    if (error) throw error;

    const formatted = data.map(n => ({
      _id: n.id, type: n.type, title: n.title, message: n.message,
      refId: n.ref_id, refType: n.ref_type, read: n.read, createdAt: n.created_at
    }));
    return res.status(200).json(formatted);
  }

  if (method === 'PATCH') {
    let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const notifId = body?.notificationId || body?.id;
    if (!notifId) return res.status(400).json({ error: 'Notification ID required' });

    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notifId).eq('user_id', userId);
    if (error) throw error;
    return res.status(200).json({ message: 'Notification marked as read' });
  }

  return res.status(405).end();
}

// ── Router ──
async function handler(req, res) {
  const view = req.query?.view || '';

  try {
    switch (view) {
      case 'health':          return await handleHealth(req, res);
      case 'stats':           return await handleStats(req, res);
      case 'activity':        return await handleActivity(req, res);
      case 'activity-logs':   return await handleActivityLogs(req, res);
      case 'analytics-sales': return await handleAnalyticsSales(req, res);
      case 'analytics-tasks': return await handleAnalyticsTasks(req, res);
      case 'notifications':   return await handleNotifications(req, res);
      default:
        // Legacy: no ?view= param — serve full dashboard stats (backward compat)
        return await handleStats(req, res);
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default async function(req, res) {
  const view = req.query?.view || '';
  if (view === 'health') return handler(req, res);
  return withAuth(handler)(req, res);
}

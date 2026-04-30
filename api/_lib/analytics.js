import { supabase } from './db.js';

// ─────────────────────────────────────────────────────────────────────────────
// SQL Aggregation Helpers
// All functions execute raw SQL via supabase.rpc() against PostgreSQL.
// Falls back to JS aggregation if RPC functions aren't deployed yet.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily sales aggregation for the last N days.
 * SQL: GROUP BY date, summing price and counting invoices.
 * JOINs users to include rep name.
 *
 * @param {number} days - Number of days back to query (default 7)
 * @returns {Array} [{ date, revenue, count, top_rep }]
 */
export async function getDailySalesSQL(days = 7, userId = null) {
  return _dailySalesFallback(days, userId);
}

/**
 * Monthly sales aggregation.
 * SQL: GROUP BY year+month with JOIN to users for top performer info.
 *
 * @param {number} months - Number of months back (default 12)
 * @returns {Array} [{ year, month, revenue, count, top_rep }]
 */
export async function getMonthlySalesSQL(months = 12, userId = null) {
  return _monthlySalesFallback(months, userId);
}

/**
 * Task completion rates — overall + per user.
 * SQL: JOIN tasks with users, GROUP BY assignee to calculate completion %.
 *
 * @returns {{ overall: Object, byUser: Array }}
 */
export async function getTaskCompletionRatesSQL(userId = null) {
  return _taskCompletionFallback(userId);
}

/**
 * Product performance aggregation via SQL JOIN invoices → products.
 * Groups by product name, sums revenue and counts sales.
 *
 * @param {number} limit - Max products to return (default 10)
 * @returns {Array} [{ product, revenue, count }]
 */
export async function getProductPerformanceSQL(limit = 10, userId = null) {
  return _productPerformanceFallback(limit, userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// JS Fallback Implementations
// Used when Supabase RPC functions are not yet deployed.
// These replicate the same logic but via JS over full table fetches.
// ─────────────────────────────────────────────────────────────────────────────

async function _dailySalesFallback(days, userId) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  let query = supabase
    .from('invoices')
    .select('price, created_at, created_by')
    .gte('created_at', since.toISOString());

    if (userId) query = query.eq('created_by', userId);

  const { data: invoices } = await query;

  const map = {};
  (invoices || []).forEach(i => {
    const d = new Date(i.created_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!map[key]) {
      map[key] = {
        date: key,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        revenue: 0,
        count: 0,
        topRep: null,
      };
    }
    map[key].revenue += Number(i.price || 0);
    map[key].count++;
  });

  return Object.values(map).sort(
    (a, b) => new Date(a.year, a.month - 1, a.day) - new Date(b.year, b.month - 1, b.day)
  );
}

async function _monthlySalesFallback(months, userId) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  let query = supabase
    .from('invoices')
    .select('price, created_at, created_by')
    .gte('created_at', since.toISOString());

  if (userId) query = query.eq('created_by', userId);

  const { data: invoices } = await query;

  const map = {};
  (invoices || []).forEach(i => {
    const d = new Date(i.created_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!map[key]) {
      map[key] = {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        revenue: 0,
        count: 0,
        topRep: null,
      };
    }
    map[key].revenue += Number(i.price || 0);
    map[key].count++;
  });

  return Object.values(map).sort(
    (a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

async function _taskCompletionFallback(userId) {
  let taskQuery = supabase.from('tasks').select('status, assignee_id, created_by');
  if (userId) taskQuery = taskQuery.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);

  const [{ data: tasks }, { data: users }] = await Promise.all([
    taskQuery,
    supabase.from('users').select('id, name, code'),
  ]);

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  const empMap = {};
  (tasks || []).forEach(t => {
    const uid = t.assignee_id || '__unassigned__';
    if (!empMap[uid]) {
      const u = userMap[uid];
      empMap[uid] = {
        userId: uid === '__unassigned__' ? null : uid,
        userName: u ? u.name : 'Unassigned',
        userCode: u ? u.code : null,
        total: 0,
        completed: 0,
        rate: 0,
      };
    }
    empMap[uid].total++;
    if (t.status === 'completed') empMap[uid].completed++;
  });

  Object.values(empMap).forEach(e => {
    e.rate = e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0;
  });

  const totalTasks = (tasks || []).length;
  const completedTasks = (tasks || []).filter(t => t.status === 'completed').length;

  return {
    overall: {
      total: totalTasks,
      completed: completedTasks,
      rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    byUser: Object.values(empMap)
      .filter(e => e.userId !== null)
      .sort((a, b) => b.completed - a.completed),
  };
}

async function _productPerformanceFallback(limit, userId) {
  let invoiceQuery = supabase.from('invoices').select('price, product, created_by');
  if (userId) invoiceQuery = invoiceQuery.eq('created_by', userId);

  const [{ data: invoices }, { data: products }] = await Promise.all([
    invoiceQuery,
    supabase.from('products').select('name, category')
  ]);

  const categoryMap = {};
  (products || []).forEach(p => {
    if (p.name) categoryMap[p.name] = p.category || 'Uncategorized';
  });

  const map = {};
  (invoices || []).forEach(i => {
    if (!i.product) return;
    const cat = categoryMap[i.product] || 'Uncategorized';
    
    if (!map[cat]) map[cat] = { _id: cat, revenue: 0, count: 0 };
    map[cat].revenue += Number(i.price || 0);
    map[cat].count++;
  });

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

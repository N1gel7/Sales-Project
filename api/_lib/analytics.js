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
export async function getDailySalesSQL(days = 7) {
  const { data, error } = await supabase.rpc('get_daily_sales', { days_back: days });

  if (error) {
    // Fallback: JS aggregation if the RPC function is not yet deployed
    console.warn('[analytics] RPC get_daily_sales not available, falling back to JS aggregation:', error.message);
    return _dailySalesFallback(days);
  }

  return (data || []).map(row => ({
    date: row.sale_date,
    year: new Date(row.sale_date).getFullYear(),
    month: new Date(row.sale_date).getMonth() + 1,
    day: new Date(row.sale_date).getDate(),
    revenue: Number(row.revenue),
    count: Number(row.invoice_count),
    topRep: row.top_rep || null,
  }));
}

/**
 * Monthly sales aggregation.
 * SQL: GROUP BY year+month with JOIN to users for top performer info.
 *
 * @param {number} months - Number of months back (default 12)
 * @returns {Array} [{ year, month, revenue, count, top_rep }]
 */
export async function getMonthlySalesSQL(months = 12) {
  const { data, error } = await supabase.rpc('get_monthly_sales', { months_back: months });

  if (error) {
    console.warn('[analytics] RPC get_monthly_sales not available, falling back to JS aggregation:', error.message);
    return _monthlySalesFallback(months);
  }

  return (data || []).map(row => ({
    year: Number(row.sale_year),
    month: Number(row.sale_month),
    revenue: Number(row.revenue),
    count: Number(row.invoice_count),
    topRep: row.top_rep || null,
  }));
}

/**
 * Task completion rates — overall + per user.
 * SQL: JOIN tasks with users, GROUP BY assignee to calculate completion %.
 *
 * @returns {{ overall: Object, byUser: Array }}
 */
export async function getTaskCompletionRatesSQL() {
  const { data, error } = await supabase.rpc('get_task_completion_rates');

  if (error) {
    console.warn('[analytics] RPC get_task_completion_rates not available, falling back to JS aggregation:', error.message);
    return _taskCompletionFallback();
  }

  const overall = data.find(r => r.user_id === null) || null;
  const byUser = data.filter(r => r.user_id !== null);

  return {
    overall: overall
      ? {
          total: Number(overall.total_tasks),
          completed: Number(overall.completed_tasks),
          rate: Number(overall.completion_rate),
        }
      : { total: 0, completed: 0, rate: 0 },
    byUser: byUser.map(r => ({
      userId: r.user_id,
      userName: r.user_name,
      userCode: r.user_code,
      total: Number(r.total_tasks),
      completed: Number(r.completed_tasks),
      rate: Number(r.completion_rate),
    })),
  };
}

/**
 * Product performance aggregation via SQL JOIN invoices → products.
 * Groups by product name, sums revenue and counts sales.
 *
 * @param {number} limit - Max products to return (default 10)
 * @returns {Array} [{ product, revenue, count }]
 */
export async function getProductPerformanceSQL(limit = 10) {
  const { data, error } = await supabase.rpc('get_product_performance', { row_limit: limit });

  if (error) {
    console.warn('[analytics] RPC get_product_performance not available, falling back to JS aggregation:', error.message);
    return _productPerformanceFallback(limit);
  }

  return (data || []).map(row => ({
    _id: row.product_name,
    revenue: Number(row.revenue),
    count: Number(row.invoice_count),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// JS Fallback Implementations
// Used when Supabase RPC functions are not yet deployed.
// These replicate the same logic but via JS over full table fetches.
// ─────────────────────────────────────────────────────────────────────────────

async function _dailySalesFallback(days) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('price, created_at, created_by')
    .gte('created_at', since.toISOString());

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

async function _monthlySalesFallback(months) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('price, created_at')
    .gte('created_at', since.toISOString());

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

async function _taskCompletionFallback() {
  const [{ data: tasks }, { data: users }] = await Promise.all([
    supabase.from('tasks').select('status, assignee_id'),
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

async function _productPerformanceFallback(limit) {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('price, product');

  const map = {};
  (invoices || []).forEach(i => {
    if (!i.product) return;
    if (!map[i.product]) map[i.product] = { _id: i.product, revenue: 0, count: 0 };
    map[i.product].revenue += Number(i.price || 0);
    map[i.product].count++;
  });

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

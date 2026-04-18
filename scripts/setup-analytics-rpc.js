/**
 * scripts/setup-analytics-rpc.js
 *
 * Deploys the PostgreSQL functions (RPCs) used by the SQL analytics layer.
 * Run this ONCE after init-db.js to register the functions in your Supabase/PG instance.
 *
 * Usage:
 *   node scripts/setup-analytics-rpc.js
 *
 * These functions are called via supabase.rpc() in api/_lib/analytics.js.
 * If not deployed, the analytics module falls back to JS aggregation automatically.
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function setupAnalyticsRPC() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  console.log('🔧 Registering SQL Analytics RPC functions...\n');

  try {
    // ── 1. activity_logs: performance indexes ─────────────────────────────────
    console.log('📌 Creating activity_logs indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id
        ON activity_logs (actor_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_type
        ON activity_logs (type);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_ref_id
        ON activity_logs (ref_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
        ON activity_logs (created_at DESC);
    `);
    // Composite: actor + time — speeds up "recent actions by user" queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_time
        ON activity_logs (actor_id, created_at DESC);
    `);
    console.log('  ✅ activity_logs indexes created.\n');

    // ── 2. invoices: date index for GROUP BY aggregations ────────────────────
    console.log('📌 Creating invoices performance indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at
        ON invoices (created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_created_by
        ON invoices (created_by);
    `);
    console.log('  ✅ invoices indexes created.\n');

    // ── 3. tasks: status + assignee indexes ──────────────────────────────────
    console.log('📌 Creating tasks performance indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status
        ON tasks (status);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id
        ON tasks (assignee_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
        ON tasks (assignee_id, status);
    `);
    console.log('  ✅ tasks indexes created.\n');

    // ────────────────────────────────────────────────────────────────────────
    // RPC FUNCTION 1: get_daily_sales(days_back INT)
    // Returns daily revenue aggregated via GROUP BY date(created_at)
    // JOINs invoices with users to find top rep (most invoices) per day.
    // ────────────────────────────────────────────────────────────────────────
    console.log('📌 Creating RPC: get_daily_sales...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_daily_sales(days_back INT DEFAULT 7)
      RETURNS TABLE (
        sale_date    DATE,
        revenue      NUMERIC,
        invoice_count BIGINT,
        top_rep      TEXT
      )
      LANGUAGE sql
      STABLE
      AS $$
        WITH
          -- Aggregate revenue and count per day
          daily AS (
            SELECT
              DATE(created_at)        AS sale_date,
              SUM(price)              AS revenue,
              COUNT(*)                AS invoice_count
            FROM invoices
            WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
            GROUP BY DATE(created_at)
          ),
          -- Find top rep (by invoice count) per day using LEFT JOIN to users
          rep_rank AS (
            SELECT
              DATE(i.created_at)  AS sale_date,
              u.name              AS rep_name,
              COUNT(*)            AS rep_count,
              ROW_NUMBER() OVER (
                PARTITION BY DATE(i.created_at)
                ORDER BY COUNT(*) DESC
              )                   AS rn
            FROM invoices i
            LEFT JOIN users u ON u.id = i.created_by
            WHERE i.created_at >= NOW() - (days_back || ' days')::INTERVAL
            GROUP BY DATE(i.created_at), u.name
          )
        SELECT
          d.sale_date,
          d.revenue,
          d.invoice_count,
          r.rep_name AS top_rep
        FROM daily d
        LEFT JOIN rep_rank r
          ON r.sale_date = d.sale_date AND r.rn = 1
        ORDER BY d.sale_date ASC;
      $$;
    `);
    console.log('  ✅ get_daily_sales created.\n');

    // ────────────────────────────────────────────────────────────────────────
    // RPC FUNCTION 2: get_monthly_sales(months_back INT)
    // Returns monthly revenue aggregated via GROUP BY year + month
    // JOINs invoices with users to find top rep per month.
    // ────────────────────────────────────────────────────────────────────────
    console.log('📌 Creating RPC: get_monthly_sales...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_monthly_sales(months_back INT DEFAULT 12)
      RETURNS TABLE (
        sale_year     INT,
        sale_month    INT,
        revenue       NUMERIC,
        invoice_count BIGINT,
        top_rep       TEXT
      )
      LANGUAGE sql
      STABLE
      AS $$
        WITH
          monthly AS (
            SELECT
              EXTRACT(YEAR  FROM created_at)::INT  AS sale_year,
              EXTRACT(MONTH FROM created_at)::INT  AS sale_month,
              SUM(price)                            AS revenue,
              COUNT(*)                              AS invoice_count
            FROM invoices
            WHERE created_at >= NOW() - (months_back || ' months')::INTERVAL
            GROUP BY sale_year, sale_month
          ),
          rep_rank AS (
            SELECT
              EXTRACT(YEAR  FROM i.created_at)::INT AS sale_year,
              EXTRACT(MONTH FROM i.created_at)::INT AS sale_month,
              u.name                                 AS rep_name,
              COUNT(*)                               AS rep_count,
              ROW_NUMBER() OVER (
                PARTITION BY
                  EXTRACT(YEAR FROM i.created_at)::INT,
                  EXTRACT(MONTH FROM i.created_at)::INT
                ORDER BY COUNT(*) DESC
              )                                      AS rn
            FROM invoices i
            LEFT JOIN users u ON u.id = i.created_by
            WHERE i.created_at >= NOW() - (months_back || ' months')::INTERVAL
            GROUP BY 
              EXTRACT(YEAR FROM i.created_at)::INT,
              EXTRACT(MONTH FROM i.created_at)::INT, 
              u.name
          )
        SELECT
          m.sale_year,
          m.sale_month,
          m.revenue,
          m.invoice_count,
          r.rep_name AS top_rep
        FROM monthly m
        LEFT JOIN rep_rank r
          ON r.sale_year = m.sale_year
         AND r.sale_month = m.sale_month
         AND r.rn = 1
        ORDER BY m.sale_year ASC, m.sale_month ASC;
      $$;
    `);
    console.log('  ✅ get_monthly_sales created.\n');

    // ────────────────────────────────────────────────────────────────────────
    // RPC FUNCTION 3: get_task_completion_rates()
    // Returns task completion rates per user (JOIN tasks ↔ users) + overall row.
    // Overall row has user_id = NULL.
    // ────────────────────────────────────────────────────────────────────────
    console.log('📌 Creating RPC: get_task_completion_rates...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_task_completion_rates()
      RETURNS TABLE (
        user_id         UUID,
        user_name       TEXT,
        user_code       TEXT,
        total_tasks     BIGINT,
        completed_tasks BIGINT,
        completion_rate NUMERIC
      )
      LANGUAGE sql
      STABLE
      AS $$
        -- Per-user completion rates via JOIN tasks ↔ users
        SELECT
          u.id                                       AS user_id,
          u.name                                     AS user_name,
          u.code                                     AS user_code,
          COUNT(t.id)                                AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
          CASE
            WHEN COUNT(t.id) = 0 THEN 0
            ELSE ROUND(
              100.0 * COUNT(t.id) FILTER (WHERE t.status = 'completed') / COUNT(t.id),
              1
            )
          END                                        AS completion_rate
        FROM users u
        LEFT JOIN tasks t ON t.assignee_id = u.id
        WHERE u.active = TRUE
        GROUP BY u.id, u.name, u.code

        UNION ALL

        -- Overall system-wide row (user_id = NULL acts as sentinel)
        SELECT
          NULL                                       AS user_id,
          'Overall'                                  AS user_name,
          NULL                                       AS user_code,
          COUNT(*)                                   AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*),
              1
            )
          END                                        AS completion_rate
        FROM tasks;
      $$;
    `);
    console.log('  ✅ get_task_completion_rates created.\n');

    // ────────────────────────────────────────────────────────────────────────
    // RPC FUNCTION 4: get_product_performance(row_limit INT)
    // Aggregates revenue and count per product name via GROUP BY.
    // ────────────────────────────────────────────────────────────────────────
    console.log('📌 Creating RPC: get_product_performance...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_product_performance(row_limit INT DEFAULT 10)
      RETURNS TABLE (
        product_name  TEXT,
        revenue       NUMERIC,
        invoice_count BIGINT
      )
      LANGUAGE sql
      STABLE
      AS $$
        SELECT
          product                    AS product_name,
          SUM(price)                 AS revenue,
          COUNT(*)                   AS invoice_count
        FROM invoices
        WHERE product IS NOT NULL
        GROUP BY product
        ORDER BY revenue DESC
        LIMIT row_limit;
      $$;
    `);
    console.log('  ✅ get_product_performance created.\n');

    console.log('🎉 All SQL analytics RPC functions registered successfully!');
    console.log('\nThese functions are now callable via supabase.rpc() in api/_lib/analytics.js.');
    console.log('Endpoints available:');
    console.log('  GET /api/analytics/sales?period=daily&days=7');
    console.log('  GET /api/analytics/sales?period=monthly&months=12');
    console.log('  GET /api/analytics/tasks');
    console.log('  GET /api/dashboard/stats  (now uses SQL aggregation)');

  } catch (err) {
    console.error('❌ Failed to register analytics RPCs:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setupAnalyticsRPC();

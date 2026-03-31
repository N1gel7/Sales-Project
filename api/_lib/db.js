import pkg from 'pg';
const { Pool } = pkg;

// Use neon/supabase connection string or local postgres
const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
  pool = new Pool({
    connectionString,
    // Add ssl connection for external databases like Supabase or Neon.
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });
} else {
  console.warn('⚠️ No DATABASE_URL found in environment variables. Database queries will fail.');
  // Create a dummy pool that throws an error to avoid crashing the whole app immediately on load,
  // but instead fails when a query is actually attempted.
  pool = {
    query: async () => {
      throw new Error('Database not configured. Please set DATABASE_URL in .env');
    }
  };
}

/**
 * Returns the database pool for executing queries
 */
export function getDbPool() {
  return pool;
}

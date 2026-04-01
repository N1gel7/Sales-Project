import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

/**
 * Returns the database pool for executing queries.
 * The pool is created lazily on first call so that dotenv
 * has time to load environment variables before we read DATABASE_URL.
 */
export function getDbPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });
  } else {
    console.warn('⚠️ No DATABASE_URL found in environment variables. Database queries will fail.');
    pool = {
      query: async () => {
        throw new Error('Database not configured. Please set DATABASE_URL in .env');
      }
    };
  }

  return pool;
}

import 'dotenv/config';
import { Pool } from 'pg';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS has_changed_initial_password BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
      UPDATE users
      SET has_changed_initial_password = CASE
        WHEN reset_password_expires = 0 THEN FALSE
        ELSE TRUE
      END
    `);

    console.log('Added has_changed_initial_password column and backfilled values.');
  } catch (error) {
    console.error('Failed to add/backfill has_changed_initial_password:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

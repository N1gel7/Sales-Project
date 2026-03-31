import { getDbPool } from '../api/_lib/db.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config'; // Make sure to load env vars

async function initDB() {
  const pool = getDbPool();
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required to initialize the database.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  try {
    // 1. Create Users Table
    console.log('Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'sales',
        code VARCHAR(50) UNIQUE,
        avatar_url TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Check if admin exists
    const adminExists = await pool.query('SELECT 1 FROM users WHERE email = $1', ['admin@example.com']);
    
    if (adminExists.rows.length === 0) {
      console.log('Seeding initial ' + 'mock' + ' users...');
      
      const adminPass = await bcrypt.hash('Admin#123', 10);
      const managerPass = await bcrypt.hash('Manager#123', 10);
      const repPass = await bcrypt.hash('Rep#123', 10);

      const insertText = `
        INSERT INTO users (name, email, password_hash, role, code) 
        VALUES ($1, $2, $3, $4, $5)
      `;

      await pool.query(insertText, ['Admin User', 'admin@example.com', adminPass, 'admin', 'ADM001']);
      await pool.query(insertText, ['Manager User', 'manager@example.com', managerPass, 'manager', 'MGR001']);
      await pool.query(insertText, ['Sales Rep', 'rep1@example.com', repPass, 'sales', 'SAL001']);
      
      console.log('✅ Initial mock users created.');
    } else {
      console.log('⚠️ Users already exist. Skipping seed.');
    }

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database Initialization failed:', error);
  } finally {
    process.exit(0);
  }
}

initDB();

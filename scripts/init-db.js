import 'dotenv/config'; // Load env vars FIRST
import { getDbPool } from '../api/_lib/db.js';
import bcrypt from 'bcryptjs';

async function initDB() {
  const pool = getDbPool();
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required to initialize the database.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  try {
    // ─────────────────────────────────────────────
    // 1. Users (UUID primary key to match Supabase)
    // ─────────────────────────────────────────────
    console.log('Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id uuid not null default gen_random_uuid (),
        name character varying(255) not null,
        email character varying(255) not null,
        password_hash character varying(255) not null,
        role character varying(50) null default 'sales'::character varying,
        code character varying(50) null,
        avatar_url text null,
        active boolean null default true,
        reset_password_token character varying(255) null,
        reset_password_expires bigint null,
        created_at timestamp with time zone null default CURRENT_TIMESTAMP,
        updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
        constraint users_pkey primary key (id),
        constraint users_code_key unique (code),
        constraint users_email_key unique (email)
      ) TABLESPACE pg_default;
    `);

    // ─────────────────────────────────────────────
    // 2. Categories
    // ─────────────────────────────────────────────
    console.log('Creating categories table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        fields JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 3. Products
    // ─────────────────────────────────────────────
    console.log('Creating products table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        details TEXT,
        attributes JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 4. Tasks
    // ─────────────────────────────────────────────
    console.log('Creating tasks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        category VARCHAR(255),
        due_at TIMESTAMP WITH TIME ZONE,
        comments JSONB DEFAULT '[]',
        location JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location JSONB`);

    // ─────────────────────────────────────────────
    // 5. Invoices
    // ─────────────────────────────────────────────
    console.log('Creating invoices table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client VARCHAR(255) NOT NULL,
        product VARCHAR(255) NOT NULL,
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        location JSONB,
        emailed BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 6. Uploads
    // ─────────────────────────────────────────────
    console.log('Creating uploads table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        type VARCHAR(255),
        note TEXT,
        file_url TEXT,
        transcription TEXT,
        translation TEXT,
        coords JSONB,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 7. Activity Logs
    // ─────────────────────────────────────────────
    console.log('Creating activity_logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(255) NOT NULL,
        action TEXT,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ref_id UUID,
        ref_type VARCHAR(255),
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 8. Chats
    // ─────────────────────────────────────────────
    console.log('Creating chats table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'group',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        participants JSONB DEFAULT '[]',
        last_message JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 9. Messages
    // ─────────────────────────────────────────────
    console.log('Creating messages table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        read_by JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 10. Reports
    // ─────────────────────────────────────────────
    console.log('Creating reports table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100) DEFAULT 'sales_report',
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        attachments JSONB DEFAULT '[]',
        tags TEXT[] DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'draft',
        visibility VARCHAR(50) DEFAULT 'team',
        comments JSONB DEFAULT '[]',
        likes JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // 11. Notifications
    // ─────────────────────────────────────────────
    console.log('Creating notifications table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        ref_id UUID,
        ref_type VARCHAR(100),
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────
    // Seed Initial Users
    // ─────────────────────────────────────────────
    const adminExists = await pool.query('SELECT 1 FROM users WHERE email = $1', ['admin@example.com']);
    
    if (adminExists.rows.length === 0) {
      console.log('Seeding initial mock users...');
      
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

    // ─────────────────────────────────────────────
    // Seed Initial Categories
    // ─────────────────────────────────────────────
    const catExists = await pool.query('SELECT 1 FROM categories LIMIT 1');
    if (catExists.rows.length === 0) {
      console.log('Seeding initial categories...');
      await pool.query(`INSERT INTO categories (name, fields) VALUES ($1, $2)`, ['Electronics', '[]']);
      await pool.query(`INSERT INTO categories (name, fields) VALUES ($1, $2)`, ['Furniture', '[]']);
      await pool.query(`INSERT INTO categories (name, fields) VALUES ($1, $2)`, ['Clothing', '[]']);
      console.log('✅ Initial categories created.');
    }

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database Initialization failed:', error);
  } finally {
    process.exit(0);
  }
}

initDB();

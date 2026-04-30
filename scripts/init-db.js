import 'dotenv/config'; // Load env vars FIRST
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required to initialize the database.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to database...');
  
  try {
    // 1. Users
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
        has_changed_initial_password boolean not null default false,
        reset_password_token character varying(255) null,
        reset_password_expires bigint null,
        created_at timestamp with time zone null default CURRENT_TIMESTAMP,
        updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
        constraint users_pkey primary key (id),
        constraint users_code_key unique (code),
        constraint users_email_key unique (email)
      ) TABLESPACE pg_default;
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_changed_initial_password BOOLEAN NOT NULL DEFAULT FALSE`);

    // 2. Categories
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

    // 3. Products
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

    // 4. Tasks
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

    // 5. Invoices
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
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_to VARCHAR(255)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_subject VARCHAR(255)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_message TEXT`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE`);

    // 6. Uploads
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

    // 7. Activity Logs
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

    // Performance indexes for activity_logs —
    // speeds up: feed queries (actor + time), type filters, and ref lookups
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id    ON activity_logs (actor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_type         ON activity_logs (type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_ref_id       ON activity_logs (ref_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at   ON activity_logs (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_time   ON activity_logs (actor_id, created_at DESC)`);

    // 8. Chats
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

    // 9. Messages
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

    // 10. Reports
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

    // 11. Notifications
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

    // Performance Indexes (Analytics)
    console.log('Creating analytics performance indexes...');
    // invoices: date-range grouping and rep attribution
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_created_at  ON invoices (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_created_by  ON invoices (created_by)`);
    // tasks: status filtering and per-assignee completion queries
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks (status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id     ON tasks (assignee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks (assignee_id, status)`);
    console.log('✅ Analytics indexes created.');

    console.log('\n💡 Next step: run   node scripts/setup-analytics-rpc.js');
    console.log('   This registers the SQL RPC functions (get_daily_sales, get_monthly_sales,');
    console.log('   get_task_completion_rates, get_product_performance) used by /api/analytics/*.');
    console.log('   Without it, the endpoints fall back to JavaScript aggregation automatically.\n');


    // Seed Initial Categories
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
    await pool.end();
    process.exit(0);
  }
}

initDB();

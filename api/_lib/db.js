import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Initialize Supabase admin client (bypasses RLS for backend operations)
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
  auth: { persistSession: false }
});

// Deprecated: kept for compatibility during migration, but endpoints will be rewritten to import supabase directly
export function getDbPool() {
  return supabase;
}

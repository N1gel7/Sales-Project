import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Use the service role key for backend operations to bypass RLS
// or anon key if preferred. Service role is safer for backend mutations on Users.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase URL or Key is missing from environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

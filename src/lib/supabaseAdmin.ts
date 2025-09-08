import { createClient } from '@supabase/supabase-js';
if (import.meta.env.SSR !== true) throw new Error('Admin client must be server-only');

export const supabaseAdmin = createClient(
  import.meta.env.SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

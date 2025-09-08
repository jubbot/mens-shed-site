import { createBrowserClient } from '@supabase/ssr';
// import type { Database } from '../types/supabase';

const PUBLIC_SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
}

/** Primary browser client — use this everywhere in client-side scripts/components */
export const supabase = createBrowserClient/*<Database>*/(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
);

/** Backward-compat alias (matches your existing `header-auth.ts` import) */
export const supabaseBrowser = supabase;

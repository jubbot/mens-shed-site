// src/lib/supabaseServer.ts
import { createServerClient } from '@supabase/ssr';
import type { APIContext } from 'astro';
// import type { Database } from '../types/supabase';

export function getSupabaseServerClient(opts: {
  request: Request;
  cookies: APIContext['cookies'];
}) {
  const url = import.meta.env.SUPABASE_URL!;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY!;
  return createServerClient/*<Database>*/(url, anonKey, {
    cookies: {
      get: (key) => opts.cookies.get(key)?.value,
      set: (key, value, options) => opts.cookies.set(key, value, options),
      remove: (key, options) => opts.cookies.delete(key, options),
    },
    request: opts.request,
  });
}

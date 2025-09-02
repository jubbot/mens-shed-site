// src/lib/supabaseServer.ts
import { createServerClient } from '@supabase/ssr';
import type { AstroGlobal } from 'astro';

export function getSupabaseServerClient({
  request, cookies,
}: { request: Request; cookies: AstroGlobal['cookies'] }) {
  // SSR client: reads/writes session cookies so you get the logged-in user
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookies.get(key)?.value,
        set: (key, value, options) => cookies.set(key, value, options),
        remove: (key, options) => cookies.delete(key, options),
      },
    }
  );
}

// SSR client bound to cookies (for getUser in middleware & API guards)
import { createServerClient } from '@supabase/ssr';
import type { AstroGlobal } from 'astro';

export function getSupabaseServerClient({ request, cookies }: { request: Request; cookies: AstroGlobal['cookies'] }) {
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

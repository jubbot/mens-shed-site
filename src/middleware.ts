import type { MiddlewareHandler } from 'astro';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (k) => ctx.cookies.get(k)?.value,
        set: (k, v, o) => ctx.cookies.set(k, v, o),
        remove: (k, o) => ctx.cookies.delete(k, o),
      },
      // pass through incoming headers (helps SSR libs that inspect them)
      headers: {
        get: (k: string) => ctx.request.headers.get(k) ?? undefined,
      },
    }
  ) as SupabaseClient;

  // ⬇️ This may refresh cookies. Do it BEFORE next(), while headers are writable.
  await supabase.auth.getSession();

  const { data: { user } } = await supabase.auth.getUser();

  // Make available to pages/layouts/components without re-initializing
  ctx.locals.supabase = supabase;
  ctx.locals.user = user as User | null;

if (!user && ctx.url.pathname.startsWith('/dashboard')) {
  return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
}

  return next();
};

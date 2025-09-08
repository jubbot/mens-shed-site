import type { MiddlewareHandler } from 'astro';
import { getSupabaseServerClient } from './lib/supabaseServer';

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const { request, cookies, url } = ctx;
  const accept = request.headers.get('accept') || '';
  const isPage = accept.includes('text/html');

  // Protect /dashboard routes
  if (url.pathname.startsWith('/dashboard') && isPage) {
    const supa = getSupabaseServerClient({ request, cookies });
    const { data: { user } } = await supa.auth.getUser();

    if (!user) {
      const nextParam = encodeURIComponent(url.pathname + url.search);
      return ctx.redirect(`/login?next=${nextParam}`);
    }

    // Optional extras
    if ((user.app_metadata as any)?.disabled) {
      return ctx.redirect('/login?disabled=1');
    }
    if ((user.user_metadata as any)?.must_change_password && !url.pathname.startsWith('/auth/reset')) {
      return ctx.redirect(`/auth/reset?next=${encodeURIComponent(url.pathname)}`);
    }
  }

  return next();
};

// src/middleware.ts
import type { MiddlewareHandler } from 'astro';
import { getSupabaseServerClient } from './lib/supabaseServer';

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const { request, cookies, url } = ctx;
  const path = url.pathname;

  // Only enforce on real page navigations (not assets/fetches)
  const accept = request.headers.get('accept') || '';
  const isPageNavigation = accept.includes('text/html');

  // Paths that must always pass (no loops)
  const isResetPage = path.startsWith('/auth/reset');
  const isLoginPage = path.startsWith('/login');

  // Gate /dashboard
  if (path.startsWith('/dashboard') && isPageNavigation) {
    const supa = getSupabaseServerClient({ request, cookies });
    const { data: { user } } = await supa.auth.getUser();

    // If not logged in, send to login and preserve destination
    if (!user) {
      const nextParam = encodeURIComponent(path + url.search);
      return ctx.redirect(`/login?next=${nextParam}`);
    }

    // Enforce first-login password change for temp accounts
    const mustChange =
      user.user_metadata?.must_change_password === true ||
      user.user_metadata?.must_change_password === 'true';

    if (mustChange && !isResetPage) {
      const nextParam = encodeURIComponent(path + url.search);
      return ctx.redirect(`/auth/reset?next=${nextParam}`);
    }
  }

  // Allow the reset page through so the user can complete it
  if (isResetPage) return next();

  return next();
};

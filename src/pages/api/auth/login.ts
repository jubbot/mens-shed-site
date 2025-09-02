import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supabase = getSupabaseServerClient({ request, cookies });

  // Support both form posts and JSON (like we discussed)
  let email = '';
  let password = '';
  let next = '/dashboard';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    email = body?.email ?? '';
    password = body?.password ?? '';
    next = body?.next || (new URL(url).searchParams.get('next') || '/dashboard');
  } else {
    const fd = await request.formData();
    email = String(fd.get('email') || '');
    password = String(fd.get('password') || '');
    next = String(fd.get('next') || '/dashboard');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 👇 redirect back to login with an error flash
    const dest = new URL('/login', url);
    dest.searchParams.set('flash', 'loginError');
    return redirect(dest.toString());
  }

  // Success
  const dest = new URL(next, url);
  dest.searchParams.set('flash', 'welcome');
  return redirect(dest.toString());
};

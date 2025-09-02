// src/pages/api/admin/users/reset.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, url }) => {
  const { email } = await request.json();
  const redirectTo = new URL('/auth/reset', url.origin).toString();

  // Can use anon key server-side for this helper
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

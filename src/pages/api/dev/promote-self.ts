import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const POST: APIRoute = async (ctx) => {
  // @ts-ignore
  const { request, cookies } = ctx;
  const supa = getSupabaseServerClient({ request, cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ ok:false, error:'Not signed in' }), { status: 401 });

  const allowedEmail = process.env.DEV_BOOTSTRAP_ADMIN_EMAIL;
  const mode = process.env.PUBLIC_NODE_ENV || process.env.MODE || 'development';
  const isDev = mode === 'development';
  if (!isDev || !allowedEmail || user.email !== allowedEmail) {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: { role: 'admin' } });
  if (error) return new Response(JSON.stringify({ ok:false, error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok:true }), { status: 200 });
};

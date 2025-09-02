// src/pages/api/admin/users/list.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireStaff } from '@/lib/requireStaff';

export const GET: APIRoute = async (ctx) => {
  const gate = await requireStaff(ctx);
  if (!gate.ok) return new Response(JSON.stringify({ ok:false, error:gate.error }), { status: gate.status });
  const url = new URL(ctx.request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('perPage') ?? 20)));
  const q = (url.searchParams.get('q') ?? '').toLowerCase();

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
  if (error) return new Response(JSON.stringify({ ok:false, error:error.message }), { status: 400 });

  const users = (data?.users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    email_confirmed_at: u.email_confirmed_at,
    role: (u.app_metadata as any)?.role ?? (u.user_metadata as any)?.role ?? 'member',
    disabled: (u.app_metadata as any)?.disabled ?? false,
    must_change_password: (u.user_metadata as any)?.must_change_password ?? false
  })).filter((u: any) => !q || String(u.email).toLowerCase().includes(q));

  return new Response(JSON.stringify({ ok:true, page, perPage, users }), { status: 200 });
};

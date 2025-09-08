import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../lib/supabaseServer';

export async function requireStaff(ctx: Parameters<APIRoute>[0]) {
  // @ts-ignore
  const { request, cookies } = ctx;
  const supa = getSupabaseServerClient({ request, cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { ok:false as const, status:401, error:'Not signed in' as const };
  const role = (user.app_metadata as any)?.role ?? (user.user_metadata as any)?.role;
  const disabled = (user.app_metadata as any)?.disabled === true || (user.app_metadata as any)?.disabled === 'true';
  if (disabled) return { ok:false as const, status:403, error:'Account disabled' as const };
  if (!['admin','staff'].includes(String(role))) return { ok:false as const, status:403, error:'Admin/staff only' as const };
  return { ok:true as const, user };
}

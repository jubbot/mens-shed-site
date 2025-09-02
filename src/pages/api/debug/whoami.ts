// Make sure this is at the top:
export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supa = getSupabaseServerClient({ request, cookies });

  const { data: { user }, error: userErr } = await supa.auth.getUser();

  let selfData: any = null;
  let selfErr: string | null = null;

  if (user) {
    const { data, error } = await supa
      .from('members')
      .select('id,email,role,is_active')
      .eq('id', user.id)
      .maybeSingle();
    selfData = data ?? null;
    selfErr = error?.message ?? null;
  }

  return new Response(
    JSON.stringify({ user, userErr: userErr?.message ?? null, self: selfData, selfErr }, null, 2),
    { headers: { 'content-type': 'application/json' } }
  );
};

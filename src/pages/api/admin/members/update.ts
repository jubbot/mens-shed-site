export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../../lib/supabaseServer';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supa = getSupabaseServerClient({ request, cookies });

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // We let RLS enforce who can change what (staff vs self)
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const full_name = String(form.get('full_name') ?? '').trim();
  const role = String(form.get('role') ?? 'member'); // staff-only per RLS
  const is_active = String(form.get('is_active') ?? 'true') === 'true';

  if (!id || !full_name) {
    const d = new URL(`/dashboard/members/${id}/edit`, url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg','Missing fields');
    return redirect(d.toString(), 303);
  }

  const { error } = await supa.from('members').update({ full_name, role, is_active }).eq('id', id);
  if (error) {
    const d = new URL(`/dashboard/members/${id}/edit`, url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg', error.message);
    return redirect(d.toString(), 303);
  }

  const d = new URL(`/dashboard/members/${id}/edit`, url);
  d.searchParams.set('flash','custom'); d.searchParams.set('type','success'); d.searchParams.set('msg','Saved');
  return redirect(d.toString(), 303);
};

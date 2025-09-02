import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supa = getSupabaseServerClient({ request, cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return redirect('/login');

  const fd = await request.formData();
  const id = String(fd.get('id') || '');
  const status = String(fd.get('status') || '');

  const { data: me } = await supa.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') {
    const d = new URL(url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg','Not authorized');
    return redirect(d.toString());
  }

  if (!id || !['active','paused','completed'].includes(status)) {
    const d = new URL(url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg','Invalid status');
    return redirect(d.toString());
  }

  const { error } = await supa.from('projects').update({ status }).eq('id', id);
  const back = new URL('/dashboard/projects/' + id, url); // can be slug or id; page handles both
  back.searchParams.set('flash','custom');
  if (error) {
    back.searchParams.set('type','error'); back.searchParams.set('msg','Status update failed');
  } else {
    back.searchParams.set('type','success'); back.searchParams.set('msg','Status updated');
  }
  return redirect(back.toString());
};

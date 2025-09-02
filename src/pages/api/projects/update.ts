import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';
import { WOOD_TOOLS, METAL_TOOLS } from '../../../constants/tools';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supa = getSupabaseServerClient({ request, cookies });

  // Auth + role
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return redirect('/login');

  const { data: me } = await supa.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') {
    const d = new URL('/dashboard/projects', url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg','Not authorized');
    return redirect(d.toString());
  }

  // Form
  const fd = await request.formData();
  const id  = String(fd.get('id')  || '').trim();
  const _ts = String(fd.get('_ts') || '').trim(); // the optimistic concurrency token (updated_at as returned to the client)

  const title        = String(fd.get('title') || '').trim();
  const summary      = String(fd.get('summary') || '').trim() || null;
  const category_id  = String(fd.get('category_id') || '') || null;
  const subcat_in    = String(fd.get('subcategory_id') || '') || null;
  const started_at   = String(fd.get('started_at') || '') || null;

  const volunteersRaw = Number(fd.get('volunteers'));
  const volunteers = Number.isFinite(volunteersRaw) && volunteersRaw >= 0 ? Math.floor(volunteersRaw) : 0;

  // Arrays
  const wood_tools_all  = Array.from(fd.getAll('wood_tools')).map(String);
  const metal_tools_all = Array.from(fd.getAll('metal_tools')).map(String);
  const materials = String(fd.get('materials') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  // Validate tools
  const WOOD_SET = new Set(WOOD_TOOLS);
  const METAL_SET = new Set(METAL_TOOLS);
  const wood_tools  = wood_tools_all.filter(t => WOOD_SET.has(t));
  const metal_tools = metal_tools_all.filter(t => METAL_SET.has(t));

  if (!id || !title || !category_id || !_ts) {
    const d = new URL('/dashboard/projects', url);
    d.searchParams.set('flash','custom'); d.searchParams.set('type','error'); d.searchParams.set('msg','Missing required fields');
    return redirect(d.toString());
  }

  // Optional integrity: ensure subcategory belongs to category
  let subcategory_id: string | null = subcat_in;
  if (subcategory_id) {
    const { data: sub } = await supa
      .from('project_subcategories')
      .select('parent_category')
      .eq('id', subcategory_id)
      .maybeSingle();
    if (!sub || sub.parent_category !== category_id) {
      subcategory_id = null;
    }
  }

  // ===== Optimistic concurrency guard =====
  // Update only when id AND updated_at match the version we rendered to the client.
  const { data: updated, error } = await supa
    .from('projects')
    .update({
      title,
      summary,
      category_id,
      subcategory_id,
      started_at: started_at || null,
      volunteers,
      wood_tools,
      metal_tools,
      materials,
      // updated_at will be auto-set by the DB trigger
    })
    .eq('id', id)
    .eq('updated_at', _ts)          // <— the critical guard
    .select('id, slug, updated_at')
    .single();

  // If no row matched, either the id is wrong or the timestamp changed (conflict).
  if (!updated || error) {
    // Detect conflict: check current updated_at
    const { data: current } = await supa
      .from('projects')
      .select('slug, updated_at')
      .eq('id', id)
      .maybeSingle();

    const backSlug = current?.slug ?? id;
    const back = new URL(`/dashboard/projects/${backSlug}`, url);
    back.searchParams.set('flash','custom');

    // If row exists but timestamps differ -> edit conflict
    if (current && current.updated_at && current.updated_at !== _ts) {
      back.searchParams.set('type','error');
      back.searchParams.set('msg','This project was updated by someone else. Please refresh and try again.');
      return redirect(back.toString());
    }

    // Otherwise generic failure
    back.searchParams.set('type','error');
    back.searchParams.set('msg','Save failed');
    return redirect(back.toString());
  }

  // Success
  const back = new URL(`/dashboard/projects/${updated.slug}`, url);
  back.searchParams.set('flash','custom');
  back.searchParams.set('type','success');
  back.searchParams.set('msg','Saved');
  return redirect(back.toString());
};

// src/pages/api/projects/create.ts
import type { APIRoute } from 'astro';
import { getSupabaseServerClient, supabaseAdmin } from '../../../lib/supabaseServer';
import { WOOD_TOOLS, METAL_TOOLS } from '../../../constants/tools';
import { randomUUID } from 'node:crypto';

export const prerender = false;

// Use a single bucket for project assets. Create it in Supabase Storage.
const BUCKET = 'projects';

const slugify = (s: string) =>
  (s || 'project')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'project';

function extFromMime(mime: string): string {
  switch ((mime || '').toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/jpg':  return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif':  return 'gif';
    default:           return '';
  }
}

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supa = getSupabaseServerClient({ request, cookies });

  // Auth
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return redirect('/login?next=/dashboard/projects/new');

  // Gate: must be an active member
  const { data: member, error: memberErr } = await supa
    .from('members')
    .select('is_active, role')
    .eq('id', user.id)
    .single();

  if (memberErr || !member?.is_active) {
    const d = new URL('/dashboard/projects', url);
    d.searchParams.set('flash', 'custom');
    d.searchParams.set('type', 'error');
    d.searchParams.set('msg', 'Only active members can create projects');
    return redirect(d.toString());
  }

  const fd = await request.formData();

  const title       = String(fd.get('title') || '').trim();
  const summary     = (String(fd.get('summary') || '').trim()) || null;
  const category_id = String(fd.get('category_id') || '');
  const subcat_in   = (String(fd.get('subcategory_id') || '') || null);
  const started_at  = (String(fd.get('started_at') || '') || null);

  const volunteersRaw = Number(fd.get('volunteers') || 0);
  const volunteers = Number.isFinite(volunteersRaw) && volunteersRaw >= 0
    ? Math.floor(volunteersRaw)
    : 0;

  if (!title || !category_id) {
    const d = new URL('/dashboard/projects/new', url);
    d.searchParams.set('flash', 'custom');
    d.searchParams.set('type', 'error');
    d.searchParams.set('msg', 'Title and Category are required');
    return redirect(d.toString());
  }

  // Arrays (support both names: `wood_tools` and `wood_tools[]`)
  const wood_tools_input  = [
    ...Array.from(fd.getAll('wood_tools')).map(String),
    ...Array.from(fd.getAll('wood_tools[]')).map(String),
  ];
  const metal_tools_input = [
    ...Array.from(fd.getAll('metal_tools')).map(String),
    ...Array.from(fd.getAll('metal_tools[]')).map(String),
  ];

  const materials = String(fd.get('materials') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Validate tools against allowed lists
  const WOOD_SET = new Set(WOOD_TOOLS);
  const METAL_SET = new Set(METAL_TOOLS);
  const wood_tools  = wood_tools_input.filter(t => WOOD_SET.has(t));
  const metal_tools = metal_tools_input.filter(t => METAL_SET.has(t));

  // Ensure subcategory belongs to selected category
  let subcategory_id: string | null = subcat_in;
  if (subcategory_id) {
    const { data: sub } = await supa
      .from('project_subcategories')
      .select('parent_category')
      .eq('id', subcategory_id)
      .maybeSingle();
    if (!sub || sub.parent_category !== category_id) subcategory_id = null;
  }

  const slugBase = slugify(title);

  // Insert first (so we get projectId for the storage path)
  const basePayload = {
    title,
    summary,
    category_id,
    subcategory_id,
    wood_tools,
    metal_tools,
    materials,
    started_at: started_at || null,
    volunteers,
    created_by: user.id, // or let your trigger set this to auth.uid()
  };

  let created: { id: string; slug: string } | null = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const slug = attempt === 1 ? slugBase : `${slugBase}-${attempt}`;
    const { data, error } = await supa
      .from('projects')
      .insert({ ...basePayload, slug })
      .select('id, slug')
      .single();

    if (!error && data) { created = data; break; }
    // 23505 = unique_violation (slug taken) → retry; otherwise bail out
    if ((error as any)?.code !== '23505') {
      const dest = new URL('/dashboard/projects', url);
      dest.searchParams.set('flash', 'custom');
      dest.searchParams.set('type', 'error');
      dest.searchParams.set('msg', `Create failed: ${error?.message || 'Unknown error'}`);
      return redirect(dest.toString());
    }
  }

  if (!created) {
    const dest = new URL('/dashboard/projects', url);
    dest.searchParams.set('flash', 'custom');
    dest.searchParams.set('type', 'error');
    dest.searchParams.set('msg', 'Create failed: could not allocate a unique slug');
    return redirect(dest.toString());
  }

  // Handle optional thumbnail upload (AFTER insert so we have projectId)
  const file = fd.get('thumbnail') as File | null;
  let thumbKey: string | null = null;

  if (file && typeof file.name === 'string' && file.size > 0) {
    // ~5MB server-side guard
    if (file.size > 5 * 1024 * 1024) {
      const d = new URL(`/dashboard/projects/${created.slug}`, url);
      d.searchParams.set('flash', 'custom');
      d.searchParams.set('type', 'info');
      d.searchParams.set('msg', 'Project created (thumbnail skipped: >5MB)');
      return redirect(d.toString());
    }

    const fromMime = extFromMime(file.type);
    const fromName = (file.name.split('.').pop() || '').toLowerCase();
    const ext = (fromMime || fromName).replace('jpeg', 'jpg');

    if (!['jpg', 'png', 'webp', 'gif'].includes(ext)) {
      const d = new URL(`/dashboard/projects/${created.slug}`, url);
      d.searchParams.set('flash', 'custom');
      d.searchParams.set('type', 'info');
      d.searchParams.set('msg', 'Project created (thumbnail skipped: unsupported type)');
      return redirect(d.toString());
    }

    const ownerFolder = user.id; // durable + RLS-friendly; switch to `members.handle` later if you add it
    const path = `${ownerFolder}/${created.id}/thumbnail.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    // Use SERVICE-ROLE for uploads to avoid Storage RLS headaches
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: file.type || 'image/*',
        cacheControl: '3600',
        upsert: true, // allow replacing the thumbnail if re-uploaded on edit
      });

    if (!upErr) {
      // Save the object key in thumbnail_url (your code expects a key)
      thumbKey = path;
      await supa
        .from('projects')
        .update({ thumbnail_url: thumbKey })
        .eq('id', created.id);
    } else {
      // Upload failed; keep the project, just no thumbnail
      // (Optional: log upErr.message)
    }
  }

  // Success → go to detail
  const dest = new URL(`/dashboard/projects/${created.slug}`, url);
  dest.searchParams.set('flash', 'custom');
  dest.searchParams.set('type', thumbKey ? 'success' : 'info');
  dest.searchParams.set('msg', thumbKey ? 'Project created' : 'Project created (no thumbnail uploaded)');
  return redirect(dest.toString());
};

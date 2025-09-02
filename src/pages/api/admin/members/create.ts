// src/pages/api/admin/members/create.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServerClient, supabaseAdmin } from '../../../../lib/supabaseServer';

const DEV_NO_SMTP = import.meta.env.SUPABASE_DEV_NO_SMTP === 'true';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supa = getSupabaseServerClient({ request, cookies });

  // Must be logged in + staff/admin
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: me } = await supa
    .from('members')
    .select('role,is_active')
    .eq('id', user.id)
    .single();

  const isStaff = me?.is_active && ['admin', 'staff'].includes(me.role);
  if (!isStaff) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const full_name = String(form.get('full_name') ?? '').trim();
  const role = (String(form.get('role') ?? 'member') as 'admin' | 'staff' | 'member');

  if (!email || !full_name) {
    const d = new URL('/dashboard/members/new', url);
    d.searchParams.set('flash', 'custom');
    d.searchParams.set('type', 'error');
    d.searchParams.set('msg', 'Name and email are required');
    return redirect(d.toString(), 303);
  }

  // ======= DEV: create without SMTP =======
  if (DEV_NO_SMTP) {
    // 1) Create (or no-op if user exists)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,                          // mark confirmed (no email)
      user_metadata: { full_name, role },
    });

    // If user already exists, carry on; otherwise handle real errors
    if (createErr && !String(createErr.message || '').toLowerCase().includes('already registered')) {
      return htmlError(`Create user failed: ${createErr.message}`);
    }

    const uid = created?.user?.id ?? (await getUserIdByEmail(email));
    if (!uid) return htmlError('Could not resolve user id after create.');

    // 2) Ensure they exist in public.members
    const { error: upErr } = await supabaseAdmin.from('members').upsert({
      id: uid, email, full_name, role, is_active: true,
    });
    if (upErr) return htmlError(`Members upsert failed: ${upErr.message}`);

    // 3) Generate a magic link the admin can copy
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      // redirectTo: 'http://localhost:4321/'  // optional override; else uses Supabase "Site URL"
    });
    if (linkErr) return htmlError(`Generate magic link failed: ${linkErr.message}`);

    const actionLink = link?.properties?.action_link;
    if (!actionLink) return htmlError('No magic link returned from Supabase.');

    // 4) For dev: render a tiny HTML page with the link + copy button
    return htmlOk(`
      <h1>Invite created (DEV mode)</h1>
      <p><strong>${full_name}</strong> &lt;${email}&gt; (${role})</p>
      <p>Share this one-time sign-in link with them:</p>
      <p><input id="lnk" style="width:100%" value="${escapeHtml(actionLink)}" /></p>
      <p>
        <button onclick="navigator.clipboard.writeText(document.getElementById('lnk').value)">Copy link</button>
        <a href="/dashboard/members" style="margin-left:.5rem">Back to Members</a>
      </p>
      <p style="color:#6b7280">Note: This bypasses email. Do not use in production.</p>
    `);
  }

  // ======= PROD: normal email invite =======
  const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    // redirectTo: 'http://localhost:4321/'  // optional override
  });

  if (inviteErr) {
    const d = new URL('/dashboard/members/new', url);
    d.searchParams.set('flash', 'custom');
    d.searchParams.set('type', 'error');
    d.searchParams.set('msg', inviteErr.message);
    return redirect(d.toString(), 303);
  }

  const uid = invited.user?.id ?? (await getUserIdByEmail(email));
  if (uid) {
    await supabaseAdmin.from('members').upsert({
      id: uid, email, full_name, role, is_active: true,
    });
  }

  const d = new URL('/dashboard/members', url);
  d.searchParams.set('flash', 'custom');
  d.searchParams.set('type', 'success');
  d.searchParams.set('msg', 'Invite sent');
  return redirect(d.toString(), 303);
};

// --- helpers (server-only) ---
function htmlOk(body: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><style>
    body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem}
    input{padding:.5rem;border:1px solid #e5e7eb;border-radius:8px}
    button,a{display:inline-flex;align-items:center;padding:.45rem .7rem;border-radius:8px;border:1px solid #e5e7eb;text-decoration:none}
  </style>${body}`, { headers: { 'content-type': 'text/html' } });
}
function htmlError(msg: string) {
  return htmlOk(`<h1>Invite failed</h1><p style="color:#991b1b">${escapeHtml(msg)}</p><p><a href="/dashboard/members/new">Back</a></p>`);
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
async function getUserIdByEmail(email: string) {
  // Fallback: read via admin.listUsers (no RLS)
  const page = await supabaseAdmin.auth.admin.listUsers();
  const u = page?.data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  return u?.id ?? null;
}

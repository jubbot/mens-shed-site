// src/pages/api/admin/members/create.ts
import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../../lib/supabaseServer';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const DEV_NO_SMTP = import.meta.env.SUPABASE_DEV_NO_SMTP === 'true';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json();
  const { email, first_name, last_name, role } = body ?? {};

  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: 'email required' }), { status: 400 });
  }

  // Optional: ensure caller is authenticated & authorized (admin)
  const supa = getSupabaseServerClient({ request, cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user /* || !user_has_admin_role */) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  if (DEV_NO_SMTP) {
    // Silent create: set a temp password or send back a magic link
    const password = crypto.randomUUID(); // temp
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    });
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });

    // Optionally generate a one-time magic link
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { data: { onboarding: true } },
    });
    if (linkErr) {
      // Still OK if user created; return without link
      return new Response(JSON.stringify({ ok: true, user: data.user, magicLinkError: linkErr.message }));
    }
    return new Response(JSON.stringify({ ok: true, user: data.user, magicLink: linkData.properties?.action_link }));
  } else {
    // Standard invite flow (requires SMTP configured in Supabase)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { first_name, last_name, role },
    });
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });
    return new Response(JSON.stringify({ ok: true, user: data.user }));
  }
};

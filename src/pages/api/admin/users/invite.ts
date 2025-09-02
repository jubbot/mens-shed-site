// src/pages/api/admin/users/invite.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const POST: APIRoute = async ({ request, url }) => {
  const { email, role = 'member', site_id = null } = await request.json();

  // Send Supabase-managed invite email with redirect back to your app
  const redirectTo = new URL('/auth/reset', url.origin).toString(); // where they’ll set a password
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role, site_id }, // user_metadata
  });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });

  // Optionally mirror role in app_metadata for fast checks
  if (data?.user?.id) {
    await supabaseAdmin.auth.admin.updateUserById(data.user.id, { app_metadata: { role } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

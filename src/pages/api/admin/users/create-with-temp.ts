// src/pages/api/admin/users/create-with-temp.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generatePassword } from '@/lib/generatePassword';

export const POST: APIRoute = async ({ request }) => {
  const { email, role = 'member', site_id = null } = await request.json();
  const temp = generatePassword(24);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temp,
    email_confirm: true, // you’re asserting this is legit
    user_metadata: { role, site_id, must_change_password: true },
    app_metadata: { role },
  });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });

  // IMPORTANT: return the temp password once; never log it
  return new Response(JSON.stringify({ ok: true, oneTimePassword: temp, userId: data.user?.id }), { status: 200 });
};

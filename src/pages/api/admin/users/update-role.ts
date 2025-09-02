// src/pages/api/admin/users/update-role.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireStaff } from '@/lib/requireStaff';

export const POST: APIRoute = async ({ request, ...ctx }) => {
  const gate = await requireStaff({ request, ...ctx } as any);
  if (!gate.ok) return new Response(JSON.stringify({ ok:false, error:gate.error }), { status: gate.status });
  const { id, role } = await request.json();
  if (!id || !role) return new Response(JSON.stringify({ ok:false, error:'id and role required' }), { status:400 });
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { app_metadata: { role } });
  if (error) return new Response(JSON.stringify({ ok:false, error:error.message }), { status:400 });
  return new Response(JSON.stringify({ ok:true }), { status:200 });
};

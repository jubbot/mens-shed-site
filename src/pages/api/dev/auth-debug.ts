import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const GET: APIRoute = async () => {
  const url = process.env.SUPABASE_URL;
  const ref = url?.match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? null;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 5 });
  return new Response(JSON.stringify({
    ok: !error,
    projectRef: ref,
    sampleCount: data?.users?.length ?? 0,
    error: error?.message ?? null
  }), { status: error ? 400 : 200 });
};

// src/pages/api/db-health.ts
import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../lib/supabaseServer';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supa = getSupabaseServerClient({ request, cookies });
    const { data, error } = await supa.from('pg_stat_activity').select('pid').limit(1); // any cheap query
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { status: 500 });
  }
};

// src/pages/api/db-health.ts
import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabaseServer';


export const prerender = false;


export const GET: APIRoute = async () => {
try {
const db = supabaseServer();
// Simple ping: ask for the current timestamp
const { data, error } = await db.rpc('pg_now');


// Fallback if helper function isn't created yet: select now() via SQL
let now = data?.now ?? null;
if (!now) {
const { data: row, error: err2 } = await db.from('profiles').select('id').limit(1).maybeSingle();
if (err2) {
return new Response(JSON.stringify({ ok: false, error: String(error ?? err2) }), { status: 500 });
}
now = new Date().toISOString();
}


return new Response(JSON.stringify({ ok: true, db_time: now }), { status: 200 });
} catch (e) {
return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
}
};
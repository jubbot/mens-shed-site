// src/pages/api/analytics/item.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { totalsForKeys } from '../../../lib/analytics';

export const GET: APIRoute = async ({ url }) => {
  const kind = (url.searchParams.get('kind') || '').toLowerCase();
  const key  = (url.searchParams.get('key')  || '').trim();
  if (!['product','project','page'].includes(kind) || !key) {
    return new Response(JSON.stringify({ ok:false, error:'kind and key required' }), {
      status: 400, headers: { 'content-type':'application/json' }
    });
  }
  const rows = totalsForKeys(kind as any, [key]);
  const total = rows[0]?.total ?? 0;
  return new Response(JSON.stringify({ ok:true, kind, key, total }), {
    headers: { 'content-type':'application/json', 'cache-control': 'no-store' }
  });
};

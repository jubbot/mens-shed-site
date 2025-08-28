export const prerender = false;

import type { APIRoute } from 'astro';
import { inc } from '../../../lib/analytics';

const isBot = (ua = '') =>
  /bot|crawler|spider|crawling|facebookexternalhit|slackbot|twitterbot|embedly|whatsapp|telegram/i.test(ua);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function parse(req: Request) {
  const u = new URL(req.url);
  const kindQ = u.searchParams.get('kind');
  const keyQ  = u.searchParams.get('key');
  if (kindQ && keyQ) return { kind: kindQ as 'product'|'project'|'page', key: keyQ };

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      const b = await req.json();
      if (b?.kind && b?.key) return { kind: b.kind, key: b.key };
    } catch {}
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const f = await req.formData();
      const kind = f.get('kind'); const key = f.get('key');
      if (typeof kind === 'string' && typeof key === 'string') return { kind, key };
    } catch {}
  }
  return null;
}

async function handle(request: Request): Promise<Response> {
  // Skip bots and respect DNT
  const ua = request.headers.get('user-agent') || '';
  if (isBot(ua) || request.headers.get('dnt') === '1') {
    return json({ ok: true, skipped: true });
  }

  const parsed = await parse(request);
  if (!parsed) return json({ ok: false, error: 'kind and key required' }, 400);

  // Minimal input guard
  const kind = parsed.kind as 'product'|'project'|'page';
  const key  = String(parsed.key).trim();
  if (!['product','project','page'].includes(kind) || !key) {
    return json({ ok: false, error: 'invalid kind or key' }, 400);
  }

  // Increment
  inc(kind, key);
  return json({ ok: true });
}

export const GET:  APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);

export const prerender = false;

import type { APIRoute } from 'astro';
import { sanity } from '../../lib/sanityClient';

const sanityWrite = sanity.withConfig({
  token: import.meta.env.SANITY_WRITE_TOKEN,
  useCdn: false,
  perspective: 'published',
});

async function getSlugFromRequest(request: Request): Promise<string | null> {
  const u = new URL(request.url);
  const q = u.searchParams.get('slug');
  if (q) return q.trim();

  const ct = request.headers.get('content-type')?.toLowerCase() || '';
  if (ct.includes('application/json')) {
    try {
      const body = await request.json();
      if (body && typeof body.slug === 'string' && body.slug.trim()) return body.slug.trim();
    } catch {}
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      const s = form.get('slug');
      if (typeof s === 'string' && s.trim()) return s.trim();
    } catch {}
  }
  return null;
}

async function handle(request: Request): Promise<Response> {
  // 👇 1) BOT SKIP — place this at the very top of the handler
  const ua = request.headers.get('user-agent') || '';
  const isBot = /bot|crawler|spider|crawling|preview|facebookexternalhit|slackbot|twitterbot|embedly|linkbot|whatsapp|telegram/i.test(ua);
  if (isBot) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'bot' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 2) Get slug from query/body
  const slug = await getSlugFromRequest(request);
  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing slug' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 3) No-op in dev if token missing
  if (!import.meta.env.SANITY_WRITE_TOKEN) {
    return new Response(JSON.stringify({ ok: true, skipped: true, slug }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const doc = await sanityWrite.fetch(
      `*[_type == "project" && slug.current == $slug][0]{ _id, "views": coalesce(views, 0) }`,
      { slug }
    );
    if (!doc?._id) {
      return new Response(JSON.stringify({ ok: false, error: 'Project not found', slug }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const updated = await sanityWrite
      .patch(doc._id)
      .setIfMissing({ views: 0 })
      .inc({ views: 1 })
      .commit({ autoGenerateArrayKeys: true });

    return new Response(JSON.stringify({
      ok: true,
      slug,
      views: typeof updated?.views === 'number' ? updated.views : (doc.views + 1),
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('[track-view] error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);

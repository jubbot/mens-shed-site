import type { APIRoute } from 'astro';
import { sanity } from '../../lib/sanityClient';

export const prerender = false; // dynamic endpoint

// Newest first, slice by offset/limit
const GROQ = (start: number, end: number) => `
*[_type == "project"]
| order(coalesce(date, _createdAt) desc) [${start}...${end}]{
  _id,
  title,
  date,
  "sponsor": coalesce(sponsor->title, sponsorName, ""),
  "thumb": select(defined(thumbnail.asset) => thumbnail.asset->url, null)
}
`;

export const GET: APIRoute = async ({ url }) => {
  try {
    const sp = url.searchParams;
    const limit = Math.max(1, Math.min(50, Number(sp.get('limit') ?? '10')));
    const offset = Math.max(0, Number(sp.get('offset') ?? '0'));
    const start = offset;
    const end = offset + limit - 1; // GROQ slice end is inclusive

    const rows = await sanity.fetch(GROQ(start, end));
    const projects = (rows ?? []).map((r: any) => ({
      id: r._id,
      title: r.title,
      dateLabel: r.date ? new Date(r.date).toLocaleString('en-AU', { month: 'long', year: 'numeric' }) : '',
      sponsor: r.sponsor || '',
      thumb: r.thumb || null,
    }));

    return new Response(JSON.stringify({ projects }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
      status: 200
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: true, message: err?.message || 'Unknown error' }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
      status: 500
    });
  }
};

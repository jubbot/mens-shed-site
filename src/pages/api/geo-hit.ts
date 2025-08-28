import type { APIRoute } from 'astro';

const TOKEN = import.meta.env.SANITY_TOKEN;
const PROJECT = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const DATASET = import.meta.env.PUBLIC_SANITY_DATASET;

const VALID: Record<string, true> = { NSW:true, QLD:true, VIC:true, SA:true, WA:true, TAS:true, NT:true, ACT:true };

export const POST: APIRoute = async ({ request }) => {
  try {
    const { region } = await request.json();
    const code = (region || '').toUpperCase();
    const key = VALID[code] ? code : 'OTHER';

    const url = `https://${PROJECT}.api.sanity.io/v2023-06-01/data/mutate/${DATASET}`;
    const mutations = [{
      patch: {
        id: 'auGeo',
        setIfMissing: { _type: 'auGeo', counts: {} },
        inc: { [`counts.${key}`]: 1 }
      }
    }];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ mutations })
    });
    if (!res.ok) throw new Error('Sanity mutate failed');

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
};

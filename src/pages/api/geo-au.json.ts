 import type { APIRoute } from 'astro';
const QUERY = encodeURIComponent('*[_id=="auGeo"][0]{counts}');
const PROJECT = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const DATASET = import.meta.env.PUBLIC_SANITY_DATASET;

export const GET: APIRoute = async () => {
  const url = `https://${PROJECT}.apicdn.sanity.io/v2023-06-01/data/query/${DATASET}?query=${QUERY}`;
  const res = await fetch(url, { cache: 'no-store' });
  const { result } = await res.json();
  return new Response(JSON.stringify(result?.counts || {}), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
};

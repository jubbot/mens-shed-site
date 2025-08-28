export const prerender = false;

import type { APIRoute } from 'astro';
import { sanity } from '../../../lib/sanityClient';
import { topByKind } from '../../../lib/analytics';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function docsForProducts(slugs: string[]) {
  if (!slugs.length) return [];
  const docs = await sanity.fetch(
    `*[_type=="product" && slug.current in $slugs]{
      _id, title, "slug": slug.current,
      "cat": storeCategory->slug.current,
      "thumb": coalesce(mainImage.asset->url, gallery[0].asset->url)
    }`,
    { slugs }
  );
  const map = new Map(docs.map((d: any) => [d.slug, d]));
  return slugs.map((s) => {
    const d = map.get(s);
    return {
      slug: s,
      title: d?.title ?? s,
      href: d?.cat ? `/store/${d.cat}/${s}` : `/store`,
      thumb: d?.thumb ?? null,
    };
  });
}

async function docsForProjects(slugs: string[]) {
  if (!slugs.length) return [];
  const docs = await sanity.fetch(
    `*[_type=="project" && slug.current in $slugs]{
      _id, title, "slug": slug.current,
      "cat": category->slug.current,
      "sub": subcategory->slug.current,
      "thumb": coalesce(thumbnail.asset->url, gallery[0].asset->url)
    }`,
    { slugs }
  );
  const map = new Map(docs.map((d: any) => [d.slug, d]));
  return slugs.map((s) => {
    const d = map.get(s);
    let href = '/projects';
    if (d?.cat && d?.sub) href = `/projects/${d.cat}/${d.sub}/${s}`;
    else if (d?.cat)     href = `/projects/${d.cat}/${s}`;
    return {
      slug: s,
      title: d?.title ?? s,
      href,
      thumb: d?.thumb ?? null,
    };
  });
}

async function docsForWhatsOn(slugs: string[]) {
  if (!slugs.length) return [];
  // Adjust doc type/fields if your What's On schema uses a different name or image field
  let docs = await sanity.fetch(
    `*[_type=="whatsOn" && slug.current in $slugs]{
      _id, title, "slug": slug.current,
      "thumb": coalesce(mainImage.asset->url, gallery[0].asset->url)
    }`,
    { slugs }
  );
  // Fallback attempt if your type is called "event"
  if (!docs?.length) {
    docs = await sanity.fetch(
      `*[_type=="event" && slug.current in $slugs]{
        _id, title, "slug": slug.current,
        "thumb": coalesce(mainImage.asset->url, gallery[0].asset->url)
      }`,
      { slugs }
    );
  }
  const map = new Map(docs.map((d: any) => [d.slug, d]));
  return slugs.map((s) => {
    const d = map.get(s);
    return {
      slug: s,
      title: d?.title ?? s,
      href: d ? `/whats-on/${s}` : `/whats-on`,
      thumb: d?.thumb ?? null,
    };
  });
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 10)));

    // 1) read top slugs from SQLite
    const prodRows = topByKind('product', limit);  // [{ key, total }]
    const projRows = topByKind('project', limit);
    const whatRows = topByKind('whatson', limit);  // ensure you track as kind=whatson

    const prodSlugs = prodRows.map(r => r.key);
    const projSlugs = projRows.map(r => r.key);
    const whatSlugs = whatRows.map(r => r.key);

    // 2) enrich with Sanity docs (preserve view order)
    const [prodDocs, projDocs, whatDocs] = await Promise.all([
      docsForProducts(prodSlugs),
      docsForProjects(projSlugs),
      docsForWhatsOn(whatSlugs),
    ]);

    // 3) stitch views back on
    const withViews = (rows: {key:string,total:number}[], docs: any[]) =>
      rows.map(r => {
        const d = docs.find((x: any) => x.slug === r.key);
        return { ...d, slug: r.key, views: r.total };
      });

    return json({
      ok: true,
      products: withViews(prodRows as any, prodDocs),
      projects: withViews(projRows as any, projDocs),
      whatson:  withViews(whatRows as any, whatDocs),
    });
  } catch (e: any) {
    return json({ ok:false, error: e?.message ?? String(e) }, 500);
  }
};

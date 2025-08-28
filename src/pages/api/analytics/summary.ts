// src/pages/api/analytics/summary.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { sanity } from '../../../lib/sanityClient';
import {
  sumByKind,
  totalsForKeys,
  seriesByKind,
  seriesForKeys,
  topKeysByKind,
} from '../../../lib/analytics';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

// No sum() in GROQ — fetch lists, sum in JS
const GROQ = `{
  "productsAvailable": count(*[
    _type=="product" && !(_id in path("drafts.**"))
    && (inStock != false)
    && (!defined(stockQty) || stockQty > 0)
    && defined(slug.current)
  ]),
  "soldQtyList": *[
    _type=="product" && !(_id in path("drafts.**")) && defined(soldQty)
  ].soldQty,
  "soldFallback": count(*[
    _type=="product" && !(_id in path("drafts.**"))
    && ((defined(stockQty) && stockQty <= 0) || inStock == false)
  ])
}`;

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async ({ url }) => {
  try {
    // ---- Range (defaults to 30 days, clamp 7..90)
    const daysParam = Number(url.searchParams.get('days') || 30);
    const days = Math.max(7, Math.min(90, Number.isFinite(daysParam) ? daysParam : 30));
    const end = new Date(); // today UTC
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (days - 1));
    const startDay = ymd(start);
    const endDay = ymd(end);

    // Allow overriding which "page" keys to report on
    const pagesParam = (url.searchParams.get('pages') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const pageKeys = pagesParam.length
      ? pagesParam
      : ['home', 'store', 'projects', 'contact', 'membership', 'jobs'];

    // ---- Read-only analytics (SQLite)
    const productViews = sumByKind('product');
    const projectViews = sumByKind('project');
    const pageViews = sumByKind('page');

    const pageTotalsRows = totalsForKeys('page', pageKeys);
    const pageTotals = Object.fromEntries(pageKeys.map((k) => [k, 0]));
    pageTotalsRows.forEach((r) => {
      pageTotals[r.key] = r.total;
    });

    const kindsSeries = {
      product: seriesByKind('product', startDay, endDay),
      project: seriesByKind('project', startDay, endDay),
      page: seriesByKind('page', startDay, endDay),
    };
    const pagesSeries = seriesForKeys('page', pageKeys, startDay, endDay);
    const topPages = topKeysByKind('page', 10);

    // ---- Sanity product stats
    const stats = await sanity.fetch(GROQ);

    const soldUnits = Array.isArray(stats?.soldQtyList)
      ? (stats.soldQtyList as unknown[]).reduce((acc, n) => {
          const v = typeof n === 'number' ? n : Number(n);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0)
      : 0;

    const sold =
      soldUnits > 0
        ? soldUnits
        : typeof stats?.soldFallback === 'number'
        ? stats.soldFallback
        : 0;

    const productsAvailable =
      typeof stats?.productsAvailable === 'number' ? stats.productsAvailable : 0;

    // ---- Response (backwards-compatible + rich dashboard data)
    return json({
      ok: true,
      range: { startDay, endDay, days },

      // Back-compat for ProductBanner
      productsAvailable, // total products available for sale
      sold,              // sold units or fallback count
      productViews,      // combined product views
      viewsCompact: fmtCompact(productViews),

      // Totals for dashboard
      totals: {
        productViews,
        projectViews,
        pageViews,
      },
      pageTotals, // { home, store, ... }

      // Time series
      series: {
        kinds: {
          days: kindsSeries.page.days, // shared axis
          product: kindsSeries.product.values,
          project: kindsSeries.project.values,
          page: kindsSeries.page.values,
        },
        pages: {
          days: pagesSeries.days,
          ...pagesSeries.series, // spread each page key -> number[]
        },
      },

      // Top pages by total
      topPages,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
};

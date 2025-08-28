import { sanity } from './sanityClient';
import { sumByKind } from './analytics'; // from the SQLite setup

export async function getStoreStats() {
  const productViews = sumByKind('product');

  const GROQ = `{
    "productsAvailable": count(*[
      _type=="product" && !(_id in path("drafts.**"))
      && (inStock != false) && (!defined(stockQty) || stockQty > 0)
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

  const stats = await sanity.fetch(GROQ);
  const soldUnits = Array.isArray(stats?.soldQtyList)
    ? stats.soldQtyList.reduce((a: number, n: any) => a + (Number.isFinite(+n) ? +n : 0), 0)
    : 0;
  const sold = soldUnits > 0 ? soldUnits : (stats?.soldFallback ?? 0);

  return {
    productsAvailable: stats?.productsAvailable ?? 0,
    sold,
    productViews,
    viewsCompact: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(productViews),
  };
}

// XXL (Next.js): produktlister fra __NEXT_DATA__ på kategorisidene (?pages=N, 32 per side).
import { decodeEntities } from '../core/util.js';

const CATEGORY = '/sport/trening/kosttilskudd/c/180800';

export function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Listesidene har selling.value, produktsiden selling.range.min.value
const val = (x) => x?.value ?? x?.range?.min?.value ?? null;

function prices(pr) {
  const sell = val(pr?.selling);
  const alt = val(pr?.alternative) ?? val(pr?.previous) ?? val(pr?.recommended) ?? null;
  const isMember = /member|reward|klubb/i.test(`${pr?.type} ${pr?.selling?.label}`);
  if (isMember && alt && alt > sell) return { price: alt, listPrice: null, memberPrice: sell };
  return { price: sell, listPrice: alt && alt > sell ? alt : null, memberPrice: null };
}

function usp(p, re) {
  const u = (p.usps || []).find((x) => re.test(`${x.id} ${x.name}`));
  return u ? u.value : null;
}

function toRaw(shop, p) {
  const url = `${shop.url}${p.url}`;
  const { price, listPrice, memberPrice } = prices(p.price);
  const weight = usp(p, /weight|vekt/i);
  const servings = usp(p, /servings|porsjoner/i);
  return {
    shop: shop.id,
    id: p.code,
    url,
    name: decodeEntities(p.name),
    brand: p.brandName || null,
    shopCategory: 'Kosttilskudd',
    image: p.primaryImage ? `https://www.xxl.no${p.primaryImage}` : null,
    text: (p.usps || []).map((x) => `${x.name}: ${x.value}`).join('\n'),
    weightText: weight,
    servings: servings ? Number(String(servings).replace(',', '.')) || null : null,
    shortDate: false,
    variants: [{ id: p.code, flavor: null, size: weight, price, listPrice, memberPrice, inStock: p.isInStockOnline !== false && p.stockStatus !== 'OUTOFSTOCK', url }].filter((v) => v.price > 0),
    refresh: { kind: 'xxl', url },
  };
}

export async function scan(shop, ctx) {
  const out = new Map();
  let total = Infinity;
  for (let page = 1; page <= 60 && out.size < total; page++) {
    const html = await ctx.text(`${shop.url}${CATEGORY}?pages=${page}`);
    const pl = html && nextData(html)?.props?.pageProps?.productListData;
    if (!pl?.products?.length) break;
    total = pl.totalHits ?? total;
    const before = out.size;
    for (const p of pl.products) out.set(p.code, toRaw(shop, p));
    if (out.size === before) break;
  }
  ctx.log(`${shop.id}: ${out.size} produkter`);
  return [...out.values()];
}

// Produktsiden har samme felter et sted i pageProps; vi leter etter objektet med vår kode.
export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  const d = html && nextData(html);
  if (!d) return null;
  // Første objekt med både pris og lagerstatus er produktet (stilen) som vises
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (o.price?.selling && (o.isInStockOnline !== undefined || o.stockStatus)) {
      found = o;
      return;
    }
    for (const k in o) walk(o[k]);
  };
  walk(d.props?.pageProps?.newPdpProps || d.props?.pageProps);
  if (!found) return null;
  return toRaw(shop, { ...found, code: raw.id, url: new URL(raw.url).pathname, name: found.title || found.name || raw.name, brandName: found.brandName || raw.brand, usps: found.usps || [] });
}

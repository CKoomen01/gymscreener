// Magento 2 (Sunkost): produktliste fra GraphQL, lagerstatus fra produktsiden.
import { stripHtml, mapLimit } from '../core/util.js';

// Kategorier (url_path) som er relevante. Urter, enzymer og probiotika er utelatt.
const PATHS = [
  'kosttilskudd/vitaminer-mineraler',
  'kosttilskudd/aminosyrer',
  'kosttilskudd/fettsyrer',
  'kosttilskudd/kombinasjonsprodukter',
  'kosttilskudd/proteiner-karbohydrater',
  'kosttilskudd/maltidserstatning',
  'sunn-snacks/barer',
  'drikke/proteindrikk',
];

const FIELDS = `__typename sku name url_key url_suffix categories{name url_path}
  price_range{minimum_price{regular_price{value} final_price{value}}}
  small_image{url} short_description{html} description{html}
  ... on ConfigurableProduct{configurable_options{attribute_code label}
    variants{attributes{code label} product{sku price_range{minimum_price{regular_price{value} final_price{value}}}}}}`;

async function gql(shop, ctx, query) {
  const res = await ctx.json(`${shop.url}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  return res?.data || null;
}

function stockFromPage(html) {
  const m = html.match(/"item_stock_status":"([^"]+)"/) || html.match(/product:availability" content="([^"]+)"/);
  if (!m) return null;
  return /in ?stock/i.test(m[1]);
}

function toRaw(shop, p, inStock) {
  const url = `${shop.url}/${p.url_key}${p.url_suffix || ''}`;
  const mp = p.price_range?.minimum_price;
  const cats = (p.categories || []).map((c) => c.name);
  const variants = [];
  if (p.__typename === 'ConfigurableProduct' && p.variants?.length) {
    for (const v of p.variants) {
      const vm = v.product?.price_range?.minimum_price;
      const flavor = v.attributes?.find((a) => /smak|flavou?r|variant/i.test(a.code))?.label || v.attributes?.[0]?.label || null;
      variants.push({ id: v.product.sku, flavor, size: null, price: vm?.final_price?.value, listPrice: vm?.regular_price?.value > vm?.final_price?.value ? vm.regular_price.value : null, inStock: inStock !== false, url });
    }
  } else {
    variants.push({ id: p.sku, flavor: null, size: null, price: mp?.final_price?.value, listPrice: mp?.regular_price?.value > mp?.final_price?.value ? mp.regular_price.value : null, inStock: inStock !== false, url });
  }
  return {
    shop: shop.id,
    id: p.sku,
    url,
    name: p.name,
    brand: null,
    shopCategory: cats.join(' / '),
    image: p.small_image?.url?.replace('.no//', '.no/') || null,
    text: stripHtml(`${p.short_description?.html || ''}\n${p.description?.html || ''}`),
    shortDate: /outlet|ryddesalg|kort dato/i.test(cats.join(' ')),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'magento', sku: p.sku, url },
  };
}

function brandFromPage(html) {
  const m = html.match(/"item_brand":"([^"]+)"/);
  return m ? JSON.parse(`"${m[1]}"`) : null;
}

// Produktsiden har "Innhold: 500 gr" / "Innhold: 120 kapsler" og næringstabell
function enrichFromPage(raw, html) {
  raw.brand = brandFromPage(html) || raw.brand;
  const size = html.match(/Innhold:\s*([^<\n]{1,40})/i);
  if (size) {
    raw.weightText = size[1].trim();
    raw.name = /\d/.test(raw.name) ? raw.name : `${raw.name}, ${raw.weightText}`;
  }
  const i = html.search(/Produktegenskaper og innhold|N(æ|ae)ringsinnhold\s*:/i);
  if (i > 0) raw.nutritionText = stripHtml(html.slice(i, i + 20000)).slice(0, 3000);
  return raw;
}

export async function scan(shop, ctx) {
  const cl = await gql(shop, ctx, `{categoryList(filters:{url_path:{in:${JSON.stringify(PATHS)}}}){uid url_path product_count}}`);
  const uids = (cl?.categoryList || []).map((c) => c.uid);
  const items = new Map();
  for (const uid of uids) {
    for (let page = 1; page < 40; page++) {
      const d = await gql(shop, ctx, `{products(filter:{category_uid:{eq:"${uid}"}},pageSize:100,currentPage:${page}){total_count items{${FIELDS}}}}`);
      const list = d?.products?.items || [];
      for (const p of list) items.set(p.sku, p);
      if (list.length < 100) break;
    }
  }
  ctx.log(`${shop.id}: ${items.size} produkter`);
  const out = await mapLimit([...items.values()], 4, async (p) => {
    const url = `${shop.url}/${p.url_key}${p.url_suffix || ''}`;
    const html = await ctx.text(url);
    const raw = toRaw(shop, p, html ? stockFromPage(html) : null);
    return html ? enrichFromPage(raw, html) : raw;
  });
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const d = await gql(shop, ctx, `{products(filter:{sku:{eq:"${raw.refresh.sku}"}}){items{${FIELDS}}}}`);
  const p = d?.products?.items?.[0];
  if (!p) return null;
  const html = await ctx.text(raw.refresh.url);
  const r = toRaw(shop, p, html ? stockFromPage(html) : null);
  r.brand = raw.brand;
  return html ? enrichFromPage(r, html) : r;
}

// WooCommerce Store API (Sportylab, Apex, Tights.no).
import { stripHtml, parsePrice, mapLimit, decodeEntities } from '../core/util.js';

const ROOT_RE = /kosttilskudd|helsekost|drikkevarer|sportsern|protein|vitamin|matvarer|snacks|barer|outlet|deals|datodeal|tilbud/i;
const SHORT_RE = /kort[\s-]?dato|datodeal|best[\s-]?f(ø|o)r|utl(ø|o)p/i;

function base(shop) {
  // Tights.no har bare det eldre navnerommet.
  return shop.id === 'tights' ? `${shop.url}/wp-json/wc/store` : `${shop.url}/wp-json/wc/store/v1`;
}

function priceOf(prices) {
  const mu = prices?.currency_minor_unit ?? 2;
  return {
    price: parsePrice(Number(prices?.price), mu),
    listPrice: parsePrice(Number(prices?.regular_price), mu),
  };
}

function toRaw(shop, p, variations) {
  const cats = (p.categories || []).map((c) => decodeEntities(c.name));
  const brand = decodeEntities(p.brands?.[0]?.name || '') || null;
  const attrName = (a) => decodeEntities(a?.name || '').toLowerCase();
  const variants = [];
  if (p.type === 'variable' && variations?.length) {
    for (const v of variations) {
      const { price, listPrice } = priceOf(v.prices);
      const opts = {};
      for (const a of v.variation_attributes || []) opts[attrName(a)] = decodeEntities(a.value);
      // Store API gir "Smak: X, Størrelse: Y" i v.variation
      for (const part of String(v.variation || '').split(/,\s*/)) {
        const m = part.match(/^([^:]+):\s*(.+)$/);
        if (m) opts[m[1].trim().toLowerCase()] = decodeEntities(m[2].trim());
      }
      const flavor = opts.smak || opts.flavor || opts.flavour || opts.variant || null;
      const size = opts['størrelse'] || opts.storrelse || opts.size || opts.vekt || opts.antall || opts.pakning || null;
      variants.push({ id: String(v.id), flavor, size, price, listPrice: listPrice > price ? listPrice : null, inStock: !!v.is_in_stock, url: v.permalink });
    }
  } else {
    const { price, listPrice } = priceOf(p.prices);
    variants.push({ id: String(p.id), flavor: null, size: null, price, listPrice: listPrice > price ? listPrice : null, inStock: !!p.is_in_stock, url: p.permalink });
  }
  return {
    shop: shop.id,
    id: String(p.id),
    url: p.permalink,
    name: decodeEntities(p.name),
    brand,
    shopCategory: cats.join(' / '),
    image: p.images?.[0]?.thumbnail || p.images?.[0]?.src || null,
    text: stripHtml(`${p.short_description || ''}\n${p.description || ''}`),
    shortDate: SHORT_RE.test(cats.join(' ')) || SHORT_RE.test(p.name),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'woo', id: p.id, variationIds: (p.variations || []).map((v) => v.id) },
  };
}

async function getVariations(shop, ctx, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const res = await ctx.json(`${base(shop)}/products?include=${chunk.join(',')}&type=variation&per_page=100`);
    if (Array.isArray(res)) out.push(...res);
  }
  return out;
}

export async function scan(shop, ctx) {
  const cats = (await ctx.json(`${base(shop)}/products/categories?per_page=100`)) || [];
  let more = [];
  for (let page = 2; cats.length === 100 * (page - 1) && page < 10; page++) {
    more = (await ctx.json(`${base(shop)}/products/categories?per_page=100&page=${page}`)) || [];
    cats.push(...more);
    if (more.length < 100) break;
  }
  const roots = cats.filter((c) => c.parent === 0 && ROOT_RE.test(`${c.slug} ${c.name}`)).map((c) => c.id);
  ctx.log(`${shop.id}: ${roots.length} rotkategorier`);
  const products = new Map();
  for (const cat of roots) {
    for (let page = 1; page < 60; page++) {
      const list = await ctx.json(`${base(shop)}/products?category=${cat}&per_page=100&page=${page}`);
      if (!Array.isArray(list) || !list.length) break;
      for (const p of list) products.set(p.id, p);
      if (list.length < 100) break;
    }
  }
  ctx.log(`${shop.id}: ${products.size} produkter`);
  const all = [...products.values()];
  const raws = await mapLimit(all, 4, async (p) => {
    const vars = p.type === 'variable' ? await getVariations(shop, ctx, (p.variations || []).map((v) => v.id)) : null;
    return toRaw(shop, p, vars);
  });
  return raws.filter(Boolean);
}

// Live-oppdatering av ett produkt (pris og lager per smak).
export async function refresh(shop, raw, ctx) {
  const p = await ctx.json(`${base(shop)}/products/${raw.refresh.id}`);
  if (!p || !p.id) return null;
  const vars = p.type === 'variable' ? await getVariations(shop, ctx, (p.variations || []).map((v) => v.id)) : null;
  return toRaw(shop, p, vars);
}

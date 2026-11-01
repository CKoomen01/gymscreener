// Shopify (Flexfit, Helsekost.no, Go On Shop): /products.json og /products/<handle>.js
import { stripHtml, parsePrice, sleep } from '../core/util.js';

const SHORT_RE = /kort[\s-]?dato|best[\s-]?f(ø|o)r|utl(ø|o)p|datovare/i;

function optionRoles(options) {
  // Finn hvilken opsjon (option1..3) som er smak og hvilken som er størrelse.
  const roles = {};
  (options || []).forEach((o, i) => {
    const n = String(o.name || o).toLowerCase();
    const key = `option${i + 1}`;
    if (/smak|flavou?r|variant|sort/.test(n)) roles.flavor = key;
    else if (/st(ø|o)rr|size|vekt|weight|antall|pakning|mengde|gram/.test(n)) roles.size = key;
    else if (!roles.flavor && !/title|tittel/.test(n)) roles.flavor = key;
  });
  return roles;
}

function toRaw(shop, p) {
  const roles = optionRoles(p.options);
  const handleUrl = `${shop.url}/products/${p.handle}`;
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',');
  const variants = (p.variants || []).map((v) => {
    const price = parsePrice(v.price, typeof v.price === 'number' ? 2 : 0);
    const cmp = parsePrice(v.compare_at_price, typeof v.compare_at_price === 'number' ? 2 : 0);
    const flavor = roles.flavor ? v[roles.flavor] : null;
    return {
      id: String(v.id),
      flavor: flavor && !/default title/i.test(flavor) ? flavor : null,
      size: roles.size ? v[roles.size] : null,
      price,
      listPrice: cmp && cmp > price ? cmp : null,
      inStock: !!v.available,
      url: `${handleUrl}?variant=${v.id}`,
      grams: v.grams || null,
    };
  });
  return {
    shop: shop.id,
    id: String(p.id),
    url: handleUrl,
    name: p.title,
    brand: p.vendor || null,
    shopCategory: [p.product_type, ...tags].filter(Boolean).join(' / '),
    image: p.images?.[0]?.src || p.featured_image || null,
    text: stripHtml(p.body_html || p.description || ''),
    shortDate: SHORT_RE.test(`${p.title} ${tags.join(' ')}`),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'shopify', handle: p.handle },
  };
}

export async function scan(shop, ctx) {
  const out = [];
  for (let page = 1; page < 80; page++) {
    let res = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await ctx.json(`${shop.url}/products.json?limit=250&page=${page}`);
      if (res && res.products) break;
      await sleep(15000 * (attempt + 1)); // Shopify svarer 429 ved for mange kall
    }
    const list = res?.products || [];
    if (!list.length) break;
    for (const p of list) out.push(toRaw(shop, p));
    if (list.length < 250) break;
    await sleep(1500);
  }
  ctx.log(`${shop.id}: ${out.length} produkter`);
  return out;
}

export async function refresh(shop, raw, ctx) {
  const p = await ctx.json(`${shop.url}/products/${raw.refresh.handle}.js`);
  if (!p || !p.id) return null;
  // .js-formatet har pris i øre og options som liste med navn
  return toRaw(shop, { ...p, body_html: p.description, options: p.options });
}

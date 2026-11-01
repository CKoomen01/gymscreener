// Salesforce Commerce Cloud (Gymgrossisten, Proteinfabrikken).
import { stripHtml, decodeEntities, mapLimit, absUrl } from '../core/util.js';

const CONF = {
  gymgrossisten: { site: 'Gymgrossisten', flag: 'gg', cgids: ['kosttillskott'] },
  proteinfabrikken: { site: 'ProteinFabrikken', flag: 'pf', cgids: ['proteinfabrikken__supplements', 'proteinfabrikken__bars', 'proteinfabrikken__drinks', 'proteinfabrikken__package_deals'] },
};

// Kategorier i rutenettet som ikke er kosttilskudd (utstyr, klær, mat uten relevans)
const SKIP_CAT = /t-skjorte|hoodie|tights|shorts|bukse|singlet|sko|topp|sports-bh|manual|kettlebell|vekt(stang|skive|vest)|benk|matte|bands|straps|belte|hansker|wraps|shaker|flaske|bag|massasje|roller|ball|hoppetau|romaskin|tredem|bike|tannbesk|leggbesk|hygiene|kroppsvekt|balanse|beskyttelse|grepstrening|boksehansker|ris, pasta|frø- og nøtt|peanøttsmør|sirup|sauser|kokosolj|grøt|baking/i;

function grid(shop, conf, cgid, start, sz) {
  return `${shop.url}/on/demandware.store/Sites-${conf.site}-Site/no_NO/Search-UpdateGrid?cgid=${cgid}&prefn1=hsng-product-onlineFlag-${conf.flag}&prefv1=true&start=${start}&sz=${sz}`;
}
function variationUrl(shop, conf, pid) {
  return `${shop.url}/on/demandware.store/Sites-${conf.site}-Site/no_NO/Product-Variation?pid=${encodeURIComponent(pid)}&quantity=1`;
}

function parseTiles(html, base) {
  const out = [];
  const re = /<div class="product-item[^"]*"\s+data-pid="([^"]+)"[^>]*?data-product-type="([^"]*)"[\s\S]*?data-tracking-product-tile="([^"]+)"[\s\S]*?href="([^"]+\.html)"/g;
  let m;
  while ((m = re.exec(html))) {
    let t = {};
    try {
      t = JSON.parse(decodeEntities(m[3]))[0] || {};
    } catch {
      /* ignorer */
    }
    out.push({ pid: m[1], type: m[2], name: decodeEntities(t.name || ''), brand: decodeEntities(t.brand || ''), category: decodeEntities(t.category || ''), price: Number(t.price) || null, url: absUrl(m[4], base) });
  }
  return out;
}

function priceFrom(p) {
  const sales = p?.price?.sales?.value ?? p?.price?.min?.sales?.value ?? null;
  const list = p?.price?.list?.value ?? null;
  return { price: sales, listPrice: list && list > sales ? list : null };
}

function flavorAttr(p) {
  return (p.variationAttributes || []).find((a) => /flavor|smak/i.test(`${a.attributeId} ${a.displayName}`));
}
function sizeAttr(p) {
  return (p.variationAttributes || []).find((a) => /size|st(ø|o)rr|weight|vekt/i.test(`${a.attributeId} ${a.displayName}`));
}

async function product(shop, conf, tile, ctx, perVariantPrice) {
  const res = await ctx.json(variationUrl(shop, conf, tile.pid));
  const p = res?.product;
  if (!p) return null;
  const base = priceFrom(p);
  const fa = flavorAttr(p);
  const sa = sizeAttr(p);
  const variants = [];
  const values = fa?.values?.length ? fa.values : [{ displayValue: null, inStock: p.available, pid: p.id, selectable: p.available }];
  for (const v of values) {
    let price = base.price;
    let listPrice = base.listPrice;
    if (perVariantPrice && v.pid && v.pid !== p.id && values.length > 1) {
      const vr = await ctx.json(variationUrl(shop, conf, v.pid));
      if (vr?.product) ({ price, listPrice } = priceFrom(vr.product));
    }
    variants.push({
      id: String(v.pid || p.id),
      flavor: v.displayValue ? decodeEntities(v.displayValue) : null,
      size: sa?.displayValue || null,
      price,
      listPrice,
      inStock: v.inStock !== undefined ? !!v.inStock && v.selectable !== false : !!p.available,
      url: tile.url,
    });
  }
  const promo = (p.promotions || []).map((x) => x.calloutMsg).filter(Boolean).map(stripHtml);
  return {
    shop: shop.id,
    id: tile.pid,
    url: tile.url,
    name: decodeEntities(p.masterName || p.productName || tile.name).replace(/,\s*[^,]+$/, (s) => (fa && s.includes(fa.displayValue) ? '' : s)),
    brand: p.brand || tile.brand || null,
    shopCategory: [tile.category, p.category?.displayName].filter(Boolean).join(' / '),
    image: p.images?.small?.[0]?.url || p.images?.large?.[0]?.url || null,
    text: stripHtml(`${p.shortDescription || ''}\n${p.longDescription || ''}`),
    nutritionText: stripHtml(p.custom?.nutritionAndIngredients || ''),
    shortDate: /outlet|kort dato|best før/i.test(`${tile.category} ${p.productName}`),
    promoText: promo.join(' | ') || null,
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'sfcc', pid: tile.pid, url: tile.url },
  };
}

export async function scan(shop, ctx) {
  const conf = CONF[shop.id];
  const tiles = new Map();
  for (const cgid of conf.cgids) {
    for (let start = 0; start < 6000; start += 500) {
      const html = await ctx.text(grid(shop, conf, cgid, start, 500));
      const list = html ? parseTiles(html, shop.url) : [];
      for (const t of list) if (!tiles.has(t.pid)) tiles.set(t.pid, t);
      if (list.length < 500) break;
    }
  }
  const wanted = [...tiles.values()].filter((t) => !SKIP_CAT.test(t.category));
  ctx.log(`${shop.id}: ${tiles.size} i rutenett, ${wanted.length} aktuelle`);
  const out = await mapLimit(wanted, 6, (t) => product(shop, conf, t, ctx, ctx.perVariantPrice !== false));
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const conf = CONF[shop.id];
  return product(shop, conf, { pid: raw.refresh.pid, url: raw.refresh.url, name: raw.name, brand: raw.brand, category: raw.shopCategory }, ctx, true);
}

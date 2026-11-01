// Shopware 6 (Bodylab): produkt-URL-er fra sitemap, pris/lager/holdbarhet per smak fra produktsiden.
import { stripHtml, decodeEntities, mapLimit, findLdProduct, parsePrice } from '../core/util.js';

const NOT_PRODUCT = /\/(kundeservice|blogg?|artikler|om-oss|kontakt|tilbud|nyheter|guide|treningsprogram|vilkar|personvern|cookie|nyhetsbrev|search|account|checkout)/i;

export function parseProductPage(shop, url, html) {
  const ld = findLdProduct(html);
  if (!ld) return null;
  const variants = [];
  const re = /<div class="product-detail-configurator-option([^"]*)"\s+data-variant-id="([^"]+)"[^>]*?data-variant-price="([^"]*)"(?:\s+data-variant-list-price="([^"]*)")?[^>]*?data-expiration-date="([^"]*)"[^>]*?title="([^"]*)"[^>]*>/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    const title = decodeEntities(m[6]);
    const flavor = title.includes(' - ') ? title.split(' - ').slice(1).join(' - ').trim() : title;
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const soldOut = /sold-out/.test(after) || /aria-disabled="true"/.test(m[0]);
    const price = parsePrice(m[3]);
    const list = parsePrice(m[4]);
    variants.push({ id: m[2], flavor, size: null, price, listPrice: list && list > price ? list : null, inStock: !soldOut, url, expiry: m[5] || null });
  }
  // Bodylab har egen pakningsgruppe (BOX/PCS) for barer og drikke. Hver smak står da to ganger:
  // eskepris og stykkpris. Vi beholder eskeprisen (den høyeste) per smak.
  const PACK = /^(box|pcs|stk|eske|kasse|pakke|single)$/i;
  if (variants.filter((v) => PACK.test(v.flavor || '')).length >= 2) {
    const byFlavor = new Map();
    for (const v of variants) {
      if (PACK.test(v.flavor || '')) continue;
      const cur = byFlavor.get(v.flavor);
      if (!cur || v.price > cur.price) byFlavor.set(v.flavor, v);
    }
    variants.length = 0;
    variants.push(...byFlavor.values());
  }
  if (!variants.length) {
    const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    const price = parsePrice(offer?.price);
    if (price) variants.push({ id: ld.sku || url, flavor: null, size: null, price, listPrice: null, inStock: /InStock/i.test(offer?.availability || ''), url });
  }
  const crumbs = [];
  for (const m2 of html.matchAll(/"@type":\s*"ListItem"[^}]*?"name":\s*"([^"]+)"/g)) crumbs.push(decodeEntities(m2[1]));
  // Næringsinnhold ligger i en fane på siden
  let ni = html.search(/Innhold pr\.?|Ingredienser &amp; n(æ|ae)ringsinnhold/i);
  if (ni < 0) ni = html.search(/n(æ|ae)ringsinn?hold/i);
  const nutritionText = ni > 0 ? stripHtml(html.slice(ni, ni + 30000)).slice(0, 3000) : '';
  const descStart = html.search(/class="product-detail-description/);
  const text = descStart > 0 ? stripHtml(html.slice(descStart, descStart + 12000)) : stripHtml(ld.description || '');
  return {
    shop: shop.id,
    id: ld.sku || url,
    url,
    name: decodeEntities(ld.name),
    brand: ld.brand?.name || 'Bodylab',
    shopCategory: crumbs.slice(1, -1).join(' / '),
    image: Array.isArray(ld.image) ? ld.image[0] : ld.image || null,
    text,
    nutritionText,
    shortDate: variants.some((v) => v.expiry) || /kort dato|best før/i.test(ld.name),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'page', url },
  };
}

export async function scan(shop, ctx) {
  const index = await ctx.text(`${shop.url}/sitemap.xml`);
  const maps = [...(index || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1]));
  const urls = new Set();
  for (const sm of maps) {
    const xml = await ctx.text(sm);
    for (const m of (xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = decodeEntities(m[1]);
      const path = new URL(u).pathname;
      // Produkter ligger på ett nivå (/whey-100-1-kg); kategorier har flere nivåer.
      if (path.split('/').filter(Boolean).length === 1 && !NOT_PRODUCT.test(path)) urls.add(u);
    }
  }
  ctx.log(`${shop.id}: ${urls.size} mulige produktsider`);
  const out = await mapLimit([...urls], 5, async (u) => {
    const html = await ctx.text(u);
    return html ? parseProductPage(shop, u, html) : null;
  });
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  return html ? parseProductPage(shop, raw.refresh.url, html) : null;
}

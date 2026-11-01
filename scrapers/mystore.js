// Mystore (Extreme Fitness, Hardcore Dealer): produkter fra sitemap, data fra produktsiden.
import { stripHtml, decodeEntities, mapLimit, findLdProduct, parsePrice } from '../core/util.js';

// Åpenbare ikke-kosttilskudd i URL-en hoppes over for å spare forespørsler.
const SKIP_SLUG = /t-?skjorte|tee-|shirt|hoodie|tights|shorts|leggings|bukse|singlet|tank|topp|bh-|sports-?bra|jakke|sokker|caps|lue|hanske|belte|straps|wraps|knee|sleeve|bag|sekk|flaske|shaker|manual|kettlebell|vektskive|stang|benk|matte|band|rulle|roller|sko-|gavekort|hoppetau/i;

function hidden(html, name) {
  const m = html.match(new RegExp(`<input type="hidden" name="${name}" value="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

export function parseProductPage(shop, url, html) {
  const ld = findLdProduct(html);
  const name = hidden(html, 'name') || ld?.name;
  if (!name) return null;
  const price = parsePrice(hidden(html, 'price')) ?? parsePrice((Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers)?.price);
  const orig = parsePrice(hidden(html, 'original_price'));
  const category = hidden(html, 'category') || '';
  const priceList = {};
  for (const m of html.matchAll(/price_list\['(\d+-\d+)'\]\s*=\s*"([^"]*)"/g)) priceList[m[1]] = parsePrice(m[2]);
  const variants = [];
  const selects = [...html.matchAll(/<select[^>]*name="id\[(\d+)\]"[^>]*>([\s\S]*?)<\/select>/g)];
  // Etiketten foran select forteller om det er smak eller størrelse
  const labelFor = (idx) => html.slice(Math.max(0, idx - 600), idx).replace(/<[^>]+>/g, ' ').toLowerCase();
  let flavorSel = null;
  let sizeSel = null;
  for (const s of selects) {
    const lab = labelFor(s.index);
    if (/st(ø|o)rr|size|vekt|pakning|antall/.test(lab.slice(-120))) sizeSel = sizeSel || s;
    else flavorSel = flavorSel || s;
  }
  const opts = (sel) =>
    [...sel[2].matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]*)/g)]
      .filter((o) => o[1] !== '0')
      .map((o) => {
        const txt = decodeEntities(o[2]).trim();
        const out = /ikke p(å|a) lager|utsolgt|tomt/i.test(txt);
        const label = txt.replace(/\s*-?\s*\*[^*]*\*\s*$/, '').replace(/\s*\([+-][^)]*\)\s*$/, '').trim();
        return { key: `${sel[1]}-${o[1]}`, label, out };
      });
  if (flavorSel) {
    const sizes = sizeSel ? opts(sizeSel) : [null];
    for (const f of opts(flavorSel)) {
      for (const sz of sizes) {
        const p = priceList[f.key] ?? (sz && priceList[sz.key]) ?? price;
        variants.push({ id: sz ? `${f.key},${sz.key}` : f.key, flavor: f.label, size: sz?.label || null, price: p, listPrice: orig && orig > p ? orig : null, inStock: !f.out && !(sz && sz.out), url });
      }
    }
  } else if (sizeSel) {
    for (const sz of opts(sizeSel)) {
      const p = priceList[sz.key] ?? price;
      variants.push({ id: sz.key, flavor: null, size: sz.label, price: p, listPrice: orig && orig > p ? orig : null, inStock: !sz.out, url });
    }
  } else {
    const offer = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
    const inStock = offer?.availability ? /InStock/i.test(offer.availability) : !/Midlertidig utsolgt|Ikke på lager/i.test(html.slice(html.indexOf('add2cart'), html.indexOf('add2cart') + 20000));
    variants.push({ id: ld?.sku || url, flavor: null, size: null, price, listPrice: orig && orig > price ? orig : null, inStock, url });
  }
  // Beskrivelse og næringsinnhold: tekst fra hovedinnholdet
  const start = html.indexOf('id="add2cart"');
  const body = start > 0 ? stripHtml(html.slice(start, start + 60000)) : '';
  const ni = body.search(/n(æ|ae)ringsinn?hold|per 100 ?g|pr\.? 100 ?g/i);
  return {
    shop: shop.id,
    id: ld?.sku || url,
    url,
    name,
    brand: hidden(html, 'brand') || ld?.brand?.name || null,
    shopCategory: category,
    image: hidden(html, 'image') || (Array.isArray(ld?.image) ? ld.image[0] : ld?.image) || null,
    text: `${ld?.description || ''}\n${body.slice(0, 8000)}`,
    nutritionText: ni >= 0 ? body.slice(Math.max(0, ni - 200), ni + 2500) : '',
    shortDate: /kort dato|best f(ø|o)r|outlet|billigkroken/i.test(`${name} ${category}`),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'page', url },
  };
}

export async function scan(shop, ctx) {
  const xml = await ctx.text(`${shop.url}/sitemap.xml`);
  const urls = [...new Set([...(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1])).filter((u) => /\/products\//.test(u) && !SKIP_SLUG.test(u)))];
  ctx.log(`${shop.id}: ${urls.length} produktsider`);
  const out = await mapLimit(urls, 6, async (u) => {
    const html = await ctx.text(u);
    return html ? parseProductPage(shop, u, html) : null;
  });
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  return html ? parseProductPage(shop, raw.refresh.url, html) : null;
}

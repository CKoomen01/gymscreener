// Sunkost (WordPress/WooCommerce fra nov. 2026): produkter fra kategorisidene, data fra produktsiden.
// /wp-json/ er sperret i robots.txt, så Store API brukes ikke.
import { stripHtml, decodeEntities, mapLimit, findLdProduct, parsePrice } from '../core/util.js';

// Kategorier som er relevante. Urter, enzymer og probiotika er utelatt.
const CATS = [
  'kosttilskudd/vitaminer-mineraler',
  'kosttilskudd/aminosyrer',
  'kosttilskudd/fettsyrer',
  'kosttilskudd/kombinasjonsprodukter',
  'kosttilskudd/proteiner-karbohydrater',
  'kosttilskudd/maltidserstatning',
  'sunn-snacks/barer',
  'drikke/proteindrikk',
];

const PRODUCT_LINK = /href="(https:\/\/sunkost\.no\/produkt\/[^"#?]+)"/g;

// «kosttilskudd/proteiner-karbohydrater» → «Kosttilskudd / Proteiner karbohydrater»
const catLabel = (path) => path.split('/').map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')).join(' / ');

export function parseProductPage(shop, url, html, category = '') {
  const ld = findLdProduct(html);
  if (!ld?.name) return null;
  const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
  // Prisblokken til hovedproduktet står etter varenummeret; senere prisblokker hører til andre produkter
  const at = Math.max(0, html.indexOf('Varenummer'));
  const priceHtml = html.slice(html.indexOf('class="price', at), html.indexOf('class="price', at) + 1500);
  const was = priceHtml.match(/Opprinnelig pris var:\s*([\d\s.,&nbsp;]+)/);
  const now = priceHtml.match(/Nåværende pris er:\s*([\d\s.,&nbsp;]+)/);
  const price = parsePrice(now?.[1]?.replace(/&nbsp;/g, '')) ?? parsePrice(offer?.price);
  const listPrice = parsePrice(was?.[1]?.replace(/&nbsp;/g, ''));
  const body = stripHtml(html.slice(at, at + 80000));
  const end = body.search(/Bli Sunkost-medlem/);
  const text = end > 0 ? body.slice(0, end) : body.slice(0, 8000);
  const size = text.match(/Innhold:\s*(.{1,40}?)\s*Varenummer/i) || html.match(/Innhold:\s*([^<\n]{1,40})/i);
  const ni = text.search(/N(æ|ae)ringsinnhold/i);
  let nutritionText = ni >= 0 ? text.slice(ni, ni + 3000) : '';
  // Tabellene mangler ofte «per 100 g». Er energien minst 280 kcal, er det per 100 g (en porsjon eller bar ligger lavere).
  const kcal = nutritionText.match(/\d{3,4}\s*kj?\s*\/\s*(\d{2,3})\s*kcal|\d{3,4}\s*\/\s*(\d{2,3})\b/i);
  if (nutritionText && !/100\s?(g|ml)/i.test(nutritionText.slice(0, 200)) && kcal && Number(kcal[1] || kcal[2]) >= 280) {
    nutritionText = `Næringsinnhold per 100 g\n${nutritionText.replace(/^N(æ|ae)ringsinnhold/i, '')}`;
  }
  const name = decodeEntities(stripHtml(ld.name));
  const weightText = size ? size[1].trim() : null;
  return {
    shop: shop.id,
    id: String(ld.sku || url),
    url,
    name: weightText && !/\d/.test(name) ? `${name}, ${weightText}` : name,
    brand: ld.brand?.name || null,
    shopCategory: category,
    image: Array.isArray(ld.image) ? ld.image[0] : ld.image || null,
    text: `${ld.description || ''}\n${text.slice(0, 8000)}`,
    nutritionText,
    weightText,
    shortDate: /outlet|kort dato|best f(ø|o)r/i.test(`${name} ${category}`),
    variants: [
      {
        id: String(ld.sku || url),
        flavor: null,
        size: null,
        price,
        listPrice: listPrice && listPrice > price ? listPrice : null,
        inStock: offer?.availability ? /InStock|LimitedAvailability/i.test(offer.availability) : true,
        url,
      },
    ].filter((v) => v.price > 0),
    refresh: { kind: 'page', url, category },
  };
}

export async function scan(shop, ctx) {
  const found = new Map(); // url → kategori
  for (const cat of CATS) {
    for (let page = 1; page < 60; page++) {
      const html = await ctx.text(`${shop.url}/kategori/${cat}/${page > 1 ? `page/${page}/` : ''}`);
      if (!html) break;
      let added = 0;
      for (const m of html.matchAll(PRODUCT_LINK)) {
        if (!found.has(m[1])) {
          found.set(m[1], catLabel(cat));
          added++;
        }
      }
      if (!added) break;
    }
  }
  ctx.log(`${shop.id}: ${found.size} produktsider`);
  const out = await mapLimit([...found], 4, async ([url, cat]) => {
    const html = await ctx.text(url);
    return html ? parseProductPage(shop, url, html, cat) : null;
  });
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  return html ? parseProductPage(shop, raw.refresh.url, html, raw.refresh.category || raw.shopCategory || '') : null;
}

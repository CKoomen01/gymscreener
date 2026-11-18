// Mystore (Extreme Fitness, Hardcore Dealer): produkter fra sitemap, data fra produktsiden.
import { stripHtml, decodeEntities, findLdProduct, parsePrice, sleep } from '../core/util.js';
import { normalize } from '../core/normalize.js';

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

// Mystore-butikkene ber om «Crawl-delay: 5» i robots.txt og blokkerer IP-en i timevis ved flere kall.
// Derfor hentes én side hvert 5. sekund innenfor et tidsbudsjett. Kjente kosttilskudd hentes først,
// sider som ikke er kosttilskudd huskes og sjekkes bare ukentlig, og sider vi ikke rakk beholder forrige skann.
const CRAWL_DELAY_MS = 5000;
const BUDGET_MS = 11 * 60 * 1000;
const RECHECK_SKIP_MS = 7 * 24 * 3600 * 1000;
const MAX_FAILS_IN_ROW = 3;

export async function scan(shop, ctx) {
  const xml = await ctx.text(`${shop.url}/sitemap.xml`);
  const urls = [...new Set([...(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1])).filter((u) => /\/products\//.test(u) && !SKIP_SLUG.test(u)))];
  if (!urls.length) return [];
  const prevByUrl = new Map();
  for (const p of ctx.previous || []) (prevByUrl.get(p.u) || prevByUrl.set(p.u, []).get(p.u)).push(p);
  const old = ctx.crawl || {};
  const now = Date.now();
  const crawl = { fetched: {}, skip: {} };
  for (const u of urls) {
    if (old.fetched?.[u]) crawl.fetched[u] = old.fetched[u];
    if (old.skip?.[u] && now - Date.parse(old.skip[u]) < RECHECK_SKIP_MS) crawl.skip[u] = old.skip[u];
  }
  // Rekkefølge: eldst hentet først; kjente kosttilskudd foran ukjente sider ved likt tidspunkt
  const queue = urls
    .filter((u) => !crawl.skip[u])
    .sort((a, b) => (Date.parse(crawl.fetched[a] || 0) || 0) - (Date.parse(crawl.fetched[b] || 0) || 0) || (prevByUrl.has(b) ? 1 : 0) - (prevByUrl.has(a) ? 1 : 0));
  ctx.log(`${shop.id}: ${urls.length} produktsider, ${Object.keys(crawl.skip).length} kjente ikke-kosttilskudd hoppes over, ${queue.length} i kø`);

  const raws = [];
  const done = new Set();
  let fails = 0;
  for (const u of queue) {
    if (Date.now() - now > BUDGET_MS) break;
    if (done.size) await sleep(shop.crawlDelayMs ?? CRAWL_DELAY_MS);
    const html = await ctx.text(u, { attempts: 1, timeoutMs: 30000 }); // nytt forsøk kommer i neste skann
    const status = ctx.lastStatus;
    const raw = html ? parseProductPage(shop, u, html) : null;
    if (!html && status !== 404 && status !== 410) {
      if (++fails >= MAX_FAILS_IN_ROW) {
        ctx.log(`${shop.id}: ${fails} feil på rad (status ${status}) – stopper for å ikke belaste butikken`);
        break;
      }
      continue;
    }
    fails = 0;
    done.add(u);
    if (raw && normalize(raw).length) {
      raws.push(raw);
      crawl.fetched[u] = new Date().toISOString();
    } else {
      crawl.skip[u] = new Date().toISOString();
      delete crawl.fetched[u];
    }
  }
  // Kosttilskudd vi ikke rakk denne gangen: behold forrige skann (bare hvis siden fortsatt finnes)
  const keep = urls.filter((u) => !done.has(u) && !crawl.skip[u]).flatMap((u) => prevByUrl.get(u) || []);
  ctx.log(`${shop.id}: ${done.size} sider hentet, ${raws.length} kosttilskudd oppdatert, ${keep.length} beholdt fra forrige skann`);
  return { raws, keep, crawl };
}

export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  return html ? parseProductPage(shop, raw.refresh.url, html) : null;
}

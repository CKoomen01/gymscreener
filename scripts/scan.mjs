// Full skann av alle butikker. Kjøres av GitHub Actions flere ganger daglig, eller lokalt:
//   node scripts/scan.mjs                 (alle butikker)
//   SHOPS=sportylab,apex node scripts/scan.mjs
// Skriver public/data/products.json. Feiler en butikk, beholdes forrige skann for den butikken.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SHOP_IDS } from '../core/shops.js';
import { normalize } from '../core/normalize.js';
import { mapLimit, sleep } from '../core/util.js';
import { shopWithId, scraperFor, scanPromos } from '../scrapers/index.js';

const OUT = new URL('../public/data/products.json', import.meta.url);
const PREV_URL = process.env.PREV_DATA_URL; // forrige publiserte data (brukes i Actions)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Gymscreener/1.0 (prissammenligning)';

function makeCtx(shopId) {
  let requests = 0;
  async function req(url, opts = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      requests++;
      try {
        const res = await fetch(url, {
          method: opts.method || 'GET',
          headers: { 'User-Agent': UA, 'Accept-Language': 'nb-NO,nb;q=0.9', ...(opts.headers || {}) },
          body: opts.body,
          redirect: 'follow',
          signal: AbortSignal.timeout(45000),
        });
        if (res.status === 429 || res.status >= 500) {
          await sleep(4000 * (attempt + 1));
          continue;
        }
        if (!res.ok) return null;
        return await res.text();
      } catch {
        await sleep(2000 * (attempt + 1));
      }
    }
    return null;
  }
  return {
    log: (...a) => console.log(`[${shopId}]`, ...a),
    text: (url, opts) => req(url, opts),
    json: async (url, opts) => {
      const t = await req(url, { ...opts, headers: { Accept: 'application/json', ...(opts?.headers || {}) } });
      if (!t) return null;
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
    },
    get requests() {
      return requests;
    },
  };
}

async function loadPrevious() {
  try {
    if (PREV_URL) {
      const r = await fetch(PREV_URL, { signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
    }
  } catch {
    /* ingen forrige data */
  }
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const only = process.env.SHOPS ? process.env.SHOPS.split(',') : SHOP_IDS;
  const prev = await loadPrevious();
  const started = Date.now();
  const shops = {};
  const products = [];

  await mapLimit(only, 5, async (id) => {
    const shop = shopWithId(id);
    const ctx = makeCtx(id);
    const t0 = Date.now();
    let items = [];
    let error = null;
    try {
      const raws = await scraperFor(id).scan(shop, ctx);
      for (const r of raws) items.push(...normalize(r));
    } catch (e) {
      error = String(e?.stack || e);
    }
    let promos = null;
    try {
      promos = await scanPromos(shop, ctx);
    } catch {
      promos = null;
    }
    const prevItems = prev?.products?.filter((p) => p.s === id) || [];
    let status = 'ok';
    // Faller tilbake til forrige skann hvis noe gikk galt eller resultatet ser ufullstendig ut
    if (error || items.length === 0 || (prevItems.length > 20 && items.length < prevItems.length * 0.4)) {
      status = prevItems.length ? 'stale' : 'error';
      items = prevItems;
    }
    products.push(...items);
    shops[id] = {
      status,
      count: items.length,
      error: error ? error.slice(0, 400) : null,
      scannedAt: status === 'ok' ? new Date().toISOString() : prev?.shops?.[id]?.scannedAt || null,
      promos: promos || prev?.shops?.[id]?.promos || null,
      requests: ctx.requests,
      seconds: Math.round((Date.now() - t0) / 1000),
    };
    console.log(`[${id}] ${status}: ${items.length} produkter, ${ctx.requests} kall, ${shops[id].seconds}s${error ? ' FEIL: ' + error.split('\n')[0] : ''}`);
  });

  // Behold butikker som ikke ble skannet denne gangen (ved SHOPS=...)
  if (prev && process.env.SHOPS) {
    for (const id of SHOP_IDS) {
      if (only.includes(id)) continue;
      products.push(...(prev.products || []).filter((p) => p.s === id));
      if (prev.shops?.[id]) shops[id] = prev.shops[id];
    }
  }

  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
  const data = { generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), shops, products };
  await writeFile(OUT, JSON.stringify(data));
  console.log(`Ferdig: ${products.length} produkter fra ${Object.keys(shops).length} butikker på ${data.seconds}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

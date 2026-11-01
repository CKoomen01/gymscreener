// Stikkprøve: henter tilfeldige produkter på nytt fra butikkene og sammenligner med publiserte data.
//   node scripts/spotcheck.mjs [antall per butikk]
import { readFile } from 'node:fs/promises';
import { SHOP_IDS } from '../core/shops.js';
import { normalize } from '../core/normalize.js';
import { PLATFORMS, shopWithId } from '../scrapers/index.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Gymscreener/1.0 (prissammenligning)';
const ctx = {
  log: () => {},
  text: async (u, o = {}) => {
    const r = await fetch(u, { method: o.method || 'GET', headers: { 'User-Agent': UA, ...(o.headers || {}) }, body: o.body, signal: AbortSignal.timeout(30000) });
    return r.ok ? r.text() : null;
  },
  json: async (u, o = {}) => {
    const t = await ctx.text(u, { ...o, headers: { Accept: 'application/json', ...(o.headers || {}) } });
    try {
      return t ? JSON.parse(t) : null;
    } catch {
      return null;
    }
  },
};

const per = Number(process.argv[2] || 1);
const data = JSON.parse(await readFile(new URL('../public/data/products.json', import.meta.url), 'utf8'));
let ok = 0;
let diff = 0;
for (const id of SHOP_IDS) {
  const pool = data.products.filter((p) => p.s === id && p.v.some((v) => v.st));
  for (let i = 0; i < per && pool.length; i++) {
    const prod = pool[Math.floor(Math.random() * pool.length)];
    const shop = shopWithId(id);
    const raw = { id: prod.k.split(':')[1], name: prod.n, brand: prod.b, url: prod.u, shopCategory: '', refresh: prod.r, variants: prod.v.map((v) => ({ inStock: !!v.st })) };
    let fresh = null;
    try {
      fresh = await PLATFORMS[shop.platform].refresh(shop, raw, ctx);
    } catch (e) {
      console.log(`${id}: FEIL ${e.message}`);
    }
    const linkStatus = await fetch(prod.u, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) }).then((r) => r.status).catch(() => 'feil');
    if (!fresh) {
      console.log(`${id.padEnd(16)} ${prod.n.slice(0, 45).padEnd(45)} | lenke ${linkStatus} | kunne ikke hente på nytt`);
      diff++;
      continue;
    }
    const now = normalize(fresh).find((p) => p.k === prod.k) || normalize(fresh)[0];
    const rows = prod.v.slice(0, 4).map((v) => {
      const nv = now?.v.find((x) => x.id === v.id) || now?.v.find((x) => x.f === v.f);
      const same = nv && nv.p === v.p && nv.st === v.st;
      return `${v.f || '-'}: ${v.p}${v.st ? '' : '(utsolgt)'} -> ${nv ? `${nv.p}${nv.st ? '' : '(utsolgt)'}` : '?'}${same ? '' : ' *'}`;
    });
    const changed = rows.some((r) => r.endsWith('*'));
    changed ? diff++ : ok++;
    console.log(`${id.padEnd(16)} ${prod.n.slice(0, 45).padEnd(45)} | lenke ${linkStatus} | ${changed ? 'ENDRET' : 'likt  '} | ${rows.join('; ')}`);
  }
}
console.log(`\n${ok} like, ${diff} endret/feil (endring kan være ekte prisendring siden skannet ${data.generatedAt})`);

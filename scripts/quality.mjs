// Datakvalitetsrapport for public/data/products.json: dekning per butikk/kategori og mistenkelige priser.
//   node scripts/quality.mjs
import { readFile } from 'node:fs/promises';
import { perUnit, defaultUnit } from '../core/pricing.js';

const data = JSON.parse(await readFile(new URL('../public/data/products.json', import.meta.url), 'utf8'));
const P = data.products;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');

console.log('Butikk           status  prod  vekt  prot%  smak  lager');
for (const [id, s] of Object.entries(data.shops)) {
  const ps = P.filter((p) => p.s === id);
  const prot = ps.filter((p) => p.c === 'protein');
  const vars = ps.flatMap((p) => p.v);
  console.log(
    id.padEnd(16),
    String(s.status).padEnd(7),
    String(ps.length).padStart(5),
    pct(ps.filter((p) => p.g || p.cnt).length, ps.length).padStart(5),
    pct(prot.filter((p) => p.pp).length, prot.length).padStart(6),
    pct(vars.filter((v) => v.f).length, vars.length).padStart(5),
    pct(vars.filter((v) => v.st).length, vars.length).padStart(6),
    s.promos?.codes?.length ? `koder: ${s.promos.codes.map((c) => c.code).join(',')}` : ''
  );
}

console.log('\nKategorier:');
const cats = {};
for (const p of P) cats[`${p.c}/${p.sc}`] = (cats[`${p.c}/${p.sc}`] || 0) + 1;
console.log(Object.entries(cats).sort().map(([k, v]) => `${k}:${v}`).join('  '));

console.log('\nBilligste 8 per kategori (sjekk for feil):');
for (const cat of ['protein', 'kreatin', 'pwo', 'aminosyrer', 'gainer', 'barer', 'drikke', 'vitaminer']) {
  const unit = defaultUnit(cat);
  const rows = P.filter((p) => p.c === cat)
    .flatMap((p) => p.v.filter((v) => v.st).map((v) => ({ p, v, m: perUnit(v.p, p, unit) })))
    .filter((r) => r.m)
    .sort((a, b) => a.m - b.m);
  console.log(`\n${cat} (${unit}):`);
  for (const r of rows.slice(0, 8)) console.log(`  ${Math.round(r.m * 100) / 100}\t${r.p.s}\t${r.v.p} kr\t${r.p.g}g pp=${r.p.pp} ag=${r.p.ag} cnt=${r.p.cnt} dd=${r.p.dd}\t${r.p.n} [${r.v.f}]`);
}

const groups = {};
for (const p of P) (groups[p.mk] ||= new Set()).add(p.s);
console.log('\nProdukter i >=2 butikker:', Object.values(groups).filter((s) => s.size >= 2).length);

// Legger siste skann inn i prishistorikken.
//   node scripts/history.mjs
// Leser public/data/products.json og public/data/history.json (hentet fra data-grenen i Actions),
// skriver oppdatert public/data/history.json.
import { readFile, writeFile } from 'node:fs/promises';
import { addSnapshot, prune, osloDate } from '../core/history.js';

const P = new URL('../public/data/products.json', import.meta.url);
const H = new URL('../public/data/history.json', import.meta.url);

const data = JSON.parse(await readFile(P, 'utf8'));
let history = null;
try {
  history = JSON.parse(await readFile(H, 'utf8'));
} catch {
  history = null;
}
if (!history?.series) {
  if (process.env.REQUIRE_HISTORY === '1') {
    // I Actions skal historikken alltid finnes etter første kjøring; tom fil betyr at noe gikk galt
    console.error('Fant ingen historikk å bygge videre på. Avbryter for ikke å overskrive den.');
    process.exit(1);
  }
  console.log('Starter ny prishistorikk.');
}

// Bare butikker som faktisk ble skannet nå (ikke reserve-data fra forrige skann) logges
const fresh = new Set(Object.entries(data.shops).filter(([, s]) => s.status === 'ok').map(([id]) => id));
const products = data.products.filter((p) => fresh.has(p.s));
const date = osloDate(new Date(data.generatedAt));
history = prune(addSnapshot(history, products, date), date);
const n = Object.keys(history.series).length;
await writeFile(H, JSON.stringify(history));
console.log(`Prishistorikk ${date}: ${n} serier (start ${history.start}), ${(JSON.stringify(history).length / 1024).toFixed(0)} kB`);

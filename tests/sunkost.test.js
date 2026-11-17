import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductPage } from '../scrapers/sunkost.js';
import { normalize } from '../core/normalize.js';

const shop = { id: 'sunkost', url: 'https://sunkost.no' };
const page = (name, priceHtml, body, avail = 'InStock', ldPrice = 160) => `
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"Product","name":"${name}","sku":"123","brand":{"@type":"Brand","name":"Synergy"},
"offers":[{"@type":"Offer","price":"${ldPrice}","priceCurrency":"NOK","availability":"https://schema.org/${avail}"}]}</script>
<nav><p class="price">999 kr</p></nav>
<h1>${name}</h1><p>Innhold: 400 g</p><p>Varenummer: 123</p>${priceHtml}
<div>${body}</div><p>Bli Sunkost-medlem</p><p class="price">49 kr</p>`;

test('Sunkost: kampanjepris, lager og næringstabell uten «per 100 g»', () => {
  const html = page(
    'Synergy Protein Vanilje &amp; Bær',
    '<p class="price has-sale"><del>229&nbsp;kr Opprinnelig pris var: 229&nbsp;kr.</del> <ins>160&nbsp;kr Nåværende pris er: 160&nbsp;kr.</ins></p>',
    'Om produktet. Næringsinnhold <table><tr><td>Energi(kj/kcal)</td><td>1591/377</td></tr><tr><td>Protein</td><td>76 g</td></tr></table>',
  );
  const raw = parseProductPage(shop, 'https://sunkost.no/produkt/x/', html, 'Kosttilskudd / Proteiner karbohydrater / Proteinpulver');
  assert.equal(raw.name, 'Synergy Protein Vanilje & Bær, 400 g');
  assert.equal(raw.variants[0].price, 160);
  assert.equal(raw.variants[0].listPrice, 229);
  assert.equal(raw.variants[0].inStock, true);
  const [p] = normalize(raw);
  assert.equal(p.c, 'protein');
  assert.equal(p.g, 400);
  assert.equal(p.pp, 76);
});

test('Sunkost: tabell per porsjon tolkes ikke som per 100 g, og utsolgt leses', () => {
  const html = page('Synergy Protein Sjokolade', '<p class="price">349&nbsp;kr</p>', 'Næringsinnhold Energi 480/115 Protein 22 g', 'OutOfStock', 349);
  const raw = parseProductPage(shop, 'https://sunkost.no/produkt/y/', html, 'Kosttilskudd / Proteiner karbohydrater / Proteinpulver');
  assert.equal(raw.variants[0].price, 349);
  assert.equal(raw.variants[0].listPrice, null);
  assert.equal(raw.variants[0].inStock, false);
  assert.equal(normalize(raw)[0].pp, null);
});

test('protein per bar fra næringstabellen, ikke urimelig tekst', () => {
  const bar = (text) =>
    normalize({ shop: 'sunkost', id: 'b', url: 'u', name: 'Protein Marzipan Bar, 55 g', brand: 'X', shopCategory: 'Sunn snacks / Barer', text, nutritionText: '', variants: [{ id: 'b', price: 35, inStock: true, url: 'u' }] })[0];
  assert.equal(bar('Inneholder 50 g protein').pu, null); // mer protein enn baren veier er umulig
  assert.equal(bar('Inneholder 16 g protein').pu, 16);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice } from '../core/util.js';
import { parseWeight, parseCount, flavorGroups, classify, proteinPer100, flavorFromName, creatineGrams, normalize } from '../core/normalize.js';
import { orderTotal, optimizeCart, perUnit } from '../core/pricing.js';
import { parsePromos } from '../scrapers/promos.js';
import { rankRows } from '../core/rank.js';

test('parsePrice', () => {
  assert.equal(parsePrice('1.169,-'), 1169);
  assert.equal(parsePrice('479,-'), 479);
  assert.equal(parsePrice('1 299,00 kr'), 1299);
  assert.equal(parsePrice('499.00'), 499);
  assert.equal(parsePrice(83900, 2), 839);
});

test('parseWeight', () => {
  assert.equal(parseWeight('Whey-80, 1 kg'), 1000);
  assert.equal(parseWeight('3 x 400 g'), 1200);
  assert.equal(parseWeight('Big 100 Bar 12x100g'), 1200);
  assert.equal(parseWeight('1,8 kg'), 1800);
  assert.equal(parseWeight('100% Whey Protein Professional 1816g Chocolate'), 1816);
  assert.equal(parseWeight('Gold Standard 5 lbs'), 2268);
  assert.equal(parseWeight('Creapure 150 caps'), null);
  assert.equal(parseWeight('Mix&Match: 4 x Whey-80 Myseprotein 1 kg'), 4000);
  assert.equal(parseWeight('15 x Proteinbar 50 g'), 750);
  assert.deepEqual(parseCount('15 x Proteinbar 50 g'), { count: 15, unit: 'stk' });
});

test('parseCount', () => {
  assert.deepEqual(parseCount('Creatine Creapure 150 caps'), { count: 150, unit: 'kapsler' });
  assert.deepEqual(parseCount('Omega-3 120 softgels'), { count: 120, unit: 'softgels' });
  assert.deepEqual(parseCount('Barebells 12 x 55 g'), { count: 12, unit: 'stk' });
});

test('smaksgrupper', () => {
  assert.deepEqual(flavorGroups('Ultimate Chocolate'), ['Sjokolade']);
  assert.deepEqual(flavorGroups('Raspberry'), ['Bringebær']);
  assert.ok(flavorGroups('Cookies & Cream').includes('Kake / cookie'));
  assert.deepEqual(flavorGroups('Neutral'), ['Naturell / uten smak']);
  assert.deepEqual(flavorGroups('Skumnisse'), ['Kremet / dessert']);
  assert.equal(flavorFromName('Bodylab Clear Whey Raspberry Rush'), 'Raspberry Rush');
  assert.equal(flavorFromName('Whey Protein - Vanilla 900 g, proteinpulver'), 'Vanilla');
});

test('klassifisering', () => {
  assert.deepEqual(classify({ name: 'Whey Protein Isolate Grass Fed - 800g', shopCategory: 'Protein' }), { cat: 'protein', sub: 'isolat' });
  assert.equal(classify({ name: 'Creatine Monohydrate 500 g', shopCategory: '' }).cat, 'kreatin');
  assert.equal(classify({ name: 'Creatine Creapure 150 caps', shopCategory: '' }).sub, 'kapsler');
  assert.equal(classify({ name: 'Barebells Protein Bar Salty Peanut', shopCategory: '' }).cat, 'barer');
  assert.equal(classify({ name: 'Shaker 700 ml', shopCategory: 'Tilbehør' }), null);
  assert.equal(classify({ name: 'Omega-3 Fiskeolje 120 kapsler', shopCategory: '' }).sub, 'omega3');
  assert.equal(classify({ name: 'C4 Original Fruit Punch, pre-workout-pulver', shopCategory: '' }).cat, 'pwo');
});

test('protein per 100 g', () => {
  assert.equal(proteinPer100('', 'Innhold pr.\n|\n100 g\n|\nEnergi\n|\n1.639 kJ\n|\nFett\n|\n7,4 g\n|\nProtein\n|\n70 g\n|'), 70);
  assert.equal(proteinPer100('', 'Næringsinnhold | Per 45 g | Per 100 g\nProtein | 34 g | 75 g'), 75);
  assert.equal(proteinPer100('Gir 25 g protein per porsjon (30 g).', ''), 83.3);
  assert.equal(proteinPer100('Clear Whey indeholder opp til 86 % protein', ''), 86);
});

test('kreatin i kapsler', () => {
  const raw = { name: 'Creatine 150 caps', text: 'Hver kapsel inneholder 1000 mg kreatin per kapsel.' };
  assert.equal(creatineGrams(raw, 'kapsler', null, 150), 150);
});

test('promokoder fra butikkens side', () => {
  const p = parsePromos('💥200 kr rabatt ved kjøp over 999 kr💥 Din kode: SPAR200. Gratis frakt over 800,-');
  assert.equal(p.codes[0].code, 'SPAR200');
  assert.equal(p.codes[0].type, 'amount');
  assert.equal(p.codes[0].value, 200);
  assert.equal(p.codes[0].minOrder, 999);
  assert.equal(p.freeShippingBanner, 800);
  const mixed = parsePromos('Grab and Go opptil 40% · Swedish Supplements opptil 40% 💥200 kr rabatt ved kjøp over 999 kr💥 Din kode: SPAR200');
  assert.equal(mixed.codes[0].type, 'amount');
  assert.equal(mixed.codes[0].value, 200);
  const page = parsePromos('RABATTKODE Få 200kr i rabatt når du handler for 999kr Bruk kode: SPAR200 i kassen. Koden er aktiv f.o.m 29/10-26 t.o.m 1/11-99 Vilkår: Koden kan ikke brukes på gavekort, drikkekategorien. Gjelder også på allerede nedsatte produkter');
  assert.equal(page.codes[0].minOrder, 999);
  assert.equal(page.codes[0].value, 200);
  assert.equal(page.codes[0].appliesToSale, true);
  assert.equal(page.codes[0].excludesDrinks, true);
  assert.equal(parsePromos('Bruk kode: GAMMEL10 for 10 % rabatt. Gyldig t.o.m 1/1-20').codes.length, 0);
  const q = parsePromos('5% EKSTRA RABATT PÅ ALLE PRE-WORKOUTS MED RABATTKODEN: PWO5EKSTRA KUN GYLDIG I KORT TID');
  assert.equal(q.codes[0].code, 'PWO5EKSTRA');
  assert.equal(q.codes[0].scope, 'pwo');
  assert.equal(q.codes[0].value, 5);
});

test('ordretotal med frakt og kode', () => {
  const promos = { codes: [{ code: 'SPAR200', type: 'amount', value: 200, minOrder: 999, scope: 'alle' }] };
  const small = orderTotal('proteinfabrikken', [{ price: 500, onSale: false, qty: 1, cat: 'protein', kg: 1 }], {}, promos);
  assert.equal(small.discount, null);
  assert.equal(small.shipping, 69);
  assert.equal(orderTotal('tights', [{ price: 500, onSale: false, qty: 1, cat: 'protein', kg: 1 }], {}, null).shippingUnknown, true);
  const big = orderTotal('proteinfabrikken', [{ price: 500, onSale: false, qty: 2, cat: 'protein', kg: 1 }], {}, promos);
  assert.equal(big.discount.amount, 200);
  assert.equal(big.shipping, 0); // 800 etter rabatt = gratisgrensen
  assert.equal(big.total, 800);
  // Koden gjelder ikke nedsatte varer
  const sale = orderTotal('proteinfabrikken', [{ price: 500, onSale: true, qty: 2, cat: 'protein', kg: 1 }], {}, promos);
  assert.equal(sale.discount, null);
  const ov = orderTotal('tights', [{ price: 500, onSale: false, qty: 1, cat: 'protein', kg: 1 }], { shipOverride: { tights: { cheapest: 49, home: 49 } } }, null);
  assert.equal(ov.shipping, 49);
  assert.equal(ov.total, 549);
  const hc = orderTotal('hcdealer', [{ price: 300, onSale: false, qty: 1, cat: 'kreatin', kg: 0.5 }], {}, null);
  assert.equal(hc.shipping, 59);
  assert.equal(hc.missingForFree, 200);
  const ef = orderTotal('extremefitness', [{ price: 1000, onSale: false, qty: 1, cat: 'protein', kg: 1 }], {}, null);
  assert.equal(ef.shipping, 69);
});

test('studentrabatt kommer i tillegg til kampanjepris', () => {
  const t = orderTotal('tights', [{ price: 1000, onSale: true, qty: 1, cat: 'protein', kg: 1 }], { perks: { 'tights:student': true } }, null);
  assert.equal(t.perks[0].amount, 50);
  // Tights: gratisfraktgrensen gjelder beløpet etter rabatter, og 950 er under 999
  assert.equal(t.missingForFree, 49);
  assert.equal(t.total, 950);
  const prod = { k: 'tights:1', s: 'tights', n: 'Whey 1 kg', c: 'protein', sc: 'whey', g: 1000, pp: 80, sd: 0, v: [{ id: '1', f: null, fg: [], p: 400, st: 1 }] };
  const rows = rankRows([prod], { cat: 'protein', unit: 'kg' }, { perks: { 'tights:student': true } }, {});
  assert.equal(rows[0].metric, 380);
  const none = orderTotal('tights', [{ price: 1000, onSale: true, qty: 1, cat: 'protein', kg: 1 }], {}, null);
  assert.deepEqual(none.perks, []);
});

test('førstekjøp og medlemspris', () => {
  const t = orderTotal('sportylab', [{ price: 1000, onSale: false, qty: 1, cat: 'protein', kg: 1 }], { firstTime: { sportylab: true } }, null);
  assert.equal(t.discount.amount, 100);
  assert.equal(t.total, 900);
});

const P = (s, k, price, extra = {}) => ({ k: `${s}:${k}`, s, n: 'Whey 1 kg', c: 'protein', sc: 'whey', g: 1000, pp: 80, sd: 0, mk: 'x', v: [{ id: k, f: 'Sjokolade', fg: ['Sjokolade'], p: price, lp: null, mp: null, st: 1 }], ...extra });

test('rangering per kg protein og smak på lager', () => {
  const prods = [P('hcdealer', 'a', 400), P('apex', 'b', 350, { v: [{ id: 'b', f: 'Sjokolade', fg: ['Sjokolade'], p: 350, st: 0 }] }), P('sunkost', 'c', 380)];
  const rows = rankRows(prods, { cat: 'protein', unit: 'kgProtein', groups: ['Sjokolade'], subs: [], shops: [] }, {}, {});
  assert.deepEqual(rows.map((r) => r.prod.s), ['sunkost', 'hcdealer']); // utsolgt smak tas ikke med
  assert.equal(Math.round(rows[0].metric), 475);
  assert.equal(Math.round(perUnit(400, prods[0], 'kg')), 400);
});

test('handlekurv velger samlet billigste med frakt', () => {
  // To varer: billigst hver for seg i to butikker, men frakten gjør én butikk billigst samlet
  const prods = [
    P('hcdealer', 'a', 260),
    P('apex', 'b', 250),
    { ...P('hcdealer', 'k', 250), c: 'kreatin', sc: 'monohydrat', ag: 500, g: 500 },
    { ...P('apex', 'm', 240), c: 'kreatin', sc: 'monohydrat', ag: 500, g: 500 },
  ];
  const needs = [
    { id: 1, label: 'protein', unit: 'kg', amount: 1, filter: (p) => p.c === 'protein' },
    { id: 2, label: 'kreatin', unit: 'kgActive', amount: 0.5, filter: (p) => p.c === 'kreatin' },
  ];
  const res = optimizeCart(needs, prods, {}, {}, { maxShops: 2 });
  assert.equal(res.solutions[0].orders.length, 1);
  assert.equal(res.solutions[0].orders[0].shop, 'hcdealer'); // 510 kr, gratis frakt over 500
  assert.equal(res.solutions[0].total, 510);
});

test('normalize lager produkt med smak fra navnet', () => {
  const out = normalize({ shop: 'xxl', id: '1', name: 'Whey Protein - Vanilla 900 g, proteinpulver', brand: 'Nutramino', shopCategory: 'Kosttilskudd', text: '', variants: [{ id: '1', flavor: null, price: 299, inStock: true }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].g, 900);
  assert.equal(out[0].v[0].f, 'Vanilla');
  assert.deepEqual(out[0].v[0].fg, ['Vanilje']);
});

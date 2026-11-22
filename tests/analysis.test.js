import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSnapshot } from '../core/history.js';
import { variantDaily, productDaily, analysisGroups, categorySeries } from '../core/analysis.js';

const v = (id, f, fg, p, st = 1) => ({ id, f, fg, p, st });
const prod = (s, k, vs, extra = {}) => ({ k: `${s}:${k}`, s, n: 'Whey 1 kg', b: 'X', c: 'protein', sc: 'whey', g: 1000, pp: 80, sd: 0, mk: 'x|whey|1000', v: vs, ...extra });
const day = (i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);

// Bygg historikk dag for dag fra produktlister
function build(daysOfProducts) {
  let h = null;
  daysOfProducts.forEach((ps, i) => (h = addSnapshot(h, ps, day(i))));
  return h;
}

test('variant- og produktserie: billigste smak i valgt gruppe per dag', () => {
  const p = (choc, van) => prod('apex', '1', [v('a', 'Double Chocolate', ['Sjokolade'], choc), v('b', 'Vanilla', ['Vanilje'], van)]);
  const h = build([[p(400, 380)], [p(350, 380)], [p(350, 390)]]);
  assert.deepEqual(variantDaily(h, 'apex:1|a', 0, 3), [400, 350, 350, null]); // dag 3 er ikke skannet
  assert.deepEqual(productDaily(h, p(350, 390), 'Sjokolade', 0, 2), [400, 350, 350]);
  assert.deepEqual(productDaily(h, p(350, 390), '', 0, 2), [380, 350, 350]);
});

test('samme produkt i flere butikker blir én gruppe med én linje per butikk, i kr/kg protein', () => {
  const a = (p) => prod('apex', '1', [v('a', 'Sjokolade', ['Sjokolade'], p)]);
  const b = (p) => prod('bodylab', '2', [v('b', 'Chocolate', ['Sjokolade'], p)]);
  const h = build([[a(400), b(420)], [a(400), b(300)]]);
  const groups = analysisGroups([a(400), b(300)], h, { cat: 'protein', unit: 'kgProtein', group: 'Sjokolade' }, { from: 0, to: 1 });
  assert.equal(groups.length, 1);
  const g = groups[0];
  assert.deepEqual(g.lines.map((l) => l.shop), ['bodylab', 'apex']); // billigste nå først
  assert.equal(g.lines[0].vals[1], 375); // 300 kr / 0,8 kg protein
  assert.ok(g.best.stats.change < 0);
});

test('kategoriindeks følger snittlig prisendring, og billigste linje per dag', () => {
  const a = (p) => prod('apex', '1', [v('a', null, [], p)], { mk: 'a' });
  const b = (p) => prod('xxl', '2', [v('b', null, [], p)], { mk: 'b' });
  const h = build([[a(100), b(200)], [a(110), b(220)], [a(110), b(176)]]);
  const groups = analysisGroups([a(110), b(176)], h, { cat: 'protein', unit: 'pakke' }, { from: 0, to: 2 });
  const { index, cheapest } = categorySeries(groups, 3);
  assert.equal(index[0], 100);
  assert.ok(Math.abs(index[1] - 110) < 1e-9); // begge +10 %
  assert.ok(Math.abs(index[2] - 110 * Math.sqrt(0.8)) < 1e-9); // én uendret, én −20 %
  assert.deepEqual(cheapest, [100, 110, 110]);
});

test('filter på nivå: bare produkter som er billige nå mot egen historikk', () => {
  const a = (p) => prod('apex', '1', [v('a', null, [], p)], { mk: 'a' });
  const days = Array.from({ length: 20 }, (_, i) => [a(i < 15 ? 400 : 300)]);
  const h = build(days);
  const cheap = analysisGroups([a(300)], h, { cat: 'protein', unit: 'pakke', level: 'billig' }, { from: 0, to: 19 });
  assert.equal(cheap.length, 1);
  const dear = analysisGroups([a(300)], h, { cat: 'protein', unit: 'pakke', level: 'dyr' }, { from: 0, to: 19 });
  assert.equal(dear.length, 0);
});

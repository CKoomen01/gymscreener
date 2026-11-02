import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSnapshot, prune, dailyPrices, priceStats, seriesKey, dayIndex, osloDate } from '../core/history.js';
import { rankRows } from '../core/rank.js';

const prod = (p, k = 'apex:1') => ({ k, s: 'apex', n: 'Whey 1 kg', c: 'protein', sc: 'whey', g: 1000, pp: 80, sd: 0, v: [{ id: 'a', f: 'Sjokolade', fg: ['Sjokolade'], p, st: 1 }] });

// Bygg 30 dager: 400 kr i 20 dager, så 300 kr i 10 dager
function build() {
  let h = null;
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
    h = addSnapshot(h, [prod(i < 20 ? 400 : 300)], date);
  }
  return h;
}

test('logger bare prisendringer, laveste pris samme dag vinner', () => {
  let h = addSnapshot(null, [prod(400)], '2026-11-01');
  h = addSnapshot(h, [prod(380)], '2026-11-01'); // senere skann samme dag
  h = addSnapshot(h, [prod(380)], '2026-11-02');
  h = addSnapshot(h, [prod(390)], '2026-11-03');
  const s = h.series[seriesKey('apex:1', 'a')];
  assert.deepEqual(s.c, [[0, 380], [2, 390]]);
  assert.equal(s.l, 2);
});

test('daglige priser og statistikk', () => {
  const h = build();
  const key = seriesKey('apex:1', 'a');
  const pts = dailyPrices(h, key, '2026-11-30');
  assert.equal(pts.length, 30);
  const st = priceStats(h, key, 300, '2026-11-30');
  assert.equal(st.days, 30);
  assert.equal(st.min, 300);
  assert.equal(st.max, 400);
  assert.equal(Math.round(st.mean), 367);
  assert.equal(st.level, 'billig');
  assert.ok(st.vsMean < -0.15);
  assert.equal(priceStats(h, key, 400, '2026-11-30').level, 'dyr');
});

test('ingen merke før 14 dager, og ikke ved uendret pris', () => {
  let h = null;
  for (let i = 0; i < 10; i++) h = addSnapshot(h, [prod(i < 5 ? 400 : 300)], new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
  assert.equal(priceStats(h, seriesKey('apex:1', 'a'), 300, '2026-11-10').level, null);
  let flat = null;
  for (let i = 0; i < 20; i++) flat = addSnapshot(flat, [prod(400)], new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
  assert.equal(priceStats(flat, seriesKey('apex:1', 'a'), 400, '2026-11-20').level, null);
});

test('vinduet er 180 dager og gamle punkter ryddes', () => {
  let h = addSnapshot(null, [prod(500)], '2026-01-01');
  h = addSnapshot(h, [prod(300)], '2026-11-01');
  const key = seriesKey('apex:1', 'a');
  const st = priceStats(h, key, 300, '2026-11-01');
  assert.equal(st.days, 180);
  prune(h, '2026-11-01');
  // 500 kr gjaldt helt frem til 1. nov., så punktet beholdes selv om det startet før vinduet
  assert.deepEqual(h.series[key].c.map((x) => x[1]), [500, 300]);
  let old = addSnapshot(null, [prod(500)], '2026-01-01');
  old = addSnapshot(old, [prod(450)], '2026-02-01');
  old = addSnapshot(old, [prod(300)], '2026-11-01');
  prune(old, '2026-11-01');
  assert.deepEqual(old.series[key].c.map((x) => x[1]), [450, 300]); // 500 lå helt utenfor og ryddes
  assert.equal(dayIndex('2026-11-01', '2026-11-02'), 1);
  assert.match(osloDate(new Date('2026-11-01T23:30:00Z')), /^2026-11-02$/); // norsk dato
});

test('rangering: filter «billig nå» og sortering mot egen snittpris', () => {
  // Historikk som slutter i dag (rangeringen bruker dagens dato)
  let h = null;
  const today = Date.parse(`${osloDate()}T00:00:00Z`);
  for (let i = 29; i >= 0; i--) h = addSnapshot(h, [prod(i >= 10 ? 400 : 300)], new Date(today - i * 86400000).toISOString().slice(0, 10));
  const a = prod(300, 'apex:1');
  const b = { ...prod(250, 'apex:2') }; // ingen historikk
  const rows = rankRows([a, b], { cat: 'protein', unit: 'kg', onlyCheap: true }, {}, {}, h);
  assert.deepEqual(rows.map((r) => r.prod.k), ['apex:1']);
  const sorted = rankRows([b, a], { cat: 'protein', unit: 'kg', sort: 'hist' }, {}, {}, h);
  assert.equal(sorted[0].prod.k, 'apex:1');
});

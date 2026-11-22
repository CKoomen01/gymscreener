// Prisutvikling: daglige prisserier per produkt og butikk, statistikk og kategoritall.
// Rent funksjonelt (ingen nettleser), slik at det kan testes.
import { dayIndex, osloDate, seriesKey, statsFromPrices, WINDOW_DAYS } from './history.js';
import { perUnit } from './pricing.js';
import { flavorOk, textOk } from './rank.js';

// Daglig pris for én variant på dagene from..to (null der varianten ikke var med i skannet)
export function variantDaily(history, key, from, to) {
  const out = new Array(to - from + 1).fill(null);
  const s = history?.series?.[key];
  if (!s || !s.c.length) return out;
  let j = 0;
  for (let d = Math.max(from, s.c[0][0]); d <= Math.min(to, s.l); d++) {
    while (j + 1 < s.c.length && s.c[j + 1][0] <= d) j++;
    out[d - from] = s.c[j][1];
  }
  return out;
}

// Billigste pris per dag for et produkt, blant smakene som passer filteret.
// Smaker som er på lager nå foretrekkes; har ingen lager, brukes alle (historikken har ikke lagerstatus).
export function productDaily(history, prod, group, from, to) {
  const f = { groups: group ? [group] : [] };
  const match = prod.v.filter((v) => flavorOk(v, f));
  const vs = match.some((v) => v.st) ? match.filter((v) => v.st) : match;
  const out = new Array(to - from + 1).fill(null);
  for (const v of vs) {
    const d = variantDaily(history, seriesKey(prod.liveOf || prod.k, v.id), from, to);
    for (let i = 0; i < d.length; i++) if (d[i] !== null && (out[i] === null || d[i] < out[i])) out[i] = d[i];
  }
  return out;
}

// Gjør pakkepriser om til valgt enhet ('pakke' = uendret)
export function toUnit(values, prod, unit) {
  if (unit === 'pakke') return values;
  if (perUnit(1, prod, unit) === null) return null;
  return values.map((p) => (p === null ? null : perUnit(p, prod, unit)));
}

const lastValue = (vals) => {
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] !== null) return vals[i];
  return null;
};
const firstValue = (vals) => vals.find((x) => x !== null) ?? null;

// Statistikk for en daglig serie: nåverdi = siste kjente dag
export function seriesStats(vals) {
  const prices = vals.filter((x) => x !== null);
  const current = lastValue(vals);
  const st = statsFromPrices(prices, current);
  if (!st) return null;
  const first = firstValue(vals);
  return { ...st, current, first, change: first ? current / first - 1 : 0 };
}

// Periode i dagindekser: siste `days` dager (null = hele historikken, maks 180)
export function periodRange(history, days, date = osloDate()) {
  const to = dayIndex(history.start, date);
  const span = Math.min(days || WINDOW_DAYS, WINDOW_DAYS);
  return { from: Math.max(0, to - span + 1), to };
}

// f: { cat, subs[], shops[], group, q, hideShort, level, sort, unit, days }
// Gir én gruppe per «samme produkt» (matchnøkkel), med én linje per butikk.
export function analysisGroups(products, history, f, range) {
  const { from, to } = range;
  const byKey = new Map();
  for (const prod of products) {
    if (prod.c !== f.cat) continue;
    if (f.subs?.length && !f.subs.includes(prod.sc)) continue;
    if (f.shops?.length && !f.shops.includes(prod.s)) continue;
    if (f.hideShort && prod.sd) continue;
    if (!textOk(prod, f.q)) continue;
    const pack = productDaily(history, prod, f.group, from, to);
    if (!pack.some((x) => x !== null)) continue;
    const vals = toUnit(pack, prod, f.unit);
    if (!vals) continue; // mangler data for enheten (f.eks. ukjent proteininnhold)
    const key = prod.mk || prod.k;
    if (!byKey.has(key)) byKey.set(key, { key, items: [], shops: new Map() });
    const g = byKey.get(key);
    g.items.push(prod);
    // Flere sider i samme butikk (f.eks. ulike nettsider for samme vare): billigste per dag
    const cur = g.shops.get(prod.s);
    if (!cur) g.shops.set(prod.s, { shop: prod.s, prod, vals, pack });
    else {
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null && (cur.vals[i] === null || vals[i] < cur.vals[i])) {
          cur.vals[i] = vals[i];
          cur.pack[i] = pack[i];
        }
      }
    }
  }
  const groups = [];
  for (const g of byKey.values()) {
    const lines = [...g.shops.values()].map((l) => ({ ...l, stats: seriesStats(l.vals) })).filter((l) => l.stats);
    if (!lines.length) continue;
    lines.sort((a, b) => a.stats.current - b.stats.current);
    const best = lines[0]; // billigste butikk nå
    if (f.level && best.stats.level !== f.level) continue;
    groups.push({ key: g.key, prod: best.prod, lines, best });
  }
  const score = {
    vsMean: (g) => (g.best.stats.days >= 2 ? g.best.stats.vsMean : Infinity),
    drop: (g) => (g.best.stats.days >= 2 ? g.best.stats.change : Infinity),
    price: (g) => g.best.stats.current,
    shops: (g) => -g.lines.length,
  }[f.sort || 'vsMean'];
  groups.sort((a, b) => score(a) - score(b) || a.best.stats.current - b.best.stats.current);
  return groups;
}

// Kategoritall per dag:
// - indeks: kjedet prisindeks (geometrisk snitt av dag-til-dag-endringer), 100 ved periodens start
// - cheapest: laveste enhetspris blant alle linjene, med hvilket produkt det var
export function categorySeries(groups, length) {
  const lines = groups.flatMap((g) => g.lines);
  const index = new Array(length).fill(null);
  const cheapest = new Array(length).fill(null);
  const cheapestOf = new Array(length).fill(null);
  let level = 100;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    let n = 0;
    let anyToday = false;
    for (const l of lines) {
      const v = l.vals[i];
      if (v === null) continue;
      anyToday = true;
      if (i > 0 && l.vals[i - 1] !== null) {
        sum += Math.log(v / l.vals[i - 1]);
        n++;
      }
      if (cheapest[i] === null || v < cheapest[i]) {
        cheapest[i] = v;
        cheapestOf[i] = l;
      }
    }
    if (n) level *= Math.exp(sum / n);
    if (anyToday) index[i] = level;
  }
  return { index, cheapest, cheapestOf };
}

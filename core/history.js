// Prishistorikk: egen logg per produkt + smak, lagret som prisendringer per dag.
// Format: { start: 'YYYY-MM-DD', series: { '<produktnøkkel>|<variant-id>': { c: [[dag, pris], ...], l: sisteDag } } }
// dag = antall dager siden `start`. En pris gjelder fra sin dag til neste endring (eller til sisteDag).

export const WINDOW_DAYS = 180; // «siste 6 måneder»
export const MIN_DAYS_FOR_BADGE = 14;

const DAY = 86400000;

// Dato i norsk tid, slik at «dagen» følger kalenderen i Norge
export function osloDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(d);
}

export function dayIndex(start, date) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY);
}

export function seriesKey(prodKey, variantId) {
  return `${prodKey}|${variantId}`;
}

// Legger dagens priser inn i historikken. Laveste pris samme dag vinner.
export function addSnapshot(history, products, date = osloDate()) {
  const h = history && history.series ? history : { start: date, series: {} };
  const d = dayIndex(h.start, date);
  for (const p of products) {
    for (const v of p.v || []) {
      if (!(v.p > 0)) continue;
      const key = seriesKey(p.liveOf || p.k, v.id);
      const s = (h.series[key] ||= { c: [], l: d });
      const last = s.c[s.c.length - 1];
      if (last && last[0] === d) last[1] = Math.min(last[1], v.p);
      else if (!last || last[1] !== v.p) s.c.push([d, v.p]);
      s.l = d;
    }
  }
  return h;
}

// Fjerner punkter eldre enn vinduet (beholder siste punkt før grensen, siden det gjelder inn i vinduet)
// og serier som ikke er sett på lenge.
export function prune(history, date = osloDate(), keepDays = WINDOW_DAYS + 20) {
  const today = dayIndex(history.start, date);
  const cutoff = today - keepDays;
  for (const [k, s] of Object.entries(history.series)) {
    if (s.l < cutoff) {
      delete history.series[k];
      continue;
    }
    let i = 0;
    while (i + 1 < s.c.length && s.c[i + 1][0] <= cutoff) i++;
    if (i > 0) s.c = s.c.slice(i);
  }
  return history;
}

// Daglige priser i vinduet: [{ day, price }]
export function dailyPrices(history, key, date = osloDate(), windowDays = WINDOW_DAYS) {
  const s = history?.series?.[key];
  if (!s || !s.c.length) return [];
  const today = dayIndex(history.start, date);
  const from = Math.max(today - windowDays + 1, s.c[0][0]);
  const to = Math.min(s.l, today);
  const out = [];
  let j = 0;
  for (let d = from; d <= to; d++) {
    while (j + 1 < s.c.length && s.c[j + 1][0] <= d) j++;
    if (s.c[j][0] <= d) out.push({ day: d, price: s.c[j][1] });
  }
  return out;
}

// Statistikk for en nåpris mot historikken. Nåprisen telles med som dagens verdi.
export function priceStats(history, key, current, date = osloDate()) {
  const pts = dailyPrices(history, key, date);
  if (!pts.length || !(current > 0)) return null;
  const prices = pts.map((p) => p.price);
  const n = prices.length;
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const sorted = [...prices].sort((a, b) => a - b);
  const q = (f) => sorted[Math.min(n - 1, Math.floor(f * (n - 1)))];
  const p25 = q(0.25);
  const p75 = q(0.75);
  let level = null;
  if (n >= MIN_DAYS_FOR_BADGE && max > min) {
    if (current <= p25 && current < mean) level = 'billig';
    else if (current >= p75 && current > mean) level = 'dyr';
    else level = 'normal';
  }
  return {
    days: n,
    mean,
    min,
    max,
    p25,
    p75,
    level,
    vsMean: (current - mean) / mean, // negativ = under snittet
    isLowest: current <= min,
    points: pts,
    startDate: new Date(Date.parse(`${history.start}T00:00:00Z`) + pts[0].day * DAY).toISOString().slice(0, 10),
  };
}

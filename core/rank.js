// Rangering per kategori. Rent funksjonelt, slik at det kan testes uten nettleser.
import { unitPrice, orderTotal, amountPerPackage, packagesFor } from './pricing.js';

export function flavorOk(v, f) {
  if (f.flavor) return v.f && v.f.toLowerCase() === f.flavor.toLowerCase();
  if (f.groups?.length) {
    if (!v.f) return f.groups.includes('Ikke oppgitt');
    return v.fg.some((g) => f.groups.includes(g));
  }
  return true;
}

export function textOk(prod, q) {
  if (!q) return true;
  const hay = `${prod.n} ${prod.b || ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

// f: { cat, subs[], groups[], flavor, shops[], hideShort, showOut, q, unit, qty, minG, maxG }
export function rankRows(products, f, settings, promos) {
  const rows = [];
  for (const prod of products) {
    if (prod.c !== f.cat) continue;
    if (f.subs?.length && !f.subs.includes(prod.sc)) continue;
    if (f.shops?.length && !f.shops.includes(prod.s)) continue;
    if (f.hideShort && prod.sd) continue;
    if (!textOk(prod, f.q)) continue;
    if (f.minG && (!prod.g || prod.g < f.minG)) continue;
    if (f.maxG && (!prod.g || prod.g > f.maxG)) continue;
    const vs = prod.v.filter((v) => (f.showOut || v.st) && flavorOk(v, f));
    if (!vs.length) continue;
    let best = null;
    for (const v of vs) {
      const up = unitPrice(v, prod.s, settings);
      if (!best || up.price < best.up.price || (up.price === best.up.price && v.st && !best.v.st)) best = { v, up };
    }
    const per = amountPerPackage(prod, f.unit);
    const qty = f.qty > 0 ? packagesFor(prod, f.unit, f.qty) : 1;
    const line = { price: best.up.price, onSale: best.up.onSale, qty: qty || 1, cat: prod.c, kg: (prod.g || 0) / 1000, name: `${prod.b || ''} ${prod.n}`, sd: prod.sd };
    const order = orderTotal(prod.s, [line], settings, promos?.[prod.s]);
    let metric = null;
    if (per) {
      // Ukjent frakt: regn uten frakt, men kortet viser tydelig «+ frakt (ukjent)»
      if (f.qty > 0 && qty) metric = order.total / (qty * per);
      // Uten mengde: én pakke med rabattene du har krysset av for, uten frakt
      else metric = (order.total - (order.shipping || 0)) / per;
      if (f.unit === 'gProtein' && metric !== null) metric *= 100;
    }
    rows.push({ prod, v: best.v, up: best.up, matching: vs, metric, per, qty, order });
  }
  rows.sort((a, b) => (a.metric ?? Infinity) - (b.metric ?? Infinity) || a.up.price - b.up.price);
  return rows;
}

// Alle smaker som finnes i en kategori, med antall produkter
export function flavorIndex(products, cat) {
  const m = new Map();
  for (const p of products) {
    if (p.c !== cat) continue;
    for (const v of p.v) if (v.f) m.set(v.f, (m.get(v.f) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

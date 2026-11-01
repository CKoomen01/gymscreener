import { SHOPS } from '../core/shops.js';

const nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const kr = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf0.format(Math.round(v))} kr`);
export const kr2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf2.format(v)} kr`);
export const krSmart = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v < 100 ? kr2(v) : kr(v));

export const shopName = (id) => SHOPS[id]?.name || id;

export function sizeLabel(p) {
  const parts = [];
  if (p.g) parts.push(p.g >= 1000 ? `${String(+(p.g / 1000).toFixed(2)).replace('.', ',')} kg` : `${p.g} g`);
  if (p.cnt) parts.push(`${p.cnt} ${p.cu === 'stk' ? 'stk' : p.cu}`);
  return parts.join(' · ') || p.sz || '';
}

export function timeAgo(iso) {
  if (!iso) return 'ukjent';
  const d = (Date.now() - new Date(iso).getTime()) / 60000;
  if (d < 1) return 'nå nettopp';
  if (d < 60) return `${Math.round(d)} min siden`;
  if (d < 60 * 24) return `${Math.round(d / 60)} t siden`;
  return `${Math.round(d / 1440)} d siden`;
}

export function clock(ts) {
  return new Date(ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

// Butikk-lenke: variantens egen URL når den finnes, ellers produktsiden
export function linkFor(prod, v) {
  return (v && v.u) || prod.u;
}

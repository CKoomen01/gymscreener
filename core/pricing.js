// Prisberegning: medlemspris, rabattkoder, førstekjøpsrabatt, frakt og handlekurv-optimalisering.
import { SHOPS, shippingCost } from './shops.js';

// settings: { members: {shop:true}, firstTime: {shop:true}, points: bool, codes: bool, delivery: 'cheapest'|'home', shipOverride: {shop:{cheapest,home}} }

export function unitPrice(variant, shopId, settings) {
  const member = settings?.members?.[shopId];
  let p = variant.p;
  let kind = variant.lp ? 'kampanje' : 'ordinær';
  if (member && variant.mp && variant.mp < p) {
    p = variant.mp;
    kind = 'medlemspris';
  }
  return { price: p, kind, onSale: !!variant.lp || kind === 'medlemspris' };
}

function codeApplies(code, cat) {
  if (code.scope === 'alle') return true;
  if (code.scope === 'protein') return cat === 'protein';
  return code.scope === cat;
}

// Mulige ordrerabatter for én butikk. Butikkene oppgir at koder/tilbud ikke kan kombineres,
// så bare den beste ene rabatten brukes, og bare på varer som ikke allerede er nedsatt.
function orderDiscounts(shopId, lines, settings, promos) {
  const shop = SHOPS[shopId];
  const out = [];
  const regular = lines.filter((l) => !l.onSale);
  const regSum = regular.reduce((s, l) => s + l.price * l.qty, 0);
  const fp = shop.firstPurchase;
  if (fp && settings?.firstTime?.[shopId]) {
    const base = fp.excludesSale ? regSum : lines.reduce((s, l) => s + l.price * l.qty, 0);
    if (base > 0) out.push({ label: `Førstekjøp ${fp.pct} %`, amount: (base * fp.pct) / 100, source: fp.desc });
  }
  if (settings?.codes !== false) {
    for (const c of promos?.codes || []) {
      if (c.type === 'unknown' || !c.value) continue;
      if (c.validUntil && Date.parse(c.validUntil) < Date.now()) continue;
      // Noen koder gjelder uttrykkelig også nedsatte varer; ellers bare ordinære varer
      const pool = c.appliesToSale ? lines : regular;
      const scoped = pool.filter((l) => codeApplies(c, l.cat) && !(c.excludesDrinks && l.cat === 'drikke'));
      const base = scoped.reduce((s, l) => s + l.price * l.qty, 0);
      if (base <= 0 || base < (c.minOrder || 0)) continue;
      const amount = c.type === 'percent' ? (base * c.value) / 100 : Math.min(c.value, base);
      out.push({ label: `Kode ${c.code}`, amount, source: c.text, code: c.code });
    }
  }
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

// lines: [{price, onSale, qty, cat, kg}]
export function orderTotal(shopId, lines, settings, promos) {
  const shop = SHOPS[shopId];
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discounts = orderDiscounts(shopId, lines, settings, promos);
  const best = discounts[0] || null;
  const afterDiscount = subtotal - (best?.amount || 0);
  const kg = lines.reduce((s, l) => s + (l.kg || 0) * l.qty, 0);
  const override = settings?.shipOverride?.[shopId];
  // Fraktgrense fra butikkens banner (f.eks. kampanje med lavere grense) brukes når den er lavere
  const banner = promos?.freeShippingBanner;
  const shipping = shippingCost(
    shop,
    afterDiscount,
    settings?.delivery || 'cheapest',
    kg,
    banner && shop.shipping.free && banner < shop.shipping.free ? { ...(override || {}), free: banner } : override
  );
  const freeAt = banner && shop.shipping.free ? Math.min(banner, shop.shipping.free) : shop.shipping.free;
  const pointsPct = settings?.points && settings?.members?.[shopId] ? shop.membership?.pointsPct || 0 : 0;
  const points = (afterDiscount * pointsPct) / 100;
  return {
    shop: shopId,
    subtotal,
    discount: best,
    otherDiscounts: discounts.slice(1),
    shipping,
    shippingUnknown: shipping === null,
    freeShippingAt: freeAt,
    missingForFree: freeAt && afterDiscount < freeAt ? freeAt - afterDiscount : 0,
    points,
    total: afterDiscount + (shipping || 0) - points,
  };
}

// Mengde én pakke leverer, i valgt enhet
export function amountPerPackage(prod, unit) {
  switch (unit) {
    case 'kg':
      return prod.g ? prod.g / 1000 : null;
    case 'kgProtein':
      return prod.g && prod.pp ? (prod.g * prod.pp) / 100 / 1000 : null;
    case 'kgActive':
      return prod.ag ? prod.ag / 1000 : prod.c === 'kreatin' && prod.sc === 'monohydrat' && prod.g ? prod.g / 1000 : null;
    case 'stk':
      return prod.cnt || (prod.c === 'barer' || prod.c === 'drikke' ? 1 : null);
    case 'gProtein':
      return prod.pu ? prod.pu * (prod.cnt || 1) : null;
    case 'doser':
      return prod.dd || null;
    default:
      return null;
  }
}

export const UNIT_LABEL = { kg: 'kr/kg', kgProtein: 'kr/kg protein', kgActive: 'kr/kg kreatin', stk: 'kr/stk', gProtein: 'kr/100 g protein', doser: 'kr/dagsdose' };

export function defaultUnit(cat) {
  return { protein: 'kgProtein', kreatin: 'kgActive', barer: 'stk', drikke: 'stk', vitaminer: 'doser' }[cat] || 'kg';
}

export function perUnit(price, prod, unit) {
  const a = amountPerPackage(prod, unit);
  if (!a) return null;
  return unit === 'gProtein' ? (price / a) * 100 : price / a;
}

// Velg billigste antall pakker av ett produkt for å nå målmengden
export function packagesFor(prod, unit, target) {
  const a = amountPerPackage(prod, unit);
  if (!a || !target) return null;
  return Math.max(1, Math.ceil(target / a - 1e-9));
}

// Handlekurv-optimalisering.
// needs: [{ id, label, filter(prod, variant) -> bool, unit, amount }]
// products: normaliserte produkter. Returnerer de beste løsningene (butikkfordeling).
export function optimizeCart(needs, products, settings, promosByShop, opts = {}) {
  const maxShops = opts.maxShops || 3;
  const perNeed = needs.map((need) => {
    const byShop = new Map();
    for (const prod of products) {
      for (const v of prod.v) {
        if (!v.st || !need.filter(prod, v)) continue;
        const qty = packagesFor(prod, need.unit, need.amount);
        if (!qty) continue;
        const up = unitPrice(v, prod.s, settings);
        const cost = up.price * qty;
        const cur = byShop.get(prod.s);
        if (!cur || cost < cur.cost) byShop.set(prod.s, { shop: prod.s, prod, v, qty, price: up.price, onSale: up.onSale, kind: up.kind, cost });
      }
    }
    // De 5 billigste butikkene per behov er nok kandidater
    return [...byShop.values()].sort((a, b) => a.cost - b.cost).slice(0, 5);
  });
  if (perNeed.some((c) => !c.length)) {
    return { solutions: [], missing: needs.filter((_, i) => !perNeed[i].length).map((n) => n.label) };
  }
  const solutions = [];
  const idx = new Array(needs.length).fill(0);
  const limit = 200000;
  let evaluated = 0;
  // Gå gjennom alle kombinasjoner (maks 5^N, N er antall behov)
  while (evaluated++ < limit) {
    const pick = idx.map((k, i) => perNeed[i][k]);
    const shops = new Set(pick.map((p) => p.shop));
    if (shops.size <= maxShops) {
      const orders = [...shops].map((s) => {
        const items = pick.filter((p) => p.shop === s);
        const lines = items.map((p) => ({ price: p.price, onSale: p.onSale, qty: p.qty, cat: p.prod.c, kg: ((p.prod.g || 0) / 1000) }));
        return { ...orderTotal(s, lines, settings, promosByShop?.[s]), items };
      });
      const total = orders.reduce((s, o) => s + o.total, 0);
      solutions.push({ total, orders, unknownShipping: orders.some((o) => o.shippingUnknown) });
    }
    let i = 0;
    while (i < idx.length) {
      idx[i]++;
      if (idx[i] < perNeed[i].length) break;
      idx[i] = 0;
      i++;
    }
    if (i === idx.length) break;
  }
  solutions.sort((a, b) => a.total - b.total);
  const seen = new Set();
  const uniq = solutions.filter((s) => {
    const k = s.orders.map((o) => o.shop + ':' + o.items.map((it) => it.prod.k + it.v.id).join(',')).sort().join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { solutions: uniq.slice(0, 5), missing: [] };
}

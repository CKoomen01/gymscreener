// Live-oppdatering i nettleseren: samme skrapere som GitHub Actions bruker, men via Worker-proxyen.
import { SHOPS } from '../core/shops.js';
import { normalize } from '../core/normalize.js';
import { PLATFORMS } from '../scrapers/index.js';

function ctxFor(proxy) {
  const via = (url) => `${proxy.replace(/\/$/, '')}/?url=${encodeURIComponent(url)}`;
  async function req(url, opts = {}) {
    const res = await fetch(via(url), { method: opts.method || 'GET', headers: opts.headers, body: opts.body });
    if (!res.ok) return null;
    return res.text();
  }
  return {
    log: () => {},
    text: req,
    json: async (url, opts) => {
      const t = await req(url, { ...opts, headers: { Accept: 'application/json', ...(opts?.headers || {}) } });
      try {
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    },
  };
}

// Oppdaterer ett produkt. Returnerer nye normaliserte produkter (kan være flere størrelser).
export async function refreshProduct(prod, proxy) {
  const shop = { id: prod.s, ...SHOPS[prod.s] };
  const mod = PLATFORMS[shop.platform];
  if (!mod?.refresh || !prod.r) return null;
  // Skraperen trenger litt av rådata for å finne produktet igjen
  const raw = { id: prod.k.split(':')[1], name: prod.n, brand: prod.b, url: prod.u, shopCategory: '', refresh: prod.r, variants: prod.v.map((v) => ({ inStock: !!v.st })) };
  const fresh = await mod.refresh(shop, raw, ctxFor(proxy));
  if (!fresh) return null;
  const list = normalize(fresh);
  // Behold kategori/næring fra full skann hvis live-data mangler det (f.eks. uten næringstabell)
  return list.map((p) => ({ ...p, c: p.c || prod.c, sc: p.sc || prod.sc, pp: p.pp ?? prod.pp, pu: p.pu ?? prod.pu, ag: p.ag ?? prod.ag, dd: p.dd ?? prod.dd, live: Date.now() }));
}

export async function proxyHealthy(proxy) {
  try {
    const r = await fetch(`${proxy.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(6000) });
    return r.ok;
  } catch {
    return false;
  }
}

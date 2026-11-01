import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../../core/normalize.js';
import { unitPrice, perUnit, defaultUnit, UNIT_LABEL, orderTotal } from '../../core/pricing.js';
import { textOk } from '../../core/rank.js';
import { useStored } from '../settings.js';
import { kr, krSmart, shopName, sizeLabel, linkFor } from '../format.js';

// Samme produkt (merke + navn + størrelse) på tvers av butikker
export default function SameProductView({ products, settings, promos, live }) {
  const [q, setQ] = useStored('same-q', '');
  const [cat, setCat] = useStored('same-cat', 'protein');
  const [flavorSel, setFlavorSel] = useState({});
  const [shown, setShown] = useState(25);

  const groups = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      if (cat && p.c !== cat) continue;
      if (!textOk(p, q)) continue;
      if (!m.has(p.mk)) m.set(p.mk, []);
      m.get(p.mk).push(p);
    }
    const unit = defaultUnit(cat);
    return [...m.values()]
      .map((items) => {
        const shops = new Set(items.map((p) => p.s));
        const best = Math.min(...items.flatMap((p) => p.v.filter((v) => v.st).map((v) => perUnit(unitPrice(v, p.s, settings).price, p, unit) ?? Infinity)));
        return { items, shops: shops.size, best, unit, name: items[0].n };
      })
      .filter((g) => g.shops >= 2)
      .sort((a, b) => b.shops - a.shops || a.best - b.best);
  }, [products, q, cat, settings]);

  useEffect(() => setShown(25), [q, cat]);

  return (
    <div className="same">
      <div className="toolbar">
        <div className="chips">
          {Object.entries(CATEGORIES).map(([id, c]) => (
            <button key={id} className={`chip ${cat === id ? 'on' : ''}`} onClick={() => setCat(id)}>
              {c.label}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Søk etter produkt, f.eks. «whey-80» eller «creapure»" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted small">
        Viser produkter som selges i minst to butikker. Like produkter kobles på merke, navn og pakningsstørrelse. {groups.length} produkter funnet.
      </p>
      {groups.slice(0, shown).map((g) => {
        const key = g.items[0].mk;
        const allFlavors = [...new Set(g.items.flatMap((p) => p.v.map((v) => v.f).filter(Boolean)))].sort();
        const fsel = flavorSel[key] || '';
        const offers = g.items
          .map((p) => {
            const vs = p.v.filter((v) => (fsel ? v.f === fsel : true));
            const inStock = vs.filter((v) => v.st);
            const pick = (inStock.length ? inStock : vs).reduce((a, b) => (!a || unitPrice(b, p.s, settings).price < unitPrice(a, p.s, settings).price ? b : a), null);
            if (!pick) return null;
            const up = unitPrice(pick, p.s, settings);
            const order = orderTotal(p.s, [{ price: up.price, onSale: up.onSale, qty: 1, cat: p.c, kg: (p.g || 0) / 1000, name: `${p.b || ''} ${p.n}`, sd: p.sd }], settings, promos?.[p.s]);
            return { p, v: pick, up, order, inStock: !!pick.st };
          })
          .filter(Boolean)
          .sort((a, b) => (b.inStock - a.inStock) || a.up.price - b.up.price);
        return (
          <article key={key} className="group">
            <header>
              <h3>{g.name}</h3>
              <span className="muted small">
                {g.items[0].b || ''} · {sizeLabel(g.items[0])} · {g.shops} butikker
              </span>
            </header>
            {allFlavors.length > 0 && (
              <select value={fsel} onChange={(e) => setFlavorSel((m) => ({ ...m, [key]: e.target.value }))} aria-label="Velg smak">
                <option value="">Alle smaker (billigste på lager)</option>
                {allFlavors.map((fl) => (
                  <option key={fl}>{fl}</option>
                ))}
              </select>
            )}
            <table className="offers">
              <thead>
                <tr>
                  <th>Butikk</th>
                  <th>Smak</th>
                  <th className="num">Pris</th>
                  <th className="num">{UNIT_LABEL[g.unit]}</th>
                  <th className="num">Med 1 stk + frakt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o, i) => (
                  <tr key={o.p.k} className={`${i === 0 && o.inStock ? 'best' : ''} ${o.inStock ? '' : 'out'}`}>
                    <td>{shopName(o.p.s)}</td>
                    <td>
                      {o.v.f || '–'} {!o.inStock && <span className="stock outtxt">utsolgt</span>}
                    </td>
                    <td className="num">
                      {kr(o.up.price)}
                      {o.up.kind === 'medlemspris' && <span className="badge member">medlem</span>}
                      {o.v.lp && <div className="strike small">{kr(o.v.lp)}</div>}
                    </td>
                    <td className="num">{krSmart(perUnit(o.up.price, o.p, g.unit))}</td>
                    <td className="num">{o.order.shippingUnknown ? `${kr(o.order.total)} + frakt` : kr(o.order.total)}</td>
                    <td>
                      <a className="buy small" href={linkFor(o.p, o.v)} target="_blank" rel="noopener noreferrer">
                        Til butikk ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {live.enabled && (
              <button className="link small" onClick={() => live.refresh(g.items, true)}>
                Oppdater dette produktet live i alle butikker
              </button>
            )}
          </article>
        );
      })}
      {groups.length > shown && (
        <button className="ghost wide" onClick={() => setShown((n) => n + 25)}>
          Vis flere
        </button>
      )}
    </div>
  );
}

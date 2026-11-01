import React, { useMemo, useState } from 'react';
import { CATEGORIES, SUBCATEGORIES, FLAVOR_GROUPS } from '../../core/normalize.js';
import { optimizeCart, defaultUnit } from '../../core/pricing.js';
import { flavorOk, textOk } from '../../core/rank.js';
import { useStored } from '../settings.js';
import { kr, shopName, sizeLabel, linkFor } from '../format.js';

const UNIT_OPTS = {
  protein: [['kgProtein', 'kg rent protein'], ['kg', 'kg pulver']],
  kreatin: [['kgActive', 'kg kreatin'], ['kg', 'kg produkt']],
  pwo: [['kg', 'kg']],
  aminosyrer: [['kg', 'kg']],
  gainer: [['kg', 'kg']],
  barer: [['stk', 'stk']],
  drikke: [['stk', 'stk']],
  vitaminer: [['doser', 'dagsdoser'], ['stk', 'stk']],
};
const GROUPS = [...FLAVOR_GROUPS.map(([n]) => n), 'Annen smak', 'Ikke oppgitt'];
let nextId = Date.now();

function newNeed(cat = 'protein') {
  return { id: nextId++, cat, subs: [], groups: [], q: '', amount: cat === 'barer' || cat === 'drikke' ? 12 : cat === 'vitaminer' ? 90 : 1, unit: defaultUnit(cat), allowShort: false };
}

export default function CartView({ products, settings, promos, live }) {
  const [needs, setNeeds] = useStored('cart-v1', [newNeed('protein'), newNeed('kreatin')]);
  const [maxShops, setMaxShops] = useStored('cart-max', 2);
  const [run, setRun] = useState(0);
  const upd = (id, patch) => setNeeds((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const result = useMemo(() => {
    if (!run) return null;
    const ns = needs
      .filter((n) => Number(n.amount) > 0)
      .map((n) => ({
        id: n.id,
        label: `${CATEGORIES[n.cat].label}${n.q ? ` «${n.q}»` : ''}`,
        unit: n.unit,
        amount: Number(String(n.amount).replace(',', '.')),
        filter: (p, v) => p.c === n.cat && (!n.subs.length || n.subs.includes(p.sc)) && textOk(p, n.q) && flavorOk(v, { groups: n.groups }) && (n.allowShort || !p.sd),
      }));
    return optimizeCart(ns, products, settings, promos, { maxShops });
  }, [run, products, settings, promos, maxShops]);

  return (
    <div className="cart">
      <p className="muted">
        Legg inn alt du vil kjøpe. Siden finner billigste fordeling mellom butikkene, inkludert frakt, gratisfraktgrenser, rabattkoder og førstekjøpsrabatter du har krysset av for.
      </p>
      <ol className="needs">
        {needs.map((n) => (
          <li key={n.id} className="need">
            <div className="need-row">
              <select value={n.cat} onChange={(e) => upd(n.id, { cat: e.target.value, subs: [], unit: defaultUnit(e.target.value) })} aria-label="Kategori">
                {Object.entries(CATEGORIES).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input className="amount" inputMode="decimal" value={n.amount} onChange={(e) => upd(n.id, { amount: e.target.value })} aria-label="Mengde" />
              <select value={n.unit} onChange={(e) => upd(n.id, { unit: e.target.value })} aria-label="Enhet">
                {UNIT_OPTS[n.cat].map(([u, l]) => (
                  <option key={u} value={u}>
                    {l}
                  </option>
                ))}
              </select>
              <input placeholder="Merke/produkt (valgfritt)" value={n.q} onChange={(e) => upd(n.id, { q: e.target.value })} />
              <button className="link danger" onClick={() => setNeeds((ns) => ns.filter((x) => x.id !== n.id))}>
                Fjern
              </button>
            </div>
            <div className="chips">
              {Object.entries(SUBCATEGORIES[n.cat]).map(([id, l]) => (
                <button key={id} className={`chip small ${n.subs.includes(id) ? 'on' : ''}`} onClick={() => upd(n.id, { subs: n.subs.includes(id) ? n.subs.filter((x) => x !== id) : [...n.subs, id] })}>
                  {l}
                </button>
              ))}
            </div>
            <details>
              <summary>Smak{n.groups.length ? `: ${n.groups.join(', ')}` : ' (alle)'}</summary>
              <div className="chips">
                {GROUPS.map((g) => (
                  <button key={g} className={`chip small ${n.groups.includes(g) ? 'on' : ''}`} onClick={() => upd(n.id, { groups: n.groups.includes(g) ? n.groups.filter((x) => x !== g) : [...n.groups, g] })}>
                    {g}
                  </button>
                ))}
              </div>
              <label className="row-check">
                <input type="checkbox" checked={n.allowShort} onChange={() => upd(n.id, { allowShort: !n.allowShort })} /> Tillat kort dato / outlet
              </label>
            </details>
          </li>
        ))}
      </ol>
      <div className="cart-actions">
        <button className="ghost" onClick={() => setNeeds((ns) => [...ns, newNeed()])}>
          + Legg til vare
        </button>
        <label>
          Maks antall butikker:{' '}
          <select value={maxShops} onChange={(e) => setMaxShops(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <button className="primary" onClick={() => setRun((r) => r + 1)}>
          Finn billigste kombinasjon
        </button>
      </div>

      {result && result.missing.length > 0 && <div className="notice error">Fant ingen varer på lager for: {result.missing.join(', ')}. Prøv å fjerne filtre.</div>}
      {result &&
        result.solutions.map((sol, i) => (
          <article key={i} className={`solution ${i === 0 ? 'best' : ''}`}>
            <header>
              <h3>
                {i === 0 ? 'Billigst: ' : `Alternativ ${i}: `}
                {kr(sol.total)}
                {sol.unknownShipping ? ' + frakt' : ''}
              </h3>
              <span className="muted small">{sol.orders.map((o) => shopName(o.shop)).join(' + ')}</span>
              {i === 0 && live.enabled && (
                <button className="link small" onClick={() => live.refresh(sol.orders.flatMap((o) => o.items.map((it) => it.prod)), true).then(() => setRun((r) => r + 1))}>
                  Sjekk prisene live og regn på nytt
                </button>
              )}
            </header>
            {sol.orders.map((o) => (
              <div key={o.shop} className="order">
                <h4>{shopName(o.shop)}</h4>
                <ul>
                  {o.items.map((it) => (
                    <li key={it.prod.k + it.v.id}>
                      <a href={linkFor(it.prod, it.v)} target="_blank" rel="noopener noreferrer">
                        {it.qty} × {it.prod.n}
                      </a>{' '}
                      <span className="muted small">
                        {sizeLabel(it.prod)}
                        {it.v.f ? ` · ${it.v.f}` : ''} · {kr(it.price)}/stk{it.kind === 'medlemspris' ? ' (medlemspris)' : it.kind === 'kampanje' ? ' (kampanje)' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="breakdown inline">
                  <dt>Varer</dt>
                  <dd>{kr(o.subtotal)}</dd>
                  {o.discount && (
                    <>
                      <dt title={o.discount.source}>{o.discount.label}</dt>
                      <dd className="good">−{kr(o.discount.amount)}</dd>
                    </>
                  )}
                  {o.perks?.map((p) => (
                    <React.Fragment key={p.label}>
                      <dt title={p.source}>{p.label}</dt>
                      <dd className="good">−{kr(p.amount)}</dd>
                    </React.Fragment>
                  ))}
                  <dt>Frakt</dt>
                  <dd>{o.shippingUnknown ? 'ukjent' : o.shipping === 0 ? 'gratis' : kr(o.shipping)}</dd>
                  {o.points > 0 && (
                    <>
                      <dt>Bonuspoeng</dt>
                      <dd className="good">−{kr(o.points)}</dd>
                    </>
                  )}
                  <dt>
                    <strong>Sum</strong>
                  </dt>
                  <dd>
                    <strong>{kr(o.total)}</strong>
                  </dd>
                </dl>
                {o.missingForFree > 0 && o.shipping > 0 && (
                  <p className="muted small">
                    Du mangler {kr(o.missingForFree)} på gratis frakt ({kr(o.shipping)} i frakt nå).
                  </p>
                )}
              </div>
            ))}
          </article>
        ))}
    </div>
  );
}

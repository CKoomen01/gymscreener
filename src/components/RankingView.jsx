import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, SUBCATEGORIES, FLAVOR_GROUPS } from '../../core/normalize.js';
import { SHOPS, SHOP_IDS } from '../../core/shops.js';
import { UNIT_LABEL, defaultUnit } from '../../core/pricing.js';
import { rankRows, flavorIndex } from '../../core/rank.js';
import { useStored } from '../settings.js';
import { LIVE_TOP_N } from '../config.js';
import ProductCard from './ProductCard.jsx';

const UNITS = {
  protein: ['kgProtein', 'kg'],
  kreatin: ['kgActive', 'kg'],
  pwo: ['kg'],
  aminosyrer: ['kg'],
  gainer: ['kg'],
  barer: ['stk', 'gProtein'],
  drikke: ['stk', 'gProtein'],
  vitaminer: ['doser', 'stk'],
};
const QTY_LABEL = { kg: 'kg', kgProtein: 'kg rent protein', kgActive: 'kg kreatin', stk: 'stk', gProtein: 'g protein', doser: 'dagsdoser' };
const GROUPS = [...FLAVOR_GROUPS.map(([n]) => n), 'Annen smak', 'Ikke oppgitt'];

const DEFAULT = { cat: 'protein', subs: [], groups: [], flavor: '', shops: [], hideShort: false, showOut: false, q: '', unit: 'kgProtein', qty: '' };

export default function RankingView({ products, settings, promos, live }) {
  const [f, setF] = useStored('filters-v1', DEFAULT);
  const [shown, setShown] = useState(40);
  const [openFilters, setOpenFilters] = useState(false); // bare på mobil
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggleIn = (key, val) => setF((x) => ({ ...x, [key]: x[key].includes(val) ? x[key].filter((y) => y !== val) : [...x[key], val] }));

  const unit = UNITS[f.cat].includes(f.unit) ? f.unit : defaultUnit(f.cat);
  const filters = { ...f, unit, qty: Number(String(f.qty).replace(',', '.')) || 0 };
  const rows = useMemo(() => rankRows(products, filters, settings, promos), [products, JSON.stringify(filters), settings, promos]);
  const flavors = useMemo(() => flavorIndex(products, f.cat), [products, f.cat]);
  const withMetric = rows.filter((r) => r.metric !== null);
  const without = rows.length - withMetric.length;

  // Oppdater de øverste treffene live når filteret endres
  const top = rows.slice(0, LIVE_TOP_N).map((r) => r.prod);
  const topKey = top.map((p) => p.liveOf || p.k).join('|');
  useEffect(() => {
    if (!live.enabled) return;
    const t = setTimeout(() => live.refresh(top), 900);
    return () => clearTimeout(t);
  }, [topKey, live.enabled]);

  useEffect(() => setShown(40), [JSON.stringify(filters)]);

  return (
    <div className="ranking">
      <aside className="filters" aria-label="Filtre">
        <div className="field">
          <label>Kategori</label>
          <div className="chips">
            {Object.entries(CATEGORIES).map(([id, c]) => (
              <button key={id} className={`chip ${f.cat === id ? 'on' : ''}`} onClick={() => set({ cat: id, subs: [], flavor: '', unit: defaultUnit(id) })}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Sorter etter</label>
          <div className="seg">
            {UNITS[f.cat].map((u) => (
              <button key={u} className={unit === u ? 'on' : ''} onClick={() => set({ unit: u })}>
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </div>
        <button className="ghost wide filter-toggle" onClick={() => setOpenFilters((o) => !o)} aria-expanded={openFilters}>
          {openFilters ? 'Skjul filtre' : `Flere filtre (smak, mengde, butikker)${f.groups.length || f.flavor || f.qty || f.shops.length || f.subs.length ? ' · aktive' : ''}`}
        </button>
        <div className={`filter-body ${openFilters ? 'open' : ''}`}>
        <div className="field">
          <label>Type</label>
          <div className="chips">
            {Object.entries(SUBCATEGORIES[f.cat]).map(([id, l]) => (
              <button key={id} className={`chip small ${f.subs.includes(id) ? 'on' : ''}`} onClick={() => toggleIn('subs', id)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="qty">Mengde jeg vil kjøpe (gir pris inkl. frakt og rabatt)</label>
          <div className="qty">
            <input id="qty" inputMode="decimal" placeholder="f.eks. 2" value={f.qty} onChange={(e) => set({ qty: e.target.value })} />
            <span>{QTY_LABEL[unit]}</span>
            {f.qty && (
              <button className="link" onClick={() => set({ qty: '' })}>
                Nullstill
              </button>
            )}
          </div>
          <p className="muted small">Tomt felt gir ren varepris per enhet. Fyller du inn mengde, regnes antall pakker, rabattkoder, førstekjøpsrabatt og frakt (med gratisgrensen) inn.</p>
        </div>
        <div className="field">
          <label>Smak</label>
          <div className="chips">
            {GROUPS.map((g) => (
              <button key={g} className={`chip small ${f.groups.includes(g) ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, flavor: '', groups: x.groups.includes(g) ? x.groups.filter((y) => y !== g) : [...x.groups, g] }))}>
                {g}
              </button>
            ))}
          </div>
          <input list="flavor-list" placeholder="… eller skriv eksakt smak" value={f.flavor} onChange={(e) => set({ flavor: e.target.value, groups: [] })} />
          <datalist id="flavor-list">
            {flavors.slice(0, 400).map(([fl]) => (
              <option key={fl} value={fl} />
            ))}
          </datalist>
          <p className="muted small">Bare smaker butikken viser som på lager, regnes med. Prisen er prisen for akkurat den smaken.</p>
        </div>
        <div className="field">
          <label htmlFor="q">Søk i navn/merke</label>
          <input id="q" placeholder="f.eks. star nutrition, creapure" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <div className="field">
          <label>Butikker</label>
          <div className="chips">
            {SHOP_IDS.map((id) => (
              <button key={id} className={`chip small ${f.shops.includes(id) ? 'on' : ''}`} onClick={() => toggleIn('shops', id)}>
                {SHOPS[id].name}
              </button>
            ))}
          </div>
          <p className="muted small">Ingen valgt = alle butikker.</p>
        </div>
        <div className="field toggles">
          <label className="row-check">
            <input type="checkbox" checked={f.hideShort} onChange={() => set({ hideShort: !f.hideShort })} /> Skjul kort dato / outlet
          </label>
          <label className="row-check">
            <input type="checkbox" checked={f.showOut} onChange={() => set({ showOut: !f.showOut })} /> Vis også utsolgte smaker
          </label>
          <button className="link" onClick={() => setF({ ...DEFAULT, cat: f.cat, unit: defaultUnit(f.cat) })}>
            Nullstill filtre
          </button>
        </div>
        </div>
      </aside>

      <section className="results" aria-live="polite">
        <div className="results-head">
          <h2>
            {CATEGORIES[f.cat].label}: {withMetric.length} treff sortert på {UNIT_LABEL[unit]}
            {filters.qty ? ` for ${f.qty} ${QTY_LABEL[unit]} inkl. frakt` : ''}
          </h2>
          {live.enabled && (
            <button className="ghost" onClick={() => live.refresh(rows.slice(0, LIVE_TOP_N).map((r) => r.prod), true)} disabled={live.busy.size > 0}>
              {live.busy.size ? `Oppdaterer ${live.busy.size}…` : 'Oppdater topp 15 live'}
            </button>
          )}
        </div>
        {without > 0 && (
          <p className="muted small">
            {without} produkter mangler data for {UNIT_LABEL[unit]} (f.eks. ukjent proteininnhold eller vekt) og vises nederst.
          </p>
        )}
        {rows.length === 0 && <div className="notice">Ingen treff. Prøv å fjerne noen filtre.</div>}
        <ol className="cards">
          {rows.slice(0, shown).map((r, i) => (
            <ProductCard key={r.prod.k} rank={i + 1} row={r} unit={unit} qtyMode={!!filters.qty} live={live} />
          ))}
        </ol>
        {rows.length > shown && (
          <button className="ghost wide" onClick={() => setShown((n) => n + 40)}>
            Vis flere ({rows.length - shown} igjen)
          </button>
        )}
      </section>
    </div>
  );
}

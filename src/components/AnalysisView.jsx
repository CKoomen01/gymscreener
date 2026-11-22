import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, SUBCATEGORIES, FLAVOR_GROUPS } from '../../core/normalize.js';
import { SHOPS, SHOP_IDS } from '../../core/shops.js';
import { UNIT_LABEL, CAT_UNITS, defaultUnit } from '../../core/pricing.js';
import { analysisGroups, categorySeries, periodRange } from '../../core/analysis.js';
import { dateOf, MIN_DAYS_FOR_BADGE } from '../../core/history.js';
import { useStored } from '../settings.js';
import { kr, krSmart, shopName, sizeLabel, linkFor } from '../format.js';
import LineChart from './LineChart.jsx';
import { HistoryBadge } from './PriceHistory.jsx';

const GROUPS = [...FLAVOR_GROUPS.map(([n]) => n), 'Annen smak', 'Ikke oppgitt'];
const PERIODS = [
  [30, '30 dager'],
  [90, '90 dager'],
  [0, '6 måneder'],
];
const LEVELS = [
  ['', 'Alle'],
  ['billig', 'Billig nå'],
  ['normal', 'Normal pris'],
  ['dyr', 'Dyr nå'],
];
const SORTS = [
  ['vsMean', 'Mest under egen snittpris'],
  ['drop', 'Størst prisfall i perioden'],
  ['price', 'Billigst nå'],
  ['shops', 'Flest butikker'],
];
const UNIT_SHORT = { pakke: 'Pris per pakke', ...UNIT_LABEL };
const DEFAULT = { cat: 'protein', subs: [], group: '', shops: [], q: '', hideShort: true, level: '', sort: 'vsMean', unit: 'kgProtein', days: 0 };
const SLOTS = 8;

// Fast farge per butikk (fargen følger butikken, ikke rekkefølgen); ved kollisjon i samme graf brukes neste ledige
function colorsFor(shops) {
  const used = new Set();
  const out = {};
  for (const s of [...shops].sort((a, b) => SHOP_IDS.indexOf(a) - SHOP_IDS.indexOf(b))) {
    let slot = SHOP_IDS.indexOf(s) % SLOTS;
    for (let k = 0; k < SLOTS && used.has(slot); k++) slot = (slot + 1) % SLOTS;
    used.add(slot);
    out[s] = `var(--series-${slot + 1})`;
  }
  return out;
}

const pct = (x, digits = 0) => {
  const s = Math.abs(x * 100).toFixed(digits);
  return `${Number(s) === 0 ? '±' : x > 0 ? '+' : '−'}${s.replace('.', ',')} %`;
};

function GroupCard({ g, unit, startDate, fmt }) {
  const colors = colorsFor(g.lines.map((l) => l.shop));
  const series = g.lines.map((l) => ({ id: l.shop, label: shopName(l.shop), color: colors[l.shop], values: l.vals }));
  const st = g.best.stats;
  return (
    <li className="acard">
      <header>
        <div>
          <h3>
            {g.prod.b ? `${g.prod.b} – ` : ''}
            {g.prod.n}
          </h3>
          <span className="muted small">
            {sizeLabel(g.prod)} · {g.lines.length} {g.lines.length === 1 ? 'butikk' : 'butikker'} · {st.days} {st.days === 1 ? 'dag' : 'dager'} med data
          </span>
        </div>
        <div className="acard-now">
          <span className="metric">{fmt(st.current)}</span>
          <span className="muted small">billigst nå ({shopName(g.best.shop)})</span>
          <HistoryBadge stats={st} />
        </div>
      </header>
      <LineChart series={series} startDate={startDate} height={170} format={fmt} ariaLabel={`Prisutvikling for ${g.prod.n}`} />
      <div className="table-scroll">
        <table className="offers stats">
          <thead>
            <tr>
              <th>Butikk</th>
              <th className="num">Nå</th>
              <th className="num">Snitt</th>
              <th className="num">Laveste</th>
              <th className="num">Høyeste</th>
              <th className="num">Mot snitt</th>
              <th className="num">I perioden</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {g.lines.map((l) => (
              <tr key={l.shop}>
                <td>
                  <span className="key" style={{ background: colors[l.shop] }} /> {shopName(l.shop)}
                  {l.stats.level && (
                    <div>
                      <HistoryBadge stats={l.stats} />
                    </div>
                  )}
                </td>
                <td className="num">
                  <strong>{fmt(l.stats.current)}</strong>
                  {unit !== 'pakke' && <div className="muted small">{kr(l.pack[l.pack.length - 1] ?? l.pack.filter((x) => x !== null).pop())}</div>}
                </td>
                <td className="num">{fmt(l.stats.mean)}</td>
                <td className="num">{fmt(l.stats.min)}</td>
                <td className="num">{fmt(l.stats.max)}</td>
                <td className={`num ${l.stats.vsMean < -0.005 ? 'good' : l.stats.vsMean > 0.005 ? 'bad-text' : ''}`}>{l.stats.days > 1 ? pct(l.stats.vsMean) : '–'}</td>
                <td className={`num ${l.stats.change < -0.005 ? 'good' : l.stats.change > 0.005 ? 'bad-text' : ''}`}>{l.stats.days > 1 ? pct(l.stats.change) : '–'}</td>
                <td>
                  <a className="buy small" href={linkFor(l.prod)} target="_blank" rel="noopener noreferrer" aria-label={`Til ${shopName(l.shop)}`}>
                    <span className="buy-text">Til butikk </span>↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </li>
  );
}

export default function AnalysisView({ products, history }) {
  const [f, setF] = useStored('analysis-v1', DEFAULT);
  const [shown, setShown] = useState(20);
  const [openFilters, setOpenFilters] = useState(false); // bare på mobil
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggleIn = (key, val) => setF((x) => ({ ...x, [key]: x[key].includes(val) ? x[key].filter((y) => y !== val) : [...x[key], val] }));

  const units = ['pakke', ...CAT_UNITS[f.cat]];
  const unit = units.includes(f.unit) ? f.unit : defaultUnit(f.cat);
  const range = useMemo(() => (history ? periodRange(history, f.days) : null), [history, f.days]);
  const filters = { ...f, unit };
  const groups = useMemo(() => (history ? analysisGroups(products, history, filters, range) : []), [products, history, range, JSON.stringify(filters)]);
  // Billigste-grafen trenger en enhetspris; ved «per pakke» brukes kategoriens standardenhet
  const cheapUnit = unit === 'pakke' ? defaultUnit(f.cat) : unit;
  const unitGroups = useMemo(
    () => (history && unit === 'pakke' ? analysisGroups(products, history, { ...filters, unit: cheapUnit, level: '' }, range) : null),
    [products, history, range, unit, cheapUnit, JSON.stringify(filters)]
  );
  const len = range ? range.to - range.from + 1 : 0;
  const cat = useMemo(() => categorySeries(groups, len), [groups, len]);
  const cheap = useMemo(() => (unitGroups ? categorySeries(unitGroups, len) : cat), [unitGroups, cat, len]);

  useEffect(() => setShown(20), [JSON.stringify(filters)]);

  if (!history) return <div className="notice">Laster prishistorikk …</div>;

  const startDate = dateOf(history, range.from);
  const histDays = range.to + 1;
  const fmtFor = (u) => (u === 'pakke' ? kr : krSmart);
  const fmt = fmtFor(unit);
  const indexNow = [...cat.index].reverse().find((v) => v !== null);
  const cheapNow = [...cheap.cheapest].reverse().find((v) => v !== null);
  const cheapNowOf = [...cheap.cheapestOf].reverse().find((v) => v !== null);
  const counts = { billig: 0, dyr: 0 };
  for (const g of groups) if (g.best.stats.level) counts[g.best.stats.level] = (counts[g.best.stats.level] || 0) + 1;
  const activeExtra = f.subs.length || f.group || f.shops.length || f.q || f.level;

  return (
    <div className="ranking analysis">
      <aside className="filters" aria-label="Filtre for prisutvikling">
        <div className="field">
          <label>Kategori</label>
          <div className="chips">
            {Object.entries(CATEGORIES).map(([id, c]) => (
              <button key={id} className={`chip ${f.cat === id ? 'on' : ''}`} onClick={() => set({ cat: id, subs: [], group: '', unit: defaultUnit(id) })}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Periode</label>
          <div className="seg">
            {PERIODS.map(([d, l]) => (
              <button key={d} className={f.days === d ? 'on' : ''} onClick={() => set({ days: d })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Vis pris som</label>
          <div className="seg">
            {units.map((u) => (
              <button key={u} className={unit === u ? 'on' : ''} onClick={() => set({ unit: u })}>
                {UNIT_SHORT[u]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Prisnivå nå (mot egen historikk)</label>
          <div className="seg">
            {LEVELS.map(([id, l]) => (
              <button key={id} className={f.level === id ? 'on' : ''} onClick={() => set({ level: id })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="asort">Rekkefølge</label>
          <select id="asort" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            {SORTS.map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="ghost wide filter-toggle" onClick={() => setOpenFilters((o) => !o)} aria-expanded={openFilters}>
          {openFilters ? 'Skjul filtre' : `Flere filtre (type, smak, butikker)${activeExtra ? ' · aktive' : ''}`}
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
            <label>Smaksgruppe</label>
            <div className="chips">
              <button className={`chip small ${!f.group ? 'on' : ''}`} onClick={() => set({ group: '' })}>
                Alle (billigste smak)
              </button>
              {GROUPS.map((g) => (
                <button key={g} className={`chip small ${f.group === g ? 'on' : ''}`} onClick={() => set({ group: f.group === g ? '' : g })}>
                  {g}
                </button>
              ))}
            </div>
            <p className="muted small">Smaker samles i grupper, så «Double Chocolate» og «Triple Chocolate» regnes som sjokolade. Grafen viser billigste smak i gruppen hver dag.</p>
          </div>
          <div className="field">
            <label htmlFor="aq">Søk i navn/merke</label>
            <input id="aq" placeholder="f.eks. star nutrition, whey 80" value={f.q} onChange={(e) => set({ q: e.target.value })} />
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
            <button className="link" onClick={() => setF({ ...DEFAULT, cat: f.cat, unit: defaultUnit(f.cat) })}>
              Nullstill filtre
            </button>
          </div>
        </div>
      </aside>

      <section className="results">
        <p className="muted small hist-note">
          Prisene logges ved hvert skann siden {new Date(history.start).toLocaleDateString('nb-NO')} ({histDays} {histDays === 1 ? 'dag' : 'dager'}), og historikken bygges opp mot 6 måneder. Merkene «Billig nå» og «Dyr nå» krever minst {MIN_DAYS_FOR_BADGE} dager med data for varen. Grafene viser butikkens hyllepris, uten medlemspris og rabattkoder.
        </p>

        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Produkter</span>
            <span className="kpi-value">{groups.length.toLocaleString('nb-NO')}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Billig nå</span>
            <span className="kpi-value">{(counts.billig || 0).toLocaleString('nb-NO')}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Dyr nå</span>
            <span className="kpi-value">{(counts.dyr || 0).toLocaleString('nb-NO')}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Prisendring i perioden</span>
            <span className="kpi-value">{indexNow ? pct(indexNow / 100 - 1, 1) : '–'}</span>
          </div>
        </div>

        <div className="cat-charts">
          <div className="panel chart-panel">
            <h3>Prisindeks – {CATEGORIES[f.cat].label.toLowerCase()}</h3>
            <p className="muted small">Snittlig prisendring for produktene i utvalget, 100 = periodens start. Under 100 betyr at prisene har falt.</p>
            <LineChart
              series={[{ id: 'idx', label: 'Prisindeks', color: 'var(--accent)', values: cat.index }]}
              startDate={startDate}
              height={180}
              format={(v) => v.toFixed(1).replace('.', ',')}
              refLine={100}
              refLabel="Start = 100"
              ariaLabel="Prisindeks for kategorien"
            />
          </div>
          <div className="panel chart-panel">
            <h3>Billigste {UNIT_LABEL[cheapUnit]}</h3>
            <p className="muted small">
              Laveste {UNIT_LABEL[cheapUnit]} i utvalget hver dag.
              {cheapNowOf ? ` Nå: ${fmtFor(cheapUnit)(cheapNow)} – ${cheapNowOf.prod.b ? `${cheapNowOf.prod.b} ` : ''}${cheapNowOf.prod.n} hos ${shopName(cheapNowOf.shop)}.` : ''}
            </p>
            <LineChart
              series={[{ id: 'min', label: `Billigste ${UNIT_LABEL[cheapUnit]}`, color: 'var(--accent)', values: cheap.cheapest }]}
              startDate={startDate}
              height={180}
              format={fmtFor(cheapUnit)}
              ariaLabel={`Billigste ${UNIT_LABEL[cheapUnit]} over tid`}
            />
          </div>
        </div>

        <div className="results-head">
          <h2>
            {groups.length} produkter · {SORTS.find(([id]) => id === f.sort)?.[1].toLowerCase()} · {UNIT_SHORT[unit].toLowerCase()}
          </h2>
        </div>
        {groups.length === 0 && (
          <div className="notice">
            {f.level
              ? `Ingen produkter har nivået «${LEVELS.find(([id]) => id === f.level)[1]}» med disse filtrene. Merkene krever minst ${MIN_DAYS_FOR_BADGE} dager med prishistorikk.`
              : `Ingen produkter med prishistorikk${unit !== 'pakke' ? ` og kjent ${UNIT_LABEL[unit]}` : ''} for disse filtrene.`}
          </div>
        )}
        <ol className="acards">
          {groups.slice(0, shown).map((g) => (
            <GroupCard key={g.key} g={g} unit={unit} startDate={startDate} fmt={fmt} />
          ))}
        </ol>
        {groups.length > shown && (
          <button className="ghost wide" onClick={() => setShown((x) => x + 20)}>
            Vis flere ({groups.length - shown} igjen)
          </button>
        )}
      </section>
    </div>
  );
}

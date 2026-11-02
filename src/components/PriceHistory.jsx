import React from 'react';
import { MIN_DAYS_FOR_BADGE } from '../../core/history.js';
import { kr } from '../format.js';

const LEVEL = {
  billig: { label: 'Billig nå', cls: 'cheap', text: 'blant de 25 % laveste prisene' },
  normal: { label: 'Normal pris', cls: 'normalp', text: 'midt i det vanlige prisområdet' },
  dyr: { label: 'Dyr nå', cls: 'expensive', text: 'blant de 25 % høyeste prisene' },
};

// Merke på kortet
export function HistoryBadge({ stats }) {
  if (!stats || !stats.level) return null;
  const l = LEVEL[stats.level];
  return (
    <span className={`badge ${l.cls}`} title={`Sammenlignet med denne butikkens egen pris de siste ${stats.days} dagene`}>
      {l.label}
    </span>
  );
}

function pct(x) {
  const v = Math.round(x * 100);
  return v === 0 ? 'lik snittet' : v < 0 ? `${-v} % under snittet` : `${v} % over snittet`;
}

// Liten trinngraf over prisutviklingen (ren SVG, følger lys/mørk modus via currentColor/variabler)
function Chart({ stats, current }) {
  const pts = stats.points;
  if (pts.length < 2) return null;
  const W = 300;
  const H = 70;
  const pad = 4;
  const lo = Math.min(stats.min, current);
  const hi = Math.max(stats.max, current);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (p) => H - pad - ((p - lo) / span) * (H - 2 * pad);
  let d = `M ${x(0)} ${y(pts[0].price)}`;
  for (let i = 1; i < pts.length; i++) d += ` H ${x(i)} V ${y(pts[i].price)}`;
  return (
    <svg className="price-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Prisutvikling siste ${stats.days} dager`}>
      <line x1={pad} x2={W - pad} y1={y(stats.mean)} y2={y(stats.mean)} className="mean" />
      <path d={d} className="line" />
      <circle cx={x(pts.length - 1)} cy={y(current)} r="3" className="dot" />
    </svg>
  );
}

// Statistikkblokk i prisdetaljene
export function HistoryDetails({ stats, current }) {
  if (!stats) return <p className="muted small hist">Ingen prishistorikk for denne varen ennå.</p>;
  return (
    <div className="hist">
      <div className="hist-head">
        <strong>Prishistorikk</strong>{' '}
        <span className="muted small">
          {stats.days} {stats.days === 1 ? 'dag' : 'dager'} (fra {new Date(stats.startDate).toLocaleDateString('nb-NO')}, bygges opp mot 6 måneder)
        </span>
      </div>
      <dl className="hist-grid">
        <dt>Snitt</dt>
        <dd>{kr(stats.mean)}</dd>
        <dt>Laveste</dt>
        <dd>{kr(stats.min)}</dd>
        <dt>Høyeste</dt>
        <dd>{kr(stats.max)}</dd>
        <dt>Nå</dt>
        <dd>
          {kr(current)} ({pct(stats.vsMean)})
        </dd>
      </dl>
      <Chart stats={stats} current={current} />
      <p className="muted small">
        {stats.level
          ? `Nåprisen er ${LEVEL[stats.level].text} for denne varen i perioden.`
          : stats.days < MIN_DAYS_FOR_BADGE
            ? `Merket «Billig nå» / «Dyr nå» vises når det finnes minst ${MIN_DAYS_FOR_BADGE} dager med data.`
            : 'Prisen har ikke endret seg i perioden.'}
        {stats.isLowest && stats.days > 1 ? ' Dette er den laveste prisen i perioden.' : ''}
      </p>
    </div>
  );
}

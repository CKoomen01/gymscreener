import React, { useEffect, useRef, useState } from 'react';

// Trinnlinjegraf i ren SVG med akser, forklaring og trådkors med verdier for alle linjer.
// series: [{ id, label, color, values: (number|null)[] }]  (én verdi per dag fra `startDate`)
const nfDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const nfDateLong = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return w;
}

// «Pene» akseverdier (1, 2, 2,5, 5 × 10^n)
function niceTicks(lo, hi, count = 4) {
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let t = start; t <= hi + step * 0.001; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export default function LineChart({ series, startDate, height = 180, format, refLine, refLabel, ariaLabel }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null); // dagindeks
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values.filter((v) => v !== null));
  const base = Date.parse(`${startDate}T00:00:00Z`);
  const dateAt = (i) => new Date(base + i * 86400000);

  if (!all.length) return <div ref={wrap} className="chart-empty muted small">Ingen prisdata i perioden.</div>;

  const vals = refLine !== undefined ? [...all, refLine] : all;
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const M = { l: 58, r: 12, t: 8, b: 24 };
  const W = Math.max(width, 240);
  const H = height;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (i) => M.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => M.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  // Trinnlinje: prisen gjelder til neste endring; hull der varen ikke var med i skannet
  const pathOf = (values) => {
    let d = '';
    let prev = null;
    values.forEach((v, i) => {
      if (v === null) {
        prev = null;
        return;
      }
      d += prev === null ? `M${x(i)},${y(v)}` : `H${x(i)}V${y(v)}`;
      prev = v;
    });
    return d;
  };
  const singles = (values) => values.map((v, i) => (v !== null && (i === 0 || values[i - 1] === null) && (i === values.length - 1 || values[i + 1] === null) ? i : -1)).filter((i) => i >= 0);

  // Datoetiketter: ca. én per 90 px
  const xCount = Math.max(2, Math.min(n, Math.floor(iw / 90)));
  const xTicks = n <= 1 ? [0] : Array.from({ length: xCount }, (_, k) => Math.round((k / (xCount - 1)) * (n - 1)));

  const pick = (clientX) => {
    const r = wrap.current.getBoundingClientRect();
    const px = clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((px - M.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n - 1) - 1));
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const rows = hover === null ? [] : series.map((s) => ({ s, v: s.values[hover] })).filter((r) => r.v !== null && r.v !== undefined).sort((a, b) => a.v - b.v);
  const tipLeft = hover === null ? 0 : x(hover) > W / 2 ? x(hover) - 12 : x(hover) + 12;

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.l - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 && xTicks.length > 1 ? 'start' : k === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'}>
            {nfDate.format(dateAt(i))}
          </text>
        ))}
        {refLine !== undefined && <line x1={M.l} x2={W - M.r} y1={y(refLine)} y2={y(refLine)} className="ref" />}
        {series.map((s) => (
          <g key={s.id}>
            <path d={pathOf(s.values)} className="series" style={{ stroke: s.color }} />
            {singles(s.values).map((i) => (
              <circle key={i} cx={x(i)} cy={y(s.values[i])} r="4" className="pt" style={{ fill: s.color }} />
            ))}
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} className="cross" />
            {rows.map(({ s, v }) => (
              <circle key={s.id} cx={x(hover)} cy={y(v)} r="4.5" className="pt ring" style={{ fill: s.color }} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && rows.length > 0 && (
        <div className="tip" style={{ left: tipLeft, top: M.t, transform: x(hover) > W / 2 ? 'translateX(-100%)' : 'none' }} role="status">
          <div className="tip-date">{nfDateLong.format(dateAt(hover))}</div>
          {rows.map(({ s, v }) => (
            <div key={s.id} className="tip-row">
              <span className="key" style={{ background: s.color }} />
              <strong>{format(v)}</strong>
              <span className="muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {(series.length > 1 || refLabel) && (
        <ul className="legend">
          {series.length > 1 &&
            series.map((s) => (
              <li key={s.id}>
                <span className="key" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          {refLabel && (
            <li>
              <span className="key dashed" />
              {refLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

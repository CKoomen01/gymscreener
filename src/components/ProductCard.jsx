import React, { useState } from 'react';
import { UNIT_LABEL } from '../../core/pricing.js';
import { kr, krSmart, shopName, sizeLabel, linkFor, clock } from '../format.js';

export function Breakdown({ row, qtyMode }) {
  const { v, up, order, qty } = row;
  return (
    <dl className="breakdown">
      {v.lp && (
        <>
          <dt>Førpris</dt>
          <dd className="strike">{kr(v.lp)}</dd>
        </>
      )}
      <dt>{up.kind === 'medlemspris' ? 'Medlemspris' : up.kind === 'kampanje' ? 'Kampanjepris' : 'Pris'}</dt>
      <dd>
        {kr(up.price)}
        {qty > 1 ? ` × ${qty}` : ''}
      </dd>
      {order.discount && (
        <>
          <dt title={order.discount.source}>{order.discount.label}</dt>
          <dd className="good">−{kr(order.discount.amount)}</dd>
        </>
      )}
      {order.perks?.map((p) => (
        <React.Fragment key={p.label}>
          <dt title={p.source}>{p.label}</dt>
          <dd className="good">−{kr(p.amount)}</dd>
        </React.Fragment>
      ))}
      <dt>Frakt</dt>
      <dd>{order.shippingUnknown ? 'ukjent (vises i kassen)' : order.shipping === 0 ? 'gratis' : kr(order.shipping)}</dd>
      {order.points > 0 && (
        <>
          <dt>Bonuspoeng</dt>
          <dd className="good">−{kr(order.points)}</dd>
        </>
      )}
      {qtyMode && (
        <>
          <dt>
            <strong>Totalt</strong>
          </dt>
          <dd>
            <strong>{order.shippingUnknown ? `${kr(order.total)} + frakt` : kr(order.total)}</strong>
          </dd>
        </>
      )}
    </dl>
  );
}

export default function ProductCard({ rank, row, unit, qtyMode, live }) {
  const [open, setOpen] = useState(false);
  const { prod, v, up, matching, metric, order, qty } = row;
  const orig = prod.liveOf || prod.k;
  const busy = live?.busy?.has(orig);
  const others = matching.filter((x) => x !== v && x.f);
  return (
    <li className={`card ${v.st ? '' : 'out'}`}>
      <div className="rank">{rank}</div>
      <div className="main">
        <div className="title-row">
          <a className="title" href={linkFor(prod, v)} target="_blank" rel="noopener noreferrer">
            {prod.n}
          </a>
          <span className="shop">{shopName(prod.s)}</span>
        </div>
        <div className="meta">
          {prod.b && <span>{prod.b}</span>}
          {sizeLabel(prod) && <span>{sizeLabel(prod)}</span>}
          {prod.pp && (
            <span title={prod.ppFrom ? 'Butikken oppgir ikke næringsinnhold. Tallet er hentet fra samme produkt i en annen butikk.' : undefined}>
              {prod.ppFrom ? '≈ ' : ''}
              {String(prod.pp).replace('.', ',')} % protein
            </span>
          )}
          {prod.pu && (prod.c === 'barer' || prod.c === 'drikke') && <span>{String(prod.pu).replace('.', ',')} g protein/stk</span>}
          {prod.ag && prod.c === 'kreatin' && prod.sc !== 'monohydrat' && <span>{String(prod.ag).replace('.', ',')} g kreatin</span>}
          {prod.dd && <span>{prod.dd} dagsdoser</span>}
        </div>
        <div className="flavor">
          {v.f ? (
            <>
              <strong>{v.f}</strong> {v.st ? <span className="stock in">på lager</span> : <span className="stock outtxt">utsolgt</span>}
            </>
          ) : (
            <span className="muted">Smak ikke oppgitt</span>
          )}
          {others.length > 0 && (
            <span className="muted small">
              {' '}
              · også: {others.slice(0, 4).map((x) => `${x.f}${x.p !== v.p ? ` (${kr(x.p)})` : ''}`).join(', ')}
              {others.length > 4 ? ` +${others.length - 4}` : ''}
            </span>
          )}
        </div>
        <div className="badges">
          {up.kind === 'kampanje' && <span className="badge sale">Kampanje</span>}
          {up.kind === 'medlemspris' && <span className="badge member">Medlemspris</span>}
          {order.discount && <span className="badge code">{order.discount.label}</span>}
          {order.perks?.map((p) => (
            <span key={p.label} className="badge code">
              {p.label}
            </span>
          ))}
          {prod.sd ? <span className="badge short">Kort dato{v.x ? ` (${v.x.slice(0, 10)})` : ''}</span> : null}
          {prod.live && !prod.liveFailed && <span className="badge live">Live {clock(prod.live)}</span>}
          {prod.liveFailed && <span className="badge warn">Live-sjekk feilet, viser siste skann</span>}
          {busy && <span className="badge wait">Oppdaterer…</span>}
        </div>
        {open && <Breakdown row={row} qtyMode={qtyMode} />}
        <div className="ship muted small">
          {order.freeShippingAt ? (order.missingForFree > 0 ? `Gratis frakt fra ${kr(order.freeShippingAt)} (mangler ${kr(order.missingForFree)})` : 'Gratis frakt') : 'Ingen gratisfraktgrense'}
          {' · '}
          <button className="link" onClick={() => setOpen((o) => !o)}>
            {open ? 'Skjul prisdetaljer' : 'Prisdetaljer'}
          </button>
        </div>
      </div>
      <div className="price">
        <div className="metric">{metric !== null ? krSmart(metric) : '–'}</div>
        <div className="unit muted small">
          {metric !== null ? UNIT_LABEL[unit] : `mangler data for ${UNIT_LABEL[unit]}`}
          {metric !== null && qtyMode && order.shippingUnknown && <div className="warn-text">+ frakt (ukjent)</div>}
        </div>
        <div className="pkg">
          {qtyMode ? (
            <>
              {qty} × {kr(up.price)}
              <div className="muted small">{order.shippingUnknown ? `${kr(order.total)} + frakt` : `${kr(order.total)} totalt`}</div>
            </>
          ) : (
            <>
              {kr(up.price)}
              {v.lp && <span className="strike small"> {kr(v.lp)}</span>}
            </>
          )}
        </div>
        <a className="buy" href={linkFor(prod, v)} target="_blank" rel="noopener noreferrer">
          Til butikken ↗
        </a>
      </div>
    </li>
  );
}

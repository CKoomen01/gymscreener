import React, { useState } from 'react';
import { SHOPS, SHOP_IDS } from '../../core/shops.js';
import { kr, timeAgo } from '../format.js';
import { PROXY_URL } from '../config.js';

function shipText(s) {
  const sh = s.shipping;
  if (sh.tiers) return sh.tiers.map(([from, p]) => (from ? `${kr(p)} over ${kr(from)}` : `${kr(p)}`)).join(', ') + ' (ingen gratis frakt)';
  const free = sh.free ? `Gratis over ${kr(sh.free)}` : 'Ingen gratis frakt';
  const under = sh.cheapest !== null && sh.cheapest !== undefined ? `, ellers ${kr(sh.cheapest)} (${sh.cheapestLabel})` : ', pris under grensen vises bare i kassen';
  return free + under;
}

export default function ShopsView({ data, settings, setSettings, openSetup }) {
  const [proxy, setProxy] = useState(settings.proxy || '');
  return (
    <div className="shops">
      <section className="panel">
        <h2>Mine innstillinger</h2>
        <p>
          Medlemskap: {SHOP_IDS.filter((id) => settings.members?.[id]).map((id) => SHOPS[id].membership?.name).filter(Boolean).join(', ') || 'ingen'}.
          <br />
          Førstekjøpsrabatt: {SHOP_IDS.filter((id) => settings.firstTime?.[id]).map((id) => SHOPS[id].name).join(', ') || 'ingen'}.
          <br />
          Bonuspoeng som rabatt: {settings.points ? 'ja' : 'nei'} · Rabattkoder: {settings.codes !== false ? 'ja' : 'nei'} · Levering: {settings.delivery === 'home' ? 'hjemlevering' : 'billigste'}
        </p>
        <button className="primary" onClick={openSetup}>
          Endre rabatter og levering
        </button>
        <div className="field">
          <label htmlFor="proxy">Adresse til live-proxy (Cloudflare Worker)</label>
          <div className="qty">
            <input id="proxy" placeholder={PROXY_URL || 'https://gymscreener-proxy.<navn>.workers.dev'} value={proxy} onChange={(e) => setProxy(e.target.value)} />
            <button className="ghost" onClick={() => setSettings((s) => ({ ...s, proxy: proxy.trim() }))}>
              Lagre
            </button>
          </div>
          <p className="muted small">{PROXY_URL ? 'Siden har en innebygd proxy. Feltet trengs bare hvis du vil bruke en annen.' : 'Lim inn adressen du får når Worker-en er satt opp.'}</p>
        </div>
      </section>

      <h2>Butikker ({SHOP_IDS.length})</h2>
      <p className="muted small">Full skann kjøres automatisk flere ganger daglig. Butikker som feiler, viser data fra forrige vellykkede skann.</p>
      <div className="shop-grid">
        {SHOP_IDS.map((id) => {
          const s = SHOPS[id];
          const st = data.shops?.[id];
          const promos = st?.promos;
          return (
            <article key={id} className="shop-card">
              <header>
                <h3>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.name} ↗
                  </a>
                </h3>
                <span className={`pill ${st?.status === 'ok' ? 'ok' : st?.status === 'stale' ? 'wait' : 'off'}`}>{st ? `${st.count} varer · ${timeAgo(st.scannedAt)}` : 'ikke skannet'}</span>
              </header>
              <dl>
                <dt>Frakt</dt>
                <dd>
                  {shipText(s)}
                  {promos?.freeShippingBanner && s.shipping.free && promos.freeShippingBanner < s.shipping.free && <div className="good small">Banner nå: gratis frakt over {kr(promos.freeShippingBanner)}</div>}
                </dd>
                <dt>Sendes fra</dt>
                <dd>{s.shipsFrom}</dd>
                <dt>Medlemskap</dt>
                <dd>{s.membership ? `${s.membership.name}: ${s.membership.desc}` : 'Ingen'}</dd>
                <dt>Førstekjøp</dt>
                <dd>{s.firstPurchase ? s.firstPurchase.desc : 'Ingen'}</dd>
                <dt>Koder på siden nå</dt>
                <dd>
                  {promos?.codes?.length
                    ? promos.codes.map((c) => (
                        <div key={c.code}>
                          <code>{c.code}</code> {c.type === 'percent' ? `${c.value} %` : c.type === 'amount' ? `${kr(c.value)}` : '(vilkår ukjent, regnes ikke med)'}
                          {c.minOrder ? ` over ${kr(c.minOrder)}` : ''}
                          {c.scope !== 'alle' ? ` på ${c.scope}` : ''}
                        </div>
                      ))
                    : 'Ingen funnet'}
                </dd>
              </dl>
              {!s.shipping.tiers && (s.shipping.cheapest === null || s.shipping.cheapest === undefined) && (
                <div className="field">
                  <label htmlFor={`ship-${id}`}>Fraktpris jeg har sett i kassen (under gratisgrensen)</label>
                  <div className="qty">
                    <input
                      id={`ship-${id}`}
                      inputMode="numeric"
                      placeholder="ukjent"
                      defaultValue={settings.shipOverride?.[id]?.cheapest ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim() === '' ? undefined : Number(e.target.value.replace(',', '.'));
                        setSettings((x) => ({ ...x, shipOverride: { ...(x.shipOverride || {}), [id]: v === undefined || Number.isNaN(v) ? undefined : { cheapest: v, home: v } } }));
                      }}
                    />
                    <span>kr</span>
                  </div>
                  <p className="muted small">Butikken viser ikke fraktprisen før i kassen. Fyller du inn prisen, regnes den med i mengdemodus og handlekurven.</p>
                </div>
              )}
              <a className="small" href={s.termsUrl} target="_blank" rel="noopener noreferrer">
                Butikkens fraktvilkår ↗
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}

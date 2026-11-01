import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATA_URL, PROXY_URL, LIVE_TTL_MS } from './config.js';
import { useSettings, useStored } from './settings.js';
import { refreshProduct, proxyHealthy } from './live.js';
import { mapLimit } from '../core/util.js';
import { timeAgo } from './format.js';
import Onboarding from './components/Onboarding.jsx';
import RankingView from './components/RankingView.jsx';
import SameProductView from './components/SameProductView.jsx';
import CartView from './components/CartView.jsx';
import ShopsView from './components/ShopsView.jsx';

const TABS = [
  ['rangering', 'Billigst per kategori'],
  ['produkt', 'Samme produkt'],
  ['handlekurv', 'Handlekurv'],
  ['butikker', 'Butikker og innstillinger'],
];

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useSettings();
  const [tab, setTab] = useStored('tab', 'rangering');
  const [showSetup, setShowSetup] = useState(false);
  const [live, setLive] = useState({}); // k -> { at, items }
  const [liveBusy, setLiveBusy] = useState(new Set());
  const [proxyOk, setProxyOk] = useState(null);
  const proxy = (settings.proxy || PROXY_URL || '').trim();

  useEffect(() => {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!proxy) return setProxyOk(null);
    proxyHealthy(proxy).then(setProxyOk);
  }, [proxy]);

  const promos = useMemo(() => Object.fromEntries(Object.entries(data?.shops || {}).map(([id, s]) => [id, s.promos])), [data]);

  // Slår sammen full skann med live-oppdaterte produkter
  const products = useMemo(() => {
    if (!data) return [];
    const replaced = new Set(Object.keys(live));
    const out = data.products.filter((p) => !replaced.has(p.k));
    for (const k of replaced) out.push(...live[k].items);
    return out;
  }, [data, live]);

  const liveRef = useRef(live);
  liveRef.current = live;
  const refreshMany = useCallback(
    async (prods, force = false) => {
      if (!proxy || proxyOk === false) return;
      const todo = prods.filter((p) => {
        const orig = p.liveOf || p.k;
        const l = liveRef.current[orig];
        return force || !l || Date.now() - l.at > LIVE_TTL_MS;
      });
      if (!todo.length) return;
      setLiveBusy((b) => new Set([...b, ...todo.map((p) => p.liveOf || p.k)]));
      await mapLimit(todo, 4, async (p) => {
        const orig = p.liveOf || p.k;
        try {
          const fresh = await refreshProduct(p, proxy);
          if (fresh?.length) setLive((m) => ({ ...m, [orig]: { at: Date.now(), items: fresh.map((x) => ({ ...x, liveOf: orig })) } }));
          else setLive((m) => ({ ...m, [orig]: { at: Date.now(), items: [{ ...p, liveOf: orig, liveFailed: true }] } }));
        } finally {
          setLiveBusy((b) => {
            const n = new Set(b);
            n.delete(orig);
            return n;
          });
        }
      });
    },
    [proxy, proxyOk]
  );

  const liveInfo = { enabled: !!proxy && proxyOk !== false, busy: liveBusy, refresh: refreshMany, proxyOk };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 64 64" width="28" height="28"><rect width="64" height="64" rx="14" fill="currentColor" /><path d="M14 26h6v12h-6zM44 26h6v12h-6zM20 30h24v4H20z" fill="var(--bg)" /></svg>
          </span>
          <div>
            <h1>Gymscreener</h1>
            <p className="sub">Billigste kosttilskudd per kg i norske nettbutikker</p>
          </div>
        </div>
        <div className="status">
          {data && (
            <span title={new Date(data.generatedAt).toLocaleString('nb-NO')}>
              Full skann {timeAgo(data.generatedAt)} · {data.products.length.toLocaleString('nb-NO')} varianter
            </span>
          )}
          <span className={`pill ${liveInfo.enabled ? (proxyOk ? 'ok' : 'wait') : 'off'}`}>
            {!proxy ? 'Live: ikke satt opp' : proxyOk === null ? 'Live: kobler til…' : proxyOk ? 'Live: på' : 'Live: proxy svarer ikke'}
          </span>
          <button className="ghost" onClick={() => setShowSetup(true)}>Mine rabatter</button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {error && <div className="notice error">Klarte ikke å laste prisdata ({error}). Prøv å laste siden på nytt.</div>}
        {!data && !error && <div className="notice">Laster priser…</div>}
        {data && tab === 'rangering' && <RankingView products={products} settings={settings} promos={promos} live={liveInfo} />}
        {data && tab === 'produkt' && <SameProductView products={products} settings={settings} promos={promos} live={liveInfo} />}
        {data && tab === 'handlekurv' && <CartView products={products} settings={settings} promos={promos} live={liveInfo} />}
        {data && tab === 'butikker' && <ShopsView data={data} settings={settings} setSettings={setSettings} openSetup={() => setShowSetup(true)} />}
      </main>

      <footer className="foot">
        Prisene hentes fra butikkenes egne nettsider. Rabattkoder tas bare med når butikken selv viser dem. Sjekk alltid prisen i kassen før du kjøper.
      </footer>

      {(showSetup || (data && !settings.onboarded)) && (
        <Onboarding
          data={data}
          settings={settings}
          onSave={(s) => {
            setSettings({ ...s, onboarded: true });
            setShowSetup(false);
          }}
          onClose={settings.onboarded ? () => setShowSetup(false) : null}
        />
      )}
    </div>
  );
}

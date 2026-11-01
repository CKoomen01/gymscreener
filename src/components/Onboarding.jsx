import React, { useState } from 'react';
import { SHOPS, SHOP_IDS } from '../../core/shops.js';

// Spørsmålene som besvares før søket, slik at bare rabatter du faktisk får regnes med.
export default function Onboarding({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const toggle = (field, id) => setS((x) => ({ ...x, [field]: { ...x[field], [id]: !x[field]?.[id] } }));
  const memberShops = SHOP_IDS.filter((id) => SHOPS[id].membership);
  const firstShops = SHOP_IDS.filter((id) => SHOPS[id].firstPurchase);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="modal">
        <h2 id="setup-title">Før du søker: hvilke rabatter får du?</h2>
        <p className="muted">Bare rabatter du krysser av for, regnes inn i prisene. Du kan endre dette når som helst under «Mine rabatter».</p>

        <section>
          <h3>Medlemskap</h3>
          <p className="muted small">Alle disse er gratis. Kryss av for de du har eller vil registrere deg i. Da brukes medlemsprisene der butikken viser dem.</p>
          <ul className="checklist">
            {memberShops.map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked={!!s.members?.[id]} onChange={() => toggle('members', id)} />
                  <span>
                    <strong>{SHOPS[id].membership.name}</strong>
                    <span className="muted small"> · {SHOPS[id].membership.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className="row-check">
            <input type="checkbox" checked={!!s.points} onChange={() => setS((x) => ({ ...x, points: !x.points }))} />
            <span>Regn bonuspoeng som rabatt (ca. 2–2,5 % hos Club Gymgrossisten, Sportylab og XXL). Av som standard, fordi poengene kommer som bonussjekk senere.</span>
          </label>
        </section>

        <section>
          <h3>Førstekjøpsrabatt</h3>
          <p className="muted small">Kryss av for butikkene du <strong>ikke</strong> har handlet i før. Da regnes velkomstrabatten med.</p>
          <ul className="checklist">
            {firstShops.map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked={!!s.firstTime?.[id]} onChange={() => toggle('firstTime', id)} />
                  <span>
                    <strong>Jeg har ikke handlet hos {SHOPS[id].name}</strong>
                    <span className="muted small"> · {SHOPS[id].firstPurchase.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Rabattkoder og frakt</h3>
          <label className="row-check">
            <input type="checkbox" checked={s.codes !== false} onChange={() => setS((x) => ({ ...x, codes: x.codes === false }))} />
            <span>Bruk rabattkoder som butikkene selv viser på nettsiden sin (koden står ved prisen, så du kan bruke den i kassen).</span>
          </label>
          <div className="radio-row">
            <span>Leveringsmåte i beregningen:</span>
            <label>
              <input type="radio" name="delivery" checked={s.delivery !== 'home'} onChange={() => setS((x) => ({ ...x, delivery: 'cheapest' }))} /> Billigste (hentested/postkasse)
            </label>
            <label>
              <input type="radio" name="delivery" checked={s.delivery === 'home'} onChange={() => setS((x) => ({ ...x, delivery: 'home' }))} /> Hjemlevering
            </label>
          </div>
        </section>

        <div className="modal-actions">
          {onClose && (
            <button className="ghost" onClick={onClose}>
              Avbryt
            </button>
          )}
          <button className="primary" onClick={() => onSave(s)}>
            Lagre og vis priser
          </button>
        </div>
      </div>
    </div>
  );
}

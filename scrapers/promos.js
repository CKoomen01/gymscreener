// Leser butikkens EGEN forside etter rabattkoder og fraktgrenser i bannere.
// Bare koder som står på butikkens egen side tas med (ingen kupongsider).
import { stripHtml } from '../core/util.js';

const STOP = new Set(['NOK', 'MVA', 'HTTP', 'HTTPS', 'HTML', 'KODE', 'RABATT', 'RABATTKODE', 'GRATIS', 'FRAKT', 'BLACK', 'FRIDAY', 'WEEK', 'NOVEMBER', 'MONTH', 'SALE', 'OUTLET', 'NYHET', 'TILBUD']);

const SCOPES = [
  ['pwo', /pre[\s-]?workout|pwo/i],
  ['kreatin', /kreatin|creatine/i],
  ['protein', /proteinpulver|whey|protein(?!bar)/i],
  ['barer', /barer|proteinbar/i],
  ['vitaminer', /vitamin/i],
  ['aminosyrer', /bcaa|eaa|aminosyre/i],
];

export function parsePromos(text) {
  const codes = [];
  const re = /(?:rabatt)?kode(?:n)?\s*(?:er|:)?\s*[«"“'‘]?([A-ZÆØÅ0-9]{4,20})\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const code = m[1].toUpperCase();
    if (STOP.has(code) || !/[A-Z]/.test(code) || code !== m[1]) continue; // koder er skrevet med store bokstaver
    const start = Math.max(0, m.index - 160);
    const ctx = text.slice(start, m.index + m[0].length + 120).replace(/\s+/g, ' ');
    // Bannere står tett: bruk tallet som står nærmest koden
    const codeAt = ctx.indexOf(m[1]);
    // Tekst etter koden hører ofte til neste banner, så avstand etter koden teller dobbelt
    const dist = (x) => (x.index < codeAt ? codeAt - x.index : 2 * (x.index - codeAt));
    const nearest = (re) => {
      let best = null;
      for (const x of ctx.matchAll(re)) if (!best || dist(x) < dist(best)) best = x;
      return best;
    };
    let pct = nearest(/(\d{1,2})\s?%/g);
    let amt = nearest(/(\d{2,4})\s?(?:kr|,-)\s*(?:i\s+)?(?:rabatt|avslag|off)/gi) || nearest(/(?:spar|rabatt p(?:å|a))\s*(\d{2,4})\s?kr/gi);
    if (pct && amt) {
      if (dist(pct) < dist(amt)) amt = null;
      else pct = null;
    }
    const min = ctx.match(/(?:ved kj(?:ø|o)p|kj(?:ø|o)p|handler|ordre|bestilling)\s*(?:for\s*)?(?:over|fra|p(?:å|a))?\s*(?:minst\s*)?(\d{3,5})\s?(?:kr|,-)/i);
    const scope = (SCOPES.find(([, r]) => r.test(ctx)) || ['alle'])[0];
    // Vilkår står ofte lenger ned: gyldighet, om nedsatte varer er med, unntak
    const terms = text.slice(m.index, m.index + 700).replace(/\s+/g, ' ');
    const until = terms.match(/t\.?\s?o\.?\s?m\.?\s*(\d{1,2})[./](\d{1,2})(?:[.\/-](\d{2,4}))?/i);
    let validUntil = null;
    if (until) {
      const y = until[3] ? (until[3].length === 2 ? 2000 + Number(until[3]) : Number(until[3])) : new Date().getFullYear();
      validUntil = new Date(Date.UTC(y, Number(until[2]) - 1, Number(until[1]), 22, 59)).toISOString();
    }
    codes.push({
      code,
      type: pct ? 'percent' : amt ? 'amount' : 'unknown',
      value: pct ? Number(pct[1]) : amt ? Number(amt[1]) : null,
      minOrder: min ? Number(min[1]) : 0,
      scope,
      appliesToSale: /gjelder (?:ogs(?:å|a) )?(?:p(?:å|a) )?(?:allerede )?nedsatte/i.test(terms),
      excludesDrinks: /drikkekategori|ikke brukes p(?:å|a)[^.]{0,60}drikke/i.test(terms),
      validUntil,
      text: ctx.trim(),
    });
  }
  const now = Date.now();
  const uniq = [];
  for (const c of codes) {
    if (c.validUntil && Date.parse(c.validUntil) < now) continue; // utløpt
    const prev = uniq.find((u) => u.code === c.code);
    if (!prev) uniq.push(c);
    else if (prev.type === 'unknown' && c.type !== 'unknown') Object.assign(prev, c);
  }
  const ship = [...text.matchAll(/(?:fri|gratis)\s+frakt\s+(?:ved\s+kj(?:ø|o)p\s+)?(?:over|fra)\s*(\d{3,4})/gi)].map((x) => Number(x[1]));
  return { codes: uniq, freeShippingBanner: ship.length ? Math.min(...ship) : null };
}

export async function scanPromos(shop, ctx) {
  // Butikkens egen rabattkode-side først (den har fullstendige vilkår), så forsiden
  const pages = [...(shop.promoPages || []), '/'];
  const texts = [];
  for (const p of pages) {
    const html = await ctx.text(shop.url + p);
    if (!html) continue;
    // Ta med attributtverdier (title/alt) fordi noen bannere bare har tekst i bilder.
    const extra = [...html.matchAll(/(?:alt|title|aria-label)="([^"]{8,200})"/g)].map((m) => m[1]).join('\n');
    texts.push(`${stripHtml(html)}\n${extra}`);
  }
  if (!texts.length) return null;
  return { ...parsePromos(texts.join('\n')), checkedAt: new Date().toISOString() };
}

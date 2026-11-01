// Felles hjelpefunksjoner. Ingen avhengigheter, så alt kjører både i Node og i nettleseren.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', eacute: 'é', egrave: 'è',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', reg: '®', trade: '™',
  deg: '°', micro: 'µ', times: '×', frac12: '½', hellip: '…', bull: '•', euro: '€',
};

export function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+[0-9]*);/gi, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
}

export function stripHtml(html) {
  if (!html) return '';
  return decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// "1 299,00 kr" / "1299,-" / "499.00" / 49900 (minor units) -> 1299 / 499
export function parsePrice(v, minorUnit = 0) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return minorUnit ? v / 10 ** minorUnit : v;
  let s = String(v).replace(/[^\d,.\-]/g, '').replace(/,-$/, '').replace(/-$/, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, ''); // "1.169" = 1169 kr
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return minorUnit ? n / 10 ** minorUnit : n;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kjører fn over items med begrenset samtidighet.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch (e) {
        out[idx] = undefined;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

export function absUrl(href, base) {
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return null;
  }
}

export function uniqBy(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function jsonLdBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ugyldig JSON-LD ignoreres */
    }
  }
  return out;
}

export function findLdProduct(html) {
  const walk = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (Array.isArray(o)) {
      for (const x of o) {
        const r = walk(x);
        if (r) return r;
      }
      return null;
    }
    const t = o['@type'];
    if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return o;
    for (const k of ['@graph', 'mainEntity', 'itemListElement']) {
      const r = walk(o[k]);
      if (r) return r;
    }
    return null;
  };
  for (const b of jsonLdBlocks(html)) {
    const p = walk(b);
    if (p) return p;
  }
  return null;
}

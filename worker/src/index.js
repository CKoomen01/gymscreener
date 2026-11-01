// Gymscreener-proxy (Cloudflare Worker).
// Nettleseren kan ikke hente sider fra andre butikker direkte (CORS), så nettsiden ber denne
// proxyen hente dem. Den henter BARE fra butikkene i listen under, og mellomlagrer svar i 5 min.

const ALLOWED_HOSTS = [
  'www.gymgrossisten.no',
  'www.proteinfabrikken.no',
  'www.bodylab.no',
  'www.extremefitness.no',
  'www.sportylab.no',
  'www.hcdealer.no',
  'apex.no',
  'www.tights.no',
  'www.xxl.no',
  'flexfit.no',
  'www.life.no',
  'sunkost.no',
  'helsekost.no',
  'go-on-shop.no',
];

// Bare disse nettsidene får bruke proxyen
const ALLOWED_ORIGINS = [/^https:\/\/ckoomen01\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Gymscreener/1.0 (prissammenligning)';

function cors(origin) {
  const ok = origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ckoomen01.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    const self = new URL(request.url);
    if (self.pathname === '/health') return new Response('ok', { headers: cors(origin) });

    const target = self.searchParams.get('url');
    let url;
    try {
      url = new URL(target);
    } catch {
      return new Response('Mangler gyldig ?url=', { status: 400, headers: cors(origin) });
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname)) {
      return new Response('Butikken er ikke på listen', { status: 403, headers: cors(origin) });
    }
    if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) {
      return new Response('Ikke tillatt', { status: 403, headers: cors(origin) });
    }
    // POST er bare tillatt mot Sunkost sitt GraphQL-API (brukes for å lese produkter)
    const isPost = request.method === 'POST';
    if (isPost && !(url.hostname === 'sunkost.no' && url.pathname === '/graphql')) {
      return new Response('POST ikke tillatt', { status: 405, headers: cors(origin) });
    }

    const body = isPost ? await request.text() : undefined;
    const cacheKey = new Request(`https://cache.gymscreener/${encodeURIComponent(url.toString())}${isPost ? `#${await hash(body)}` : ''}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const r = new Response(hit.body, hit);
      Object.entries(cors(origin)).forEach(([k, v]) => r.headers.set(k, v));
      r.headers.set('X-Cache', 'HIT');
      return r;
    }

    const upstream = await fetch(url.toString(), {
      method: isPost ? 'POST' : 'GET',
      headers: { 'User-Agent': UA, 'Accept-Language': 'nb-NO,nb;q=0.9', Accept: request.headers.get('Accept') || '*/*', ...(isPost ? { 'Content-Type': 'application/json' } : {}) },
      body,
      redirect: 'follow',
    });
    const headers = new Headers(cors(origin));
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=300');
    headers.set('X-Cache', 'MISS');
    const res = new Response(upstream.body, { status: upstream.status, headers });
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};

async function hash(s) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s || ''));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

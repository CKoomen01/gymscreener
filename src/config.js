// Adressen til Cloudflare Worker-proxyen (fylles inn etter at den er satt opp).
// Kan også limes inn under «Innstillinger» på nettsiden uten ny publisering.
export const PROXY_URL = 'https://gymscreener-proxy.corneliskoomen.workers.dev';

export const DATA_URL = `${import.meta.env.BASE_URL}data/products.json`;
export const HISTORY_URL = `${import.meta.env.BASE_URL}data/history.json`;

// Hvor mange av de øverste treffene som oppdateres live, og hvor lenge en live-pris regnes som fersk
export const LIVE_TOP_N = 15;
export const LIVE_TTL_MS = 10 * 60 * 1000;

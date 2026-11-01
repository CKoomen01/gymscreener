// Butikkvilkår hentet fra butikkenes egne sider (sist sjekket 2026-11-01).
// Frakt: `free` = gratis frakt fra og med beløp (null = aldri gratis).
// `cheapest` / `home` = pris under grensen for billigste leveringsmåte / hjemlevering.
// `tiers` brukes der frakten har flere trinn uten gratisgrense.
// null = ikke oppgitt av butikken (vises i kassen). Skanneren prøver å fylle inn dette automatisk.
// Kampanjekoder og fraktgrenser fra bannere hentes også live fra forsiden (se scrapers/promos.js).

export const SHOPS = {
  gymgrossisten: {
    name: 'Gymgrossisten',
    url: 'https://www.gymgrossisten.no',
    platform: 'sfcc',
    shipsFrom: 'Lager i Sverige, fortolles av butikken (ingen toll for deg)',
    shipping: { free: 799, cheapest: 69, home: null, cheapestLabel: 'Standard i kassen (sjekket 2026-11-01)', homeLabel: 'Bring hjemlevering' },
    promoPages: ['/rabattkoder.html'],
    membership: {
      name: 'Club Gymgrossisten',
      free: true,
      pointsPct: 2,
      desc: '1 kr = 1 poeng, 1 250 poeng = 25 kr bonussjekk (ca. 2 %). Dobbelpoeng på utvalgte kampanjer.',
      url: 'https://www.gymgrossisten.no/medlemspris-no.html',
    },
    firstPurchase: null,
    perks: [
      {
        id: 'studentkortet',
        name: 'Studentrabatt (Studentkortet)',
        pct: 10,
        stack: false,
        excludesSale: false,
        exclude: 'barebells|nocco|celsius|big ?buy|sbd|concept ?2|gavekort|julekalender',
        excludesOutlet: true,
        desc: '10 % med kode fra Studentkortet (gratis medlemskap, koden står i Studentkortet-appen). Gjelder også nedsatte varer. Kan ikke kombineres med andre koder. Unntatt: Barebells, Nocco, Celsius, BigBuy, SBD, Concept2 og outlet.',
        url: 'https://www.studentkortet.no/rabatter/velvaere/trening-friluft/gymgrossisten',
      },
    ],
    combineCodes: false,
    termsUrl: 'https://www.gymgrossisten.no/leveringsvilkar.html',
  },
  proteinfabrikken: {
    name: 'Proteinfabrikken',
    url: 'https://www.proteinfabrikken.no',
    platform: 'sfcc',
    shipsFrom: 'Lager i Sverige, fortolles av butikken (ingen toll for deg)',
    shipping: { free: 800, cheapest: 69, home: null, cheapestLabel: 'Standard i kassen (sjekket 2026-11-01)', homeLabel: 'Bring hjemlevering' },
    promoPages: ['/rabattkoder.html'],
    membership: {
      name: 'Proteinfabrikken kundeklubb',
      free: true,
      pointsPct: 0,
      desc: 'Gratis. Medlemspriser og eksklusive tilbud (vises på produktene når de finnes).',
      url: 'https://www.proteinfabrikken.no/medlemsvilkar.html',
    },
    firstPurchase: null,
    perks: [
      {
        id: 'studentkortet',
        name: 'Studentrabatt (Studentkortet)',
        pct: 10,
        stack: false,
        excludesSale: false,
        exclude: 'barebells|nocco|celsius|big ?buy|sbd|concept ?2',
        excludesOutlet: true,
        desc: '10 % med kode fra Studentkortet (gratis medlemskap, koden står i Studentkortet-appen). Gjelder også nedsatte varer. Kan ikke kombineres med andre koder. Unntatt: Barebells, Nocco, Celsius, BigBuy, SBD, Concept2 og outlet.',
        url: 'https://www.studentkortet.no/rabatter/velvaere/trening-friluft/proteinfabrikken',
      },
    ],
    combineCodes: false,
    termsUrl: 'https://www.proteinfabrikken.no/leveringsvilkar.html',
  },
  bodylab: {
    name: 'Bodylab',
    url: 'https://www.bodylab.no',
    platform: 'shopware',
    shipsFrom: 'Lager i Danmark',
    shipping: { free: 499, cheapest: 59, home: 99, homeOver: 69, cheapestLabel: 'HeltHjem / Post i butikk', homeLabel: 'Bring hjemlevering' },
    membership: null,
    firstPurchase: null,
    perks: [
      {
        id: 'studentkortet',
        name: 'Studentrabatt (Studentkortet)',
        pct: 15,
        stack: false,
        excludesSale: true,
        desc: '15 % med kode fra Studentkortet (gratis medlemskap, koden står i Studentkortet-appen). Gjelder ikke nedsatte varer. Kan ikke kombineres med andre koder.',
        url: 'https://www.studentkortet.no/rabatter/velvaere/trening-friluft/bodylab',
      },
    ],
    combineCodes: false,
    termsUrl: 'https://www.bodylab.no/kundeservice/frakt',
  },
  extremefitness: {
    name: 'Extreme Fitness',
    url: 'https://www.extremefitness.no',
    platform: 'mystore',
    shipsFrom: 'Norge (Trondheim)',
    shipping: { free: null, tiers: [[0, 124], [999, 69]], cheapestLabel: 'PostNord hentested/pakkeautomat', homeLabel: 'Ingen hjemlevering' },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://www.extremefitness.no/pages/frakt',
  },
  sportylab: {
    name: 'Sportylab',
    url: 'https://www.sportylab.no',
    platform: 'woo',
    shipsFrom: 'Norge (Vestfold)',
    shipping: { free: 899, cheapest: 79, home: 189, cheapestLabel: 'Postkasse', homeLabel: 'PostNord hjemlevering' },
    membership: {
      name: 'Sportylab Rewards',
      free: true,
      pointsPct: 2,
      desc: '1 poeng per kr, 1 000 poeng = 20 kr (2 %). Medlemstilbud 20–40 % på utvalgte varer.',
      url: 'https://www.sportylab.no/rewards/',
    },
    firstPurchase: { pct: 10, desc: '10 % på første kjøp ved påmelding til nyhetsbrev. Gjelder ikke kampanjevarer.', excludesSale: true, url: 'https://www.sportylab.no' },
    combineCodes: false,
    termsUrl: 'https://www.sportylab.no/frakt-og-leveringsinformasjon/',
  },
  hcdealer: {
    name: 'Hardcore Dealer',
    url: 'https://www.hcdealer.no',
    platform: 'mystore',
    shipsFrom: 'Norge (Kristiansand)',
    shipping: { free: 500, cheapest: 59, home: 59, cheapestLabel: 'Posten/Bring', homeLabel: 'Posten/Bring' },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://www.hcdealer.no/pages/shipping',
  },
  apex: {
    name: 'Apex',
    url: 'https://apex.no',
    platform: 'woo',
    shipsFrom: 'Norge (Lørenskog)',
    shipping: { free: 799, cheapest: 99, home: 99, cheapestLabel: 'Posten/PostNord', homeLabel: 'Posten/PostNord' },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://apex.no/frakt-og-levering/',
  },
  tights: {
    name: 'Tights.no',
    url: 'https://www.tights.no',
    platform: 'woo',
    shipsFrom: 'Norge',
    shipping: { free: 999, cheapest: null, home: null, cheapestLabel: 'PostNord/Instabox', homeLabel: 'Hjemlevering' },
    membership: {
      name: 'tights club',
      free: true,
      pointsPct: 0,
      desc: 'Gratis. Medlemspris på merkede produkter (vises bare når du er logget inn, så den kan ikke hentes automatisk).',
      url: 'https://www.tights.no/kampanje/tightsclub/',
    },
    firstPurchase: null,
    // Ekstra rabatter knyttet til kontoen din. stack: kommer i tillegg til kampanjepriser og koder.
    perks: [
      {
        id: 'student',
        name: 'Studentrabatt',
        pct: 5,
        stack: true,
        desc: '5 % ekstra studentrabatt på alle ordrer (aktiveres under «Min konto»).',
        url: 'https://www.tights.no/studentrabatt/',
      },
    ],
    combineCodes: false,
    termsUrl: 'https://www.tights.no/kundeservice/frakt-og-leveranse/',
  },
  xxl: {
    name: 'XXL',
    url: 'https://www.xxl.no',
    platform: 'xxl',
    shipsFrom: 'Norge',
    shipping: { free: null, cheapest: null, home: null, cheapestLabel: 'Pakkeboks/postkasse', homeLabel: 'Hjem på døren' },
    membership: {
      name: 'XXL Reward',
      free: true,
      pointsPct: 2.5,
      desc: 'Gratis. 1 poeng per kr, 1 200 poeng = 30 kr (2,5 %). Medlemspriser 20–40 % på utvalgte varer.',
      url: 'https://www.xxl.no/reward',
    },
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://www.xxl.no/kundeservice/frakt-og-levering',
  },
  flexfit: {
    name: 'Flexfit',
    url: 'https://flexfit.no',
    platform: 'shopify',
    shipsFrom: 'Norge (Stokke)',
    shipping: { free: 1200, cheapest: 69, home: 69, cheapestLabel: 'Pakke i postkassen (maks 1 kg)', homeLabel: 'Pakke i postkassen', cheapestMaxKg: 1, overweight: 89 },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://flexfit.no/policies/shipping-policy',
  },
  life: {
    name: 'Life',
    url: 'https://www.life.no',
    platform: 'life',
    shipsFrom: 'Norge',
    shipping: { free: 299, cheapest: 49, home: 49, cheapestLabel: 'Hentested/Helthjem', homeLabel: 'Helthjem hjemlevering' },
    membership: {
      name: 'Life Club',
      free: true,
      pointsPct: 0,
      desc: 'Gratis. Medlemspriser på nett og bonuspoeng.',
      url: 'https://www.life.no',
    },
    firstPurchase: {
      pct: 10,
      desc: '10 % på ett kjøp for nye Life Club-medlemmer (gyldig 3 mnd). Kan ikke kombineres med andre tilbud.',
      excludesSale: true,
      requiresMembership: true,
      url: 'https://www.life.no',
    },
    combineCodes: false,
    termsUrl: 'https://www.life.no/kundeservice/ofte-stilte-sporsmal',
  },
  sunkost: {
    name: 'Sunkost',
    url: 'https://sunkost.no',
    platform: 'magento',
    shipsFrom: 'Norge',
    shipping: { free: 299, cheapest: 49, home: 49, cheapestLabel: 'Helthjem postkasse (under 5 kg)', homeLabel: 'Helthjem postkasse' },
    membership: {
      name: 'Sunkost kundeklubb',
      free: true,
      pointsPct: 0,
      desc: 'Gratis. Medlemspriser på utvalgte varer og «hver 6. gratis».',
      url: 'https://sunkost.no/kundeklubb',
    },
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://sunkost.no/kundeservice/frakt-levering',
  },
  helsekost: {
    name: 'Helsekost.no',
    url: 'https://helsekost.no',
    platform: 'shopify',
    shipsFrom: 'Norge',
    shipping: { free: 499, cheapest: null, home: null, cheapestLabel: 'Bring/PostNord hentested', homeLabel: 'Hjemlevering' },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://helsekost.no/policies/shipping-policy',
  },
  goonshop: {
    name: 'Go On Shop',
    url: 'https://go-on-shop.no',
    platform: 'shopify',
    shipsFrom: 'Norge',
    shipping: { free: 999, cheapest: null, home: null, cheapestLabel: 'Hentested', homeLabel: 'Hjemlevering' },
    membership: null,
    firstPurchase: null,
    combineCodes: false,
    termsUrl: 'https://go-on-shop.no/policies/shipping-policy',
  },
};

export const SHOP_IDS = Object.keys(SHOPS);

export const SHOP_HOSTS = Object.fromEntries(
  SHOP_IDS.map((id) => [new URL(SHOPS[id].url).hostname.replace(/^www\./, ''), id])
);

// Fraktpris for en ordre. mode: 'cheapest' | 'home'. Returnerer null hvis ukjent.
export function shippingCost(shop, subtotal, mode = 'cheapest', weightKg = 0, override) {
  const s = { ...shop.shipping, ...(override || {}) };
  if (s.tiers) {
    let p = null;
    for (const [from, price] of s.tiers) if (subtotal >= from) p = price;
    return p;
  }
  if (s.free !== null && s.free !== undefined && subtotal >= s.free) {
    if (mode === 'home' && s.homeOver) return s.homeOver;
    return 0;
  }
  let p = mode === 'home' ? s.home : s.cheapest;
  if (p !== null && p !== undefined && s.cheapestMaxKg && weightKg > s.cheapestMaxKg && s.overweight) p = s.overweight;
  return p ?? null;
}

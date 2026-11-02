// Gjør rådata fra skraperne om til sammenlignbare produkter:
// kategori, nettovekt, proteininnhold, aktiv mengde (kreatin), dagsdoser, smaksgrupper og matchnøkkel.

export const CATEGORIES = {
  protein: { label: 'Proteinpulver', unit: 'kg' },
  kreatin: { label: 'Kreatin', unit: 'kg' },
  pwo: { label: 'Pre-workout', unit: 'kg' },
  aminosyrer: { label: 'Aminosyrer', unit: 'kg' },
  gainer: { label: 'Gainer', unit: 'kg' },
  barer: { label: 'Proteinbarer', unit: 'stk' },
  drikke: { label: 'Proteindrikke', unit: 'stk' },
  vitaminer: { label: 'Vitaminer og helse', unit: 'dose' },
};

export const SUBCATEGORIES = {
  protein: { whey: 'Whey (myse)', isolat: 'Isolat / clear whey', kasein: 'Kasein', vegan: 'Vegansk', blandet: 'Blandet / annet' },
  kreatin: { monohydrat: 'Monohydrat (pulver)', kapsler: 'Kapsler / tabletter', gummies: 'Gummies', annet: 'Andre former' },
  pwo: { koffein: 'Med koffein', koffeinfri: 'Koffeinfri', ukjent: 'Ikke oppgitt' },
  aminosyrer: { eaa: 'EAA', bcaa: 'BCAA', betaalanin: 'Beta-alanin', citrullin: 'Citrullin / arginin', glutamin: 'Glutamin', annet: 'Andre' },
  gainer: { gainer: 'Gainer', karbo: 'Karbohydrater' },
  barer: { protein: 'Proteinbar' },
  drikke: { protein: 'Proteindrikk' },
  vitaminer: { multi: 'Multivitamin', d: 'D-vitamin', omega3: 'Omega-3', magnesium: 'Magnesium', sink: 'Sink / ZMA', c: 'C-vitamin', b: 'B-vitamin', elektrolytter: 'Elektrolytter', jern: 'Jern', kalsium: 'Kalsium', kollagen: 'Kollagen', annet: 'Annet' },
};

export const FLAVOR_GROUPS = [
  ['Sjokolade', /sjokolade|chocolate|choco|kakao|cocoa|brownie|nougat|mørk sjokk/i],
  ['Vanilje', /vanilj|vanilla|vanille/i],
  ['Jordbær', /jordb(æ|ae)r|strawberr/i],
  ['Bringebær', /bringeb(æ|ae)r|raspberr|rasp\b/i],
  ['Banan', /banan/i],
  ['Karamell', /karamell|caramel|toffee|butterscotch|dulce/i],
  ['Kake / cookie', /cookie|kake|cake|kjeks|biscuit|brownie|cheesecake|muffin|wafer|cinnamon|kanel|churro|donut|pannekake/i],
  ['Kaffe', /kaffe|coffee|mocha|latte|espresso|cappuccino/i],
  ['Nøtt', /pean(ø|o)tt|peanut|hasseln(ø|o)tt|hazelnut|n(ø|o)tt|nut\b|nutella|pistasj|pistachio|mandel|almond|kokos|coconut/i],
  ['Sitrus', /sitron|lemon|lime|appelsin|orange|grapefrukt|citrus|yuzu/i],
  ['Tropisk', /tropisk|tropical|mango|pasjon|passion|ananas|pineapple|papaya|guava|kiwi/i],
  ['Bær', /(?<!jord|bringe)b(æ|ae)r\b|(?<!rasp|straw)berry|(?<!rasp|straw)berries|bl(å|a)b(æ|ae)r|blueberr|skogsb|kirseb|cherry|tyttebær|cranberr|solbær|blackcurrant|currant|acai/i],
  ['Annen frukt', /eple|apple|p(æ|ae)re|pear|fersken|peach|vannmelon|watermelon|melon|drue|grape|plomme|aprikos|rabarbra/i],
  ['Brus / godteri', /\bcola\b|\bbrus\b|\bsoda\b|\biste\b|ice ?tea|\benergy\b|candy|godteri|\bgummy\b|bubblegum|tyggis|\bsour\b|skittles|rainbow|unicorn|lollipop|sukkerspinn|red bull|\bpunch\b|blue ?raz|\brazz/i],
  ['Kremet / dessert', /yoghurt|yogurt|fl(ø|o)te|\bcream\b|\bkrem\b|milkshake|\bis\b|ice ?cream|pudding|tiramisu|marshmallow|skumnisse|white choc|hvit sjok/i],
  ['Naturell / uten smak', /naturell|\bnatural\b|\bneutral\b|n(ø|o)ytral|unflavou?red|uten smak|smaksn(ø|o)ytral|\bplain\b|\bunflavored\b/i],
];

export function flavorGroups(label) {
  if (!label) return [];
  const g = FLAVOR_GROUPS.filter(([, re]) => re.test(label)).map(([n]) => n);
  return g.length ? g : ['Annen smak'];
}

const num = (s) => Number(String(s).replace(',', '.'));

// Nettovekt i gram for én pakke. Håndterer "3 x 1 kg", "12x55g", "1,8 kg", "4 lbs".
export function parseWeight(text) {
  if (!text) return null;
  const t = String(text).replace(/ /g, ' ');
  let m = t.match(/(\d{1,3})\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gram)\b/i);
  if (m) return Math.round(num(m[1]) * num(m[2]) * (/kg/i.test(m[3]) ? 1000 : 1));
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram)\s*[x×*]\s*(\d{1,3})\b/i);
  if (m) return Math.round(num(m[3]) * num(m[1]) * (/kg/i.test(m[2]) ? 1000 : 1));
  // Pakker: "4 x Whey-80 Myseprotein 1 kg", "15 x Proteinbar 50 g"
  m = t.match(/(?:^|[\s:&])(\d{1,2})\s*[x×]\s+.{0,60}?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|gram)\b/i);
  if (m) return Math.round(num(m[1]) * num(m[2]) * (/kg/i.test(m[3]) ? 1000 : 1));
  const all = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|gram|lbs?)\b/gi)];
  for (const a of all) {
    const v = num(a[1]);
    const u = a[2].toLowerCase();
    const g = u === 'kg' ? v * 1000 : u.startsWith('lb') ? v * 453.6 : v;
    if (g >= 20 && g <= 25000) return Math.round(g);
  }
  return null;
}

export function parseVolume(text) {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)\b/i);
  if (!m) return null;
  const v = num(m[1]);
  return Math.round(m[2].toLowerCase() === 'l' ? v * 1000 : m[2].toLowerCase() === 'dl' ? v * 100 : m[2].toLowerCase() === 'cl' ? v * 10 : v);
}

const COUNT_RE = /(\d{1,4})\s*(?:stk\.?|-?pack|-?pk|pakk?|kapsler|kaps\.?|caps(?:ules)?|kapsel|tabletter|tabl?\.?|tabs|softgels?|gummies|gummier|tyggetabletter|vegikapsler|vegicaps|sticks|shots|bokser|flasker|brett|barer|bars)\b/i;

export function parseCount(text) {
  const t = String(text || '');
  let m = t.match(/(\d{1,3})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(g|ml|cl)\b/i) || t.match(/(?:^|[\s:&])(\d{1,2})\s*[x×]\s+.{0,40}?\d+(?:[.,]\d+)?\s*(g|ml|cl)\b/i);
  if (m) return { count: Number(m[1]), unit: 'stk' };
  m = t.match(COUNT_RE);
  if (m) {
    const w = m[0].toLowerCase();
    const unit = /kaps|caps/.test(w) ? 'kapsler' : /tab/.test(w) ? 'tabletter' : /softgel/.test(w) ? 'softgels' : /gumm/.test(w) ? 'gummies' : 'stk';
    return { count: Number(m[1]), unit };
  }
  return null;
}

const EXCLUDE = /shaker|flaske|bottle|t-?skjorte|hoodie|\btights\b|shorts|singlet|\bbelte\b|straps|hansker|\bmatte\b|pannekake|pancake|pudding(?!.*protein ?pulver)|pean(ø|o)ttsm(ø|o)r|n(ø|o)ttesm(ø|o)r|\bspread\b|sirup|syrup|\bsaus\b|\bsauce\b|m(ü|u)sli|granola|\bchips\b|popcorn|nudler|\bpasta\b|\bgrøt\b|havregryn|frokostblanding|gavekort|kokebok|\bbok\b|sokker|\bkopp\b|\bboks\b|oppbevaring|pillbox|pilledosett|\bvekt\b(?!.*gainer)|rabattkort|bake ?mix|\bbaking\b|\bmel\b|peanut butter|\bkaffe\b(?!.*(protein|kreatin))|\bte\b|kombucha|smoothie|\bjuice\b|kokosvann|mineralvann|energidrikk(?!.*protein)|\bnocco\b|\bmonster\b|red bull|\bcelsius\b|powerade|sportsdrikk|smart ?shake|blender ?bottle|\bchalk\b|kokosmelk|coconut milk|havremelk|oat milk|\blotion\b|\bserum\b|sjampo|shampoo|tannkrem|deodorant|\bsåpe\b|bodylotion|freeze-?dried|tørket frukt|oatmeal|porridge|\bgrøt\b|pastill/i;

// Barer må ha protein i navnet, kategorien eller være fra et kjent proteinbar-merke
const PROTEIN_BAR_BRAND = /barebells|\bquest\b|grenade|warrior|propud|njie|fulfil|misfits|nupo|big 100|core bar|\bpf\b|wispy|oh yeah|\bone bar\b|carb killa|swebar|smartsupps|nutramino|star nutrition|bodylab|chiefs|built bar|vitaprana/;
// Sterke vitamin-/mineralord i navnet går foran butikkens kategori (f.eks. magnesium under «Aminosyrer»)
const VITAMIN_WORD = /magnesium|vitamin|omega|\bsink\b|zink|zinc|\bjern\b|iron\b|kalsium|calcium|\bd3\b|b12|multivit|elektrolytt|electrolyte|\bselen|selenium|krom\b|chromium|jod\b|iodine|kalium|potassium|folat|folin/;

function lower(...s) {
  return s.filter(Boolean).join(' ').toLowerCase();
}

export function classify(raw) {
  const name = lower(raw.name);
  const cat = lower(raw.shopCategory);
  const all = `${name} ${cat}`;
  if (EXCLUDE.test(name)) return null;
  const barWord = /\b(protein)?bar(er|s)?\b|proteinbar|protein bar|wafer|bites\b|crisp(?!y)|crunch|cookie\b(?!.*pulver)/.test(name) || (/barer|proteinbar/.test(cat) && !/pulver/.test(name));
  const isBar = barWord && (/protein|whey/.test(name) || /protein ?bar|proteinbarer/.test(cat) || PROTEIN_BAR_BRAND.test(`${name} ${lower(raw.brand)}`));
  if (barWord && !isBar && !/kreatin|creatine|vitamin/.test(name)) return null; // vanlige snacks/energibarer uten protein
  const vol = parseVolume(raw.name);
  // Pulver til shake ("500 g, proteinmilkshake") er ikke ferdigdrikke: drikker har volum (ml/l)
  const powderLike = parseWeight(raw.name) >= 200 && !vol;
  const isDrink = !powderLike && (/proteindrikk|protein ?drink|protein ?shake(?!.*pulver)|ready ?to ?drink|\brtd\b|proteinvann|protein water|clear protein soda|milkshake(?!.*pulver)|proteinmelk/.test(name) || (vol && vol < 2000 && /protein|whey|shake/.test(name) && !/pulver|powder/.test(name)) || /proteindrikk/.test(cat));
  if (isBar && !isDrink) return { cat: 'barer', sub: 'protein' };
  if (isDrink) return { cat: 'drikke', sub: 'protein' };
  // Merker som bare lager proteinbarer, der navnet ofte bare er smaken ("Barebells Salty Peanut")
  if (/barebells|swebar|fulfil|misfits|built bar/.test(name) && !vol && !/pulver|powder|spread/.test(name)) return { cat: 'barer', sub: 'protein' };
  if (/gainer|mass(?!asje)|weight ?gain|vekt(ø|o)kning/.test(all) && !/kreatin|creatine/.test(name)) return { cat: 'gainer', sub: 'gainer' };
  if (/pre[\s-]?workout|\bpwo\b|\bpre\b|\bpump\b|\bc4\b|n\.?o\.?[\s-]?xplode|preworkout/.test(name) || (/pwo|pre-?workout/.test(cat) && !/kreatin|creatine|bcaa|eaa|protein|whey|kollagen|collagen/.test(name))) {
    const sub = /koffeinfri|caffeine[\s-]?free|stim[\s-]?free|uten koffein|non[\s-]?stim|pump/.test(all) ? 'koffeinfri' : /koffein|caffeine|stim/.test(all) ? 'koffein' : 'ukjent';
    return { cat: 'pwo', sub };
  }
  if (/kreatin|creatin|creapure|kre-?alkalyn/.test(name) || (/kreatin/.test(cat) && !/protein|whey/.test(name))) {
    const sub = /gumm/.test(name) ? 'gummies' : /kaps|caps|tablett|tabs|tabl\b/.test(name) ? 'kapsler' : /monohydrat|monohydrate|creapure|micronized|mikronisert/.test(name) || /monohydrat/.test(cat) ? 'monohydrat' : 'annet';
    return { cat: 'kreatin', sub };
  }
  if (/\beaa\b|essential amino|essensielle/.test(name)) return { cat: 'aminosyrer', sub: 'eaa' };
  if (/\bbcaa\b/.test(name)) return { cat: 'aminosyrer', sub: 'bcaa' };
  if (/beta[\s-]?alanin/.test(name)) return { cat: 'aminosyrer', sub: 'betaalanin' };
  if (/citrullin|arginin|arginine/.test(name)) return { cat: 'aminosyrer', sub: 'citrullin' };
  if (/glutamin/.test(name)) return { cat: 'aminosyrer', sub: 'glutamin' };
  if (/aminosyre|amino acid|taurin|carnitin|karnitin|hmb\b|tyrosin|lysin|glycin|glycine/.test(name) || (/aminosyre|amino acid/.test(cat) && !VITAMIN_WORD.test(name) && !/protein|whey/.test(name))) return { cat: 'aminosyrer', sub: 'annet' };
  const isProtein = /protein|whey|myse|kasein|casein|isolat|isolate|\biso\b|clear whey/.test(name) || /proteinpulver|whey|kasein|myseprotein|vegansk protein|erteprotein|soyaprotein/.test(cat);
  if (isProtein && !/kollagen|collagen/.test(name)) {
    const sub = /kasein|casein|micellar|night/.test(name) || /kasein/.test(cat)
      ? 'kasein'
      : /vegan|ert(e)?protein|pea\b|pea protein|soya|soy\b|plante|plant|ris ?protein|rice protein|hamp|hemp|fava/.test(name) || /vegansk|erteprotein|soyaprotein/.test(cat)
        ? 'vegan'
        : /isolat|isolate|\biso\b|clear|hydrolys/.test(name)
          ? 'isolat'
          : /whey|myse/.test(name) || /whey|myse/.test(cat)
            ? 'whey'
            : 'blandet';
    return { cat: 'protein', sub };
  }
  // Karbohydrater avgjøres av navnet (Sunkost har f.eks. kollagen i kategorien «Proteiner/Karbohydrater»)
  if ((/karbohydrat|carbs?\b|cream of rice|rismel|maltodextrin|dextrin|vitargo|dextrose|energi ?gel|energy ?gel|\bgel\b|drink mix|carbo/.test(name) || (/druesukker/.test(name) && parseWeight(raw.name) >= 250)) && !/kollagen|collagen/.test(name)) return { cat: 'gainer', sub: 'karbo' };
  if (/druesukker/.test(name)) return null; // druesukker-godteri
  const v = (s, sub) => (s ? { cat: 'vitaminer', sub } : null);
  return (
    v(/omega|fiskeolje|fish ?oil|krill|tran\b|cod liver/.test(name), 'omega3') ||
    v(/multi ?vitamin|multivit|multi\b|daily vitamin|allround/.test(name), 'multi') ||
    v(/d[\s-]?vitamin|vitamin d|\bd3\b|d-?pearls/.test(name), 'd') ||
    v(/magnesium/.test(name), 'magnesium') ||
    v(/\bsink\b|zink|zinc|\bzma\b/.test(name), 'sink') ||
    v(/c[\s-]?vitamin|vitamin c|ester-?c/.test(name), 'c') ||
    v(/b[\s-]?vitamin|vitamin b|b12|b-?kompleks|b-?complex/.test(name), 'b') ||
    v(/elektrolytt|electrolyte|hydration|salt ?tab|lmnt/.test(name), 'elektrolytter') ||
    v(/\bjern\b|iron/.test(name), 'jern') ||
    v(/kalsium|calcium/.test(name), 'kalsium') ||
    v(/kollagen|collagen/.test(name), 'kollagen') ||
    v(/vitamin|mineral/.test(all) && !/drikke/.test(name), 'annet')
  );
}

// Protein per 100 g fra næringstabell eller beskrivelse. null hvis ukjent.
export function proteinPer100(text, nutritionText) {
  const sources = [nutritionText, text].filter(Boolean);
  for (const src of sources) {
    const t = src.replace(/ /g, ' ');
    // 1) Næringstabell: "Protein 75 g 34 g"
    // Mellom "Protein" og tallet tillates bare skilletegn (tabellceller blir " | " eller linjeskift)
    const re = /(?:^|[\s|])protein(?:er)?\b[^\da-zæøå]{0,30}?(\d{1,2}(?:[.,]\d+)?)\s*g\b(?:[^\da-zæøå]{0,30}(\d{1,2}(?:[.,]\d+)?)\s*g\b)?/gi;
    let m;
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 500), m.index).toLowerCase();
      const i100 = before.lastIndexOf('100');
      // Porsjonskolonne: "porsjon", "scoop" eller "per 45 g" (alt annet enn 100)
      const porRe = /porsjon|servering|scoop|serving|(?:per|pr\.?)\s*(\d+)\s*(?:g|ml)\b/g;
      let iPor = -1;
      for (const pm of before.matchAll(porRe)) if (pm[1] !== '100') iPor = pm.index;
      const hasHeader = /100\s?(g|ml)|pr\.?\s?100|per 100/.test(before);
      if (!hasHeader) continue;
      // Står porsjonskolonnen før 100 g-kolonnen, er det andre tallet per 100 g.
      const v = m[2] && iPor >= 0 && iPor < i100 ? num(m[2]) : num(m[1]);
      if (v >= 15 && v <= 98) return Math.round(v * 10) / 10;
    }
    // 2) "25 g protein per porsjon (30 g)"
    const per = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*g(?:ram)?\s+(?:med\s+)?protein(?:er)?\s+(?:per|pr\.?|i hver|i en)\s+(?:porsjon|scoop|serving|servering|shake|dose)\s*(?:\(|på|a|à|=)?\s*(\d{2,3}(?:[.,]\d+)?)\s*g/i);
    if (per) {
      const v = (num(per[1]) / num(per[2])) * 100;
      if (v >= 15 && v <= 98) return Math.round(v * 10) / 10;
    }
    const pct = t.match(/(?:inneholder|opptil|hele|med|gir)?\s*(\d{2})\s?%\s*protein/i);
    if (pct) {
      const v = Number(pct[1]);
      if (v >= 30 && v <= 98) return v;
    }
  }
  return null;
}

// Protein per stk (bar/drikk)
export function proteinPerUnit(text, name) {
  const t = `${name || ''}\n${text || ''}`;
  const m = t.match(/(\d{1,2}(?:[.,]\d)?)\s*g(?:ram)?\s+(?:med\s+)?protein/i) || t.match(/protein[^\d\n]{0,12}(\d{1,2}(?:[.,]\d)?)\s*g\b/i);
  if (m) {
    const v = num(m[1]);
    if (v >= 3 && v <= 60) return v;
  }
  return null;
}

// Aktiv kreatin i gram per pakke
export function creatineGrams(raw, sub, grams, count) {
  const t = `${raw.name}\n${raw.text || ''}`.replace(/ /g, ' ');
  if (sub === 'monohydrat' && grams && !/blanding|matrix|complex|kompleks|stack|\+|with|med (beta|taurin|elektrolytt)/i.test(raw.name)) return grams;
  if (count) {
    let m = t.match(/(\d{3,4})\s*mg\s+(?:kreatin|creatin|creapure)[^.\n]{0,30}?(?:per|pr\.?|i hver|i en)\s+(?:kapsel|tablett|gummy|gummie|tab|caps)/i) || t.match(/(?:per|pr\.?|hver)\s+(?:kapsel|tablett|gummy|tab)\D{0,40}?(\d{3,4})\s*mg\s+(?:kreatin|creatin)/i);
    if (m) return (count * Number(m[1])) / 1000;
    m = t.match(/(\d(?:[.,]\d+)?)\s*(g|mg)\s+(?:kreatin|creatin|creapure|kreatinmonohydrat)\w*\s+(?:per|pr\.?|i)\s+(?:dagsdose|porsjon|dose|serving)\s*\(?\s*(?:=|tilsvarer)?\s*(\d{1,2})\s*(?:kapsler|tabletter|gummies|stk|tabs|caps)/i);
    if (m) {
      const g = num(m[1]) / (m[2].toLowerCase() === 'mg' ? 1000 : 1);
      return (count / Number(m[3])) * g;
    }
  }
  if (grams) {
    const m = t.match(/(\d(?:[.,]\d+)?)\s*g\s+(?:kreatin|creatin|creapure)\w*\s+(?:per|pr\.?|i hver)\s+(?:porsjon|scoop|dose|serving)\s*\(?\s*(\d{1,2}(?:[.,]\d+)?)\s*g/i);
    if (m) return (num(m[1]) / num(m[2])) * grams;
  }
  return null;
}

// Antall dagsdoser for vitaminer/helse
export function dailyDoses(raw, count) {
  if (!count) return null;
  const t = `${raw.text || ''}`.toLowerCase();
  const m = t.match(/(\d{1,2}|en|ett|én|to|tre|fire)\s*(kapsel|kapsler|tablett|tabletter|softgel|softgels|tyggetablett|tyggetabletter|gummies|gummy|kaps)\s*(?:daglig|per dag|pr\.? dag|om dagen|hver dag|i døgnet|dagen)/);
  if (m) {
    const w = { en: 1, ett: 1, 'én': 1, to: 2, tre: 3, fire: 4 }[m[1]] ?? Number(m[1]);
    if (w > 0 && w < 15) return Math.floor(count / w);
  }
  if (/1 (kapsel|tablett) (daglig|om dagen|per dag)/.test(t)) return count;
  return null;
}

const SIZE_WORDS = /\b\d+(?:[.,]\d+)?\s*(kg|gr|g|gram|lbs?|ml|cl|l|stk|kapsler|caps|tabs|tabletter|softgels|porsjoner|servings|pack|pk)\b|\b\d+\s*[x×]\s*\d+\s*(g|ml)?\b/gi;
// Generiske ord som butikkene legger til eller utelater ("Whey-80 Myseprotein" = "Whey-80 proteinpulver")
const NOISE = /\b(proteinpulver|proteinbar|proteindrikk|myseprotein|wheyprotein|protein|kosttilskudd|kreatinmonohydrat|aminosyre|vitamin|kapsler|tabletter|pre-?workout-?pulver|pulver|powder|smak|flavou?r|ny|new|nyhet|kampanje|tilbud|outlet|kort dato|best før|med|with|and|og|the|for|fra|i|-|\|)\b/gi;

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a');
}

export function normBrand(b, name) {
  let s = slug(b || '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s === 'diverse' || s === 'ukjent') {
    const n = slug(name);
    const known = ['star nutrition', 'proteinfabrikken', 'bodylab', 'optimum nutrition', 'self omninutrition', 'olimp', 'scitec', 'myprotein', 'nutramino', 'per4m', 'applied nutrition', 'dymatize', 'mutant', 'ghost', 'barebells', 'swedish supplements', 'viterna', 'delta nutrition', 'chained nutrition', 'gasp', 'trec', 'biotech', 'weider', 'ostrovit', 'nupo', 'tights', 'bodyfuel', 'fuel of norway', 'nordic nutrition', 'maxim', 'enervit'];
    s = known.find((k) => n.includes(k)) || '';
  }
  return s.replace(/\b(nutrition|sports|sportsnutrition|supplements|as|ab|ltd|inc)\b/g, '').replace(/\s+/g, ' ').trim();
}

export function matchKey(brand, name, flavorWords, grams) {
  let n = slug(name).replace(SIZE_WORDS, ' ');
  for (const w of flavorWords) if (w) n = n.replace(new RegExp(slug(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
  for (const [, re] of FLAVOR_GROUPS) n = n.replace(new RegExp(re.source, 'gi'), ' ');
  const b = normBrand(brand, name);
  // Fjern alle ord fra merkenavnet (også «nutrition» o.l. som normBrand kutter)
  const brandWords = `${b} ${slug(brand || '')}`.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
  for (const bw of brandWords) if (bw.length > 2) n = n.replace(new RegExp(`\\b${bw}\\b`, 'g'), ' ');
  n = n.replace(/\b(nutrition|sports?nutrition|supplements)\b/g, ' ');
  const tokens = n.replace(NOISE, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 1);
  const uniq = [...new Set(tokens)].sort();
  return `${b}|${uniq.join(' ')}|${grams ? Math.round(grams / 50) * 50 : ''}`;
}

// Prøver å finne smaken i produktnavnet når butikken har én side per smak.
const PRODUCT_WORD = /\b(whey|protein\w*|isolat\w*|isolate|kasein|casein|kreatin\w*|creatine|creapure|monohydrat\w*|micronized|mikronisert|pwo|pre-?workout|bcaa|eaa|gainer|bar|barer|shake|clear|myse\w*|vegan|complex|blend|pulver|powder|drink|drikk)\b/gi;

export function flavorFromName(name) {
  const n = String(name || '').replace(SIZE_WORDS, ' ');
  if (!FLAVOR_GROUPS.some(([, re]) => re.test(n))) return null;
  const clean = (s) => s.replace(/[(),|]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^A-Za-zÆØÅæøå]+/, '').replace(/^x\s+/i, '');
  // 1) Del av navnet skilt med " - " eller komma som inneholder en smak
  const parts = n.split(/\s[-–|]\s|,\s/);
  const isProductWord = new RegExp(PRODUCT_WORD.source, 'i');
  const hit = parts.find((p) => FLAVOR_GROUPS.some(([, re]) => re.test(p)) && !isProductWord.test(p));
  if (hit && clean(hit)) return clean(hit);
  // 2) Ordene etter siste produktord ("Bodylab Clear Whey Raspberry Rush" -> "Raspberry Rush")
  const head = n.split(/,\s|\s[-–|]\s/)[0];
  let last = -1;
  for (const m of head.matchAll(PRODUCT_WORD)) last = m.index + m[0].length;
  if (last > 0) {
    const tail = clean(head.slice(last).split(/[(]/)[0]);
    if (tail && FLAVOR_GROUPS.some(([, re]) => re.test(tail))) return tail;
  }
  // 3) Hele ordene som inneholder en smak
  const words = n.split(/\s+/).filter((w) => FLAVOR_GROUPS.some(([, re]) => re.test(w)));
  return words.length ? clean(words.join(' ')) : null;
}

const FLAVORED = new Set(['protein', 'pwo', 'aminosyrer', 'gainer', 'barer', 'drikke', 'kreatin']);

// raw -> liste med normaliserte produkter (ett per pakningsstørrelse)
export function normalize(raw) {
  const cls = classify(raw);
  if (!cls) return [];
  const bySize = new Map();
  for (const v of raw.variants || []) {
    const key = v.size || '';
    if (!bySize.has(key)) bySize.set(key, []);
    bySize.get(key).push(v);
  }
  const out = [];
  for (const [size, allVars] of bySize) {
    let vars = allVars;
    // Shopifys «grams» er fraktvekt (med emballasje), ikke nettovekt, og brukes derfor ikke
    const gramsTotal = parseWeight(size) || parseWeight(raw.weightText) || parseWeight(raw.name);
    let cnt = parseCount(size) || parseCount(raw.name);
    let grams = gramsTotal;
    // «N x»-pakker (f.eks. gels) under 6 kr per stk er i praksis stykkpris: regn per stk
    if (cnt?.unit === 'stk' && cnt.count > 1 && !['barer', 'drikke'].includes(cls.cat) && Math.max(...vars.map((x) => x.price || 0)) / cnt.count < 6) {
      if (grams) grams = Math.round(grams / cnt.count);
      cnt = null;
    }
    // Sikkerhetssjekk: en bar/drikk under 6 kr per stk er nesten alltid stykkpris på en "N stk"-side
    if ((cls.cat === 'barer' || cls.cat === 'drikke') && cnt?.count > 1) {
      const perPiece = vars.filter((x) => x.price / cnt.count < 6);
      if (perPiece.length === vars.length) {
        if (grams) grams = Math.round(grams / cnt.count);
        cnt = null;
      } else if (perPiece.length) vars = vars.filter((x) => !perPiece.includes(x));
    }
    let sub = cls.sub;
    if (cls.cat === 'kreatin' && sub === 'annet' && cnt && /kaps|tabl/.test(cnt.unit)) sub = 'kapsler';
    const pp = ['protein', 'gainer'].includes(cls.cat) || (cls.cat === 'barer' || cls.cat === 'drikke') ? proteinPer100(raw.text, raw.nutritionText) : null;
    let pu = null;
    if (cls.cat === 'barer' || cls.cat === 'drikke') {
      const unitW = cnt?.count && grams ? grams / cnt.count : grams;
      pu = proteinPerUnit(raw.text, raw.name);
      if (!pu && pp && unitW) pu = Math.round(((pp * unitW) / 100) * 10) / 10;
    }
    const ag = cls.cat === 'kreatin' ? creatineGrams(raw, sub, grams, cnt?.count) : null;
    const dd = cls.cat === 'vitaminer' ? dailyDoses(raw, cnt?.count) : null;
    const nameFlavor = FLAVORED.has(cls.cat) ? flavorFromName(raw.name) : null;
    const v = vars.map((x) => {
      const f = x.flavor || nameFlavor;
      return {
        id: x.id,
        f: f || null,
        fg: f ? flavorGroups(f) : [],
        p: Math.round(x.price * 100) / 100,
        lp: x.listPrice ? Math.round(x.listPrice * 100) / 100 : null,
        mp: x.memberPrice ? Math.round(x.memberPrice * 100) / 100 : null,
        st: x.inStock ? 1 : 0,
        u: x.url && x.url !== raw.url ? x.url : null,
        x: x.expiry || null,
      };
    });
    out.push({
      k: `${raw.shop}:${raw.id}${size ? `:${size}` : ''}`,
      s: raw.shop,
      n: raw.name,
      b: raw.brand || null,
      u: raw.url,
      img: raw.image || null,
      c: cls.cat,
      sc: sub,
      g: grams,
      cnt: cnt?.count || null,
      cu: cnt?.unit || null,
      sz: size || null,
      pp,
      pu,
      ag: ag ? Math.round(ag * 10) / 10 : null,
      dd,
      sd: raw.shortDate || v.some((x) => x.x) ? 1 : 0,
      pr: raw.promoText || null,
      v,
      mk: matchKey(raw.brand, raw.name, vars.map((x) => x.flavor).concat(nameFlavor), grams || (cnt ? cnt.count : null)),
      r: raw.refresh,
    });
  }
  return out;
}

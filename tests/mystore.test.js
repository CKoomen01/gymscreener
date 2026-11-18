import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../scrapers/mystore.js';

const shop = { id: 'extremefitness', url: 'https://ef.test', crawlDelayMs: 0 };
const U = (s) => `https://ef.test/products/${s}`;
const page = (name, cat, price) => `
<script type="application/ld+json">{"@type":"Product","name":"${name}","sku":"${name}","offers":{"price":"${price}","availability":"https://schema.org/InStock"}}</script>
<input type="hidden" name="name" value="${name}"><input type="hidden" name="price" value="${price}"><input type="hidden" name="category" value="${cat}">
<div id="add2cart"></div>`;

// Falsk ctx: svar per URL (string = side, tall = HTTP-status uten innhold)
function ctxFor(responses, extra = {}) {
  const calls = [];
  let lastStatus = null;
  return {
    calls,
    log: () => {},
    text: async (url) => {
      calls.push(url);
      const r = responses[url];
      lastStatus = typeof r === 'string' ? 200 : r ?? 404;
      return typeof r === 'string' ? r : null;
    },
    get lastStatus() {
      return lastStatus;
    },
    ...extra,
  };
}

const sitemap = (...urls) => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;

test('Mystore: henter tilskudd, husker ikke-tilskudd og hopper over dem neste gang', async () => {
  const responses = {
    'https://ef.test/sitemap.xml': sitemap(U('kreatin-500g'), U('gasp-cap'), U('borte')),
    [U('kreatin-500g')]: page('Star Nutrition Creatine Monohydrate 500 g', 'Kreatin', 199),
    [U('gasp-cap')]: page('GASP Script Cap', 'Klær', 299),
    [U('borte')]: 404,
  };
  const ctx = ctxFor(responses);
  const res = await scan(shop, ctx);
  assert.equal(res.raws.length, 1);
  assert.equal(res.raws[0].variants[0].price, 199);
  assert.ok(res.crawl.skip[U('gasp-cap')]);
  assert.ok(res.crawl.skip[U('borte')]);
  assert.ok(res.crawl.fetched[U('kreatin-500g')]);

  // Neste skann: ikke-tilskuddene hentes ikke igjen
  const ctx2 = ctxFor(responses, { crawl: res.crawl });
  await scan(shop, ctx2);
  assert.deepEqual(ctx2.calls.filter((u) => u.includes('/products/')), [U('kreatin-500g')]);
});

test('Mystore: stopper ved blokkering og beholder forrige skann for sidene den ikke rakk', async () => {
  const responses = {
    'https://ef.test/sitemap.xml': sitemap(U('a'), U('b'), U('c'), U('d'), U('e')),
    // ingen produktsider svarer (status 0 = tidsavbrudd)
    [U('a')]: 0,
    [U('b')]: 0,
    [U('c')]: 0,
    [U('d')]: 0,
    [U('e')]: 0,
  };
  const previous = [{ s: 'extremefitness', k: 'extremefitness:a', u: U('a'), n: 'A' }, { s: 'extremefitness', k: 'extremefitness:e', u: U('e'), n: 'E' }];
  const ctx = ctxFor(responses, { previous });
  const res = await scan(shop, ctx);
  assert.equal(ctx.calls.filter((u) => u.includes('/products/')).length, 3); // stopper etter 3 feil på rad
  assert.deepEqual(res.keep.map((p) => p.n).sort(), ['A', 'E']);
  assert.equal(res.raws.length, 0);
});

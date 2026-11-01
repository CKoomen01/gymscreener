// Life (Norce/Jetshop Flight): produkt-URL-er fra sitemap, data fra Apollo-tilstanden på produktsiden.
import { stripHtml, decodeEntities, mapLimit } from '../core/util.js';

const KEEP = /life\.no\/(trening|kosttilskudd)\//;

export function apolloState(html) {
  const tag = 'window.__APOLLO_STATE__=JSON.parse(';
  const i = html.indexOf(tag);
  if (i < 0) return null;
  let j = i + tag.length + 1;
  while (j < html.length) {
    if (html[j] === '\\') {
      j += 2;
      continue;
    }
    if (html[j] === '"') break;
    j++;
  }
  try {
    return JSON.parse(JSON.parse(html.slice(i + tag.length, j + 1)));
  } catch {
    return null;
  }
}

const deref = (st, v) => (v && v.__ref ? st[v.__ref] : v);

export function parseProductPage(shop, url, html) {
  const st = apolloState(html);
  if (!st) return null;
  const pk = Object.keys(st).find((k) => k.startsWith('Product:'));
  const p = pk && st[pk];
  if (!p) return null;
  const stock = deref(st, p.stockStatus);
  const price = p.price?.incVat ?? null;
  const prev = p.previousPrice?.incVat ?? null;
  const member = p.hasMemberPrice ? p.memberPrice?.incVat ?? null : null;
  const variants = [];
  const vlist = p.variants?.values || p.variants || [];
  if (p.hasVariants && Array.isArray(vlist) && vlist.length) {
    for (const vr of vlist) {
      const v = deref(st, vr);
      const vs = deref(st, v?.stockStatus);
      const vp = v?.price?.incVat ?? price;
      variants.push({ id: v?.articleNumber || String(v?.id), flavor: (v?.values || []).join(' '), size: null, price: vp, listPrice: v?.previousPrice?.incVat > vp ? v.previousPrice.incVat : null, memberPrice: v?.hasMemberPrice ? v.memberPrice?.incVat : null, inStock: vs ? !!vs.buyable : true, url });
    }
  } else {
    variants.push({ id: p.articleNumber || String(p.id), flavor: null, size: null, price, listPrice: prev > price ? prev : null, memberPrice: member && member < price ? member : null, inStock: stock ? !!stock.buyable : false, url });
  }
  const cats = (p.categories || []).map((c) => deref(st, c.primaryRoute)?.path || c.primaryRoute?.path || '').filter(Boolean);
  const brandPath = cats.find((c) => c.startsWith('/varemerker/'));
  const brandName = brandPath ? brandPath.split('/')[2].replace(/-/g, ' ') : null;
  const fields = Object.fromEntries((p.customFields || []).map((f) => [f.key, f.value ?? f.items ?? '']));
  const spec = typeof fields.Product_Specification === 'string' ? stripHtml(fields.Product_Specification) : '';
  return {
    shop: shop.id,
    id: String(p.id),
    url,
    name: decodeEntities(p.name),
    brand: brandName,
    shopCategory: [p.canonicalCategory?.name, ...cats].filter(Boolean).join(' / '),
    image: null,
    text: stripHtml(`${p.shortDescription || ''}\n${p.description || ''}`),
    nutritionText: spec,
    weightText: typeof fields.Product_Size === 'string' ? fields.Product_Size : null,
    shortDate: /life-savers|kort dato/i.test(cats.join(' ')),
    variants: variants.filter((v) => v.price > 0),
    refresh: { kind: 'page', url },
  };
}

export async function scan(shop, ctx) {
  const idx = await ctx.text(`${shop.url}/googlesitemap.axd`);
  const maps = [...(idx || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1])).filter((u) => /SitemapType=products/.test(u));
  const urls = new Set();
  for (const sm of maps) {
    const xml = await ctx.text(sm);
    for (const m of (xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = decodeEntities(m[1]);
      if (KEEP.test(u)) urls.add(u);
    }
  }
  ctx.log(`${shop.id}: ${urls.size} produktsider`);
  const out = await mapLimit([...urls], 5, async (u) => {
    const html = await ctx.text(u);
    return html ? parseProductPage(shop, u, html) : null;
  });
  return out.filter(Boolean);
}

export async function refresh(shop, raw, ctx) {
  const html = await ctx.text(raw.refresh.url);
  return html ? parseProductPage(shop, raw.refresh.url, html) : null;
}

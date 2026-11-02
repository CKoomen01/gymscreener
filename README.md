# Gymscreener

Sammenligner priser på kosttilskudd (proteinpulver, kreatin, pre-workout, aminosyrer, gainer, barer, drikke og vitaminer) i 13 norske nettbutikker. Prisene regnes per kg, per kg rent protein, per kg kreatin, per stk eller per dagsdose.

**Nettside:** https://ckoomen01.github.io/gymscreener/

## Hvordan det virker

- **Full skann** (`scripts/scan.mjs`) kjøres av GitHub Actions hver 4. time og ved hver kodeendring. Resultatet lagres i `public/data/products.json` og publiseres sammen med siden. Feiler en butikk, beholdes forrige skann for den.
- **Prishistorikk:** Hvert skann logger pris per produkt, butikk og smak i grenen `data` (`history.json`). Siden viser snitt, laveste, høyeste og prisgraf for siste 180 dager, og merker «Billig nå» / «Dyr nå» når en vare har minst 14 dager med data.
- **Live-oppdatering:** Når siden brukes, henter den ferske priser og lagerstatus for de øverste treffene via en Cloudflare Worker (`worker/`). Den bruker de samme skraperne som full skann. Se [CLOUDFLARE-OPPSETT.md](CLOUDFLARE-OPPSETT.md).
- **Rabatter:** Medlemspriser og førstekjøpsrabatter tas bare med for butikkene du krysser av for. Rabattkoder hentes bare fra butikkenes egne sider (forside og egen kodeside), med vilkår som minstebeløp, gyldighet og om koden gjelder nedsatte varer.
- **Frakt:** Fraktpris og gratisgrense per butikk står i `core/shops.js`. Lavere grenser fra bannere på forsiden plukkes opp automatisk.
- **Smak:** Hver smak har egen pris og lagerstatus. Utsolgte smaker skjules som standard.

## Mapper

| Mappe | Innhold |
|---|---|
| `core/` | Butikkvilkår, normalisering (kategori, vekt, protein, smak), prisberegning, rangering og handlekurv-optimalisering |
| `scrapers/` | Én skraper per plattform: WooCommerce, Shopify, Salesforce (Gymgrossisten/Proteinfabrikken), Shopware (Bodylab), Mystore, Magento (Sunkost), XXL og Life |
| `src/` | Nettsiden (React + Vite) |
| `worker/` | Cloudflare Worker-proxy for live-oppdatering |
| `tests/` | Enhetstester (`npm test`) |

## Lokalt

```
npm install
npm run scan     # full skann (tar 10–20 min)
npm run dev      # http://localhost:5173/gymscreener/
```

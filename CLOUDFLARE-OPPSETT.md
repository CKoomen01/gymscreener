# Slik setter du opp live-oppdateringen (Cloudflare Worker)

Nettsiden fungerer uten dette. Da viser den prisene fra siste automatiske skann, som kjøres hver 4. time.
Med Worker-en på plass henter siden også **ferske priser og lagerstatus live** for produktene du ser på.
Alt er gratis (opptil 100 000 forespørsler per døgn), og det tar ca. 10 minutter.

Du trenger ikke kunne programmere. Følg stegene i rekkefølge.

---

## Steg 1: Lag en gratis Cloudflare-konto

1. Gå til **https://dash.cloudflare.com/sign-up**
2. Skriv inn e-post og et passord, og trykk **Sign up**.
3. Bekreft e-posten via lenken Cloudflare sender deg.
4. Hvis du blir spurt om å legge til et domene eller velge en plan, kan du hoppe over det. Du trenger verken domene eller betalt plan.

## Steg 2: Åpne en terminal i prosjektmappen

1. Åpne **Filutforsker** og gå til
   `OneDrive - Norwegian School of Economics\Skrivebord\Claude\Screener etter gymsupplementer\gymscreener\worker`
2. Klikk i adressefeltet øverst i Filutforsker, skriv `powershell` og trykk **Enter**.
   Da åpnes et blått eller svart vindu som allerede står i riktig mappe.

## Steg 3: Logg inn på Cloudflare fra terminalen

Skriv dette og trykk **Enter**:

```
npx wrangler login
```

- Første gang spør den kanskje `Need to install the following packages: wrangler … Ok to proceed? (y)`. Skriv `y` og trykk **Enter**.
- Nettleseren åpnes med en Cloudflare-side som spør om du vil gi **Wrangler** tilgang. Trykk **Allow**.
- Når nettleseren sier «You have granted authorization», kan du lukke fanen. I terminalen står det `Successfully logged in`.

## Steg 4: Publiser Worker-en

Skriv dette og trykk **Enter**:

```
npx wrangler deploy
```

- Første gang kan den spørre om å registrere et **workers.dev-underdomene**. Skriv et navn, for eksempel `cornelis`, og trykk **Enter**.
- Når den er ferdig, står det en linje omtrent slik:

  ```
  https://gymscreener-proxy.cornelis.workers.dev
  ```

  **Kopier denne adressen.** Det er adressen til proxyen din.

## Steg 5: Test at den virker

Lim inn adressen i nettleseren og legg til `/health` på slutten, for eksempel
`https://gymscreener-proxy.cornelis.workers.dev/health`.
Står det **ok**, virker den.

## Steg 6: Koble nettsiden til proxyen

Velg **ett** av disse alternativene:

- **Enklest (bare for deg, i denne nettleseren):** Åpne Gymscreener og gå til fanen **Butikker og innstillinger**. Lim adressen inn i feltet **Adresse til live-proxy** og trykk **Lagre**. Øverst skal det nå stå **Live: på**.
- **Permanent (for alle enheter):** Send adressen til Claude, så legges den inn i koden (`src/config.js`) og siden publiseres på nytt.

---

### Hva Worker-en gjør

- Den henter sider **bare** fra de 14 butikkadressene som står i `worker/src/index.js`. Alt annet avvises.
- Den svarer **bare** nettsiden din (ckoomen01.github.io) og lokal testing (localhost).
- Svar mellomlagres i 5 minutter, så butikkene ikke får unødvendig mange forespørsler.

### Vanlige problemer

| Problem | Løsning |
|---|---|
| `npx` finnes ikke | Node.js mangler. Installer det fra https://nodejs.org (LTS) og start terminalen på nytt. |
| Nettleseren åpnes ikke ved `wrangler login` | Kopier lenken som står i terminalen, og lim den inn i nettleseren selv. |
| «Live: proxy svarer ikke» på siden | Sjekk at `/health`-adressen viser «ok», og at du limte inn adressen uten `/health` på slutten. |
| Du vil endre eller slette den | Logg inn på https://dash.cloudflare.com og gå til **Workers & Pages**, der kan du slette `gymscreener-proxy`. |

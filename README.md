# Projektinfo

### Vercel-länk
https://petalhaus-v2.vercel.app/

### Kör projektet lokalt
1. I roten: `vercel env pull .env` och `yarn dev`
2. `cd frontend`
3. `vercel env pull .env` och `npm run dev`

### Testkonton och nycklar (se .env.example)
| Tjänst | Variabel | Backend/Frontend |
|---|---|---|
| **Leverantörs-API** (produktimport) | `IMPORT_API_KEY` | Backend |
| **Algolia** (sök) | `ALGOLIA_APP_ID` (config) | Backend |
| | `ALGOLIA_ADMIN_KEY` - får skriva till indexet | Backend |
| | `ALGOLIA_SEARCH_KEY` - får bara söka | Backend |
| | `ALGOLIA_INDEX` (config) | Backend |
| **Stripe** (betalning) | `STRIPE_SECRET_KEY` | Backend |
| | `STRIPE_WEBHOOK_SECRET` | Backend |
| | `VITE_STRIPE_PUBLISHABLE_KEY` | Frontend |
| **Supabase** (produktbilder)  | `SUPABASE_URL` (config) | Backend |
| | `SUPABASE_SECRET_KEY` | Backend |
| | `SUPABASE_BUCKET` (config) | Backend |
| **PostNord** (ombud och leveranstid) | `POSTNORD_API_KEY` | Backend |
| | `POSTNORD_BASE_URL` (config) | Backend |

### Övriga inställningar

| Variabel | Beskrivning | Var den hamnar |
|---|---|---|
| `DATABASE_URL` | Anslutning till PostgreSQL | Backend |
| `JWT_SECRET` | Signerar inloggningstoken | Backend |
| `CLIENT_URL` | Frontendens adress (används för CORS och av Stripe) | Backend |
| `SHOP_POSTAL_CODE` | Lagrets postnummer (för att beräkna leveranstid) | Backend |
| `VITE_API_URL` | Backendens adress | Frontend |

<br>

## AI-Labb – Frakt med PostNord

### Verktyg
Claude for Windows. Verktyget läser inte projektet, utan jag klistrade in de filer som behövdes (adaptrar, routes, `fetchWithRetry.js`). API-nyckeln klistrades aldrig in - den finns bara i `.env` lokalt och i Vercels miljövariabler.

### Prompter
- *"Nu vill jag göra en shippingAdapter.js med tillhörande routes som ska hämta närmaste ombud samt beräkna leveranstid via PostNords API. Det ska finnas två leveransalternativ: ombud/hemleverans, och frakten ska vara gratis över 500 kr. Om min fetchWithRetry.js är applicerbar här vill jag att den används."*
- *"Hjälp mig här"* + min `checkout.js`, för att få in frakten i ordern och i Stripe.
- Felsökning: jag klistrade in felmeddelanden från Vercel-loggen (404, 400, Zod-fel) och parameterlistor från PostNords portal, och bad AI:n rätta koden efter dem.

### Vad AI:n föreslog
- `shippingAdapter.js` - den enda filen som känner till PostNord - med `getNearestServicePoints` och en funktion för leveranstid, båda via `fetchWithRetry` (timeout + retries) och med Zod-validering av PostNords svar.
- `shippingRates.js` med shoppens egna priser som används både i kassan och när ordern skapas, så att visat pris och debiterat pris alltid är samma.
- `shipping-routes.js` med `GET /api/shipping/service-points` och `POST /api/shipping/quote`, där ordervärdet räknas från databasen.
- Frakten sparas på ordern och läggs till som en egen rad i Stripe Checkout Session.

### Vad som skilde sig från PostNords dokumentation - och hur jag löste det
Jag testade varje anrop med min sandlådenyckel och jämförde med Swagger-dokumentationen i PostNords utvecklarportal ("Try it out").

### Slutsats
AI:n gav en bra struktur (adapter, egna priser, validering, felhantering), men gissade fel på både sökvägar, parametrar och svarsformat. Det var först när anropen testades mot sandlådan och jämfördes med dokumentationen i portalen som integrationen blev rätt.

<br/>

## Reflektion

### 1.1 Leverantörens produktdata - fil
Leverantörs-API:et levererar katalogen som CSV och XML, inte som JSON. Det passar när en hel katalog ska flyttas mellan system, men kräver att shoppen själv tolkar filen. Importen hämtas via `fetchWithRetry.js` och valideras rad för rad med Zod. 

Jag gjorde en del förändringar i min databas för att få in de flesta av de värden som Leverantörs-API:et tillhandahåller, men valde att utesluta följande:

**Artikelnummer** - Jag använder redan ett id med increment och anser inte att jag behöver ytterligare ett id. Jag använder istället EAN för att kontrollera huruvida en produkt existerar i sortimentet eller ej.

**Varianter** - Finns ej med i min datamodell. Jag anser att jag inte behöver den i nuläget.

### 1.2 Algolia - SDK
Sökningen och indexeringen sker via Algolias officiella klient (`algoliasearch`), som i sin tur anropar Algolias REST-API. SDK:n ger färdiga funktioner som `saveObjects` och `replaceAllObjects`, inbyggda retries och rätt autentisering, så att jag slipper bygga anropen själv.

### 1.3 Stripe - SDK, inbäddat formulär och webhook
Servern skapar en Checkout Session via Stripes SDK, och kunden betalar i Stripes formulär inuti min sida (embedded). Att betalningen gått igenom får servern veta via en **webhook**, eftersom det är Stripe som vet när betalningen är klar - inte min frontend.

### 1.4 Supabase Storage - SDK
Bilderna laddas upp med `@supabase/supabase-js`. SDK:n passar eftersom filuppladdning med autentisering och rätt content-type är krånglig att göra med rena HTTP-anrop.

### 1.5 PostNord - REST
Ombud och leveranstid hämtas med vanliga GET-anrop. Det finns ingen officiell SDK för Node, och två enkla anrop kräver ingen. Här passade min egen `fetchWithRetry` direkt.

### 2. Varför via Express och inte direkt från React

Allt som körs i React kan användaren läsa och ändra i webbläsaren. Om React anropade tjänsterna direkt skulle hemliga nycklar bli tillgängliga i den publika koden och göra webbshoppen - och leverantören - sårbar för skadliga/illasinnade anrop.

Servern är också den enda platsen där jag kan lita på priser: React får bara bestämma vilka produkter och hur många som avses, och Express hämtar priserna från databasen och räknar fram frakten, så att beloppet i Stripe inte kan manipuleras.

Dessutom samlas validering, timeouts och felhantering på ett ställe, och varje tjänst har en egen adapter. Skulle jag byta från PostNord till en annan fraktleverantör behöver bara `shippingAdapter.js` skrivas om.

### 3. Integrera i stället för att bygga själv

Gemensamt för alla tjänster är att de löser problem som kräver mycket specialkunskap, drift och underhåll, och som inte är kärnan i en webbshop. Att bygga dem själv skulle ta lång tid, bli sämre och dessutom kräva att jag själv ansvarar för säkerhet, skalning och uppdateringar. Genom att integrera dem kan jag fokusera på själva shoppen.

- **Algolia** – en egen sökmotor med stavfelstolerans och ranking.
- **Stripe** – kortbetalningar kräver PCI-certifiering, bedrägeriskydd och avtal med banker.
- **Supabase Storage** – egen fillagring med backup och CDN. Vercel har dessutom inget beständigt filsystem.
- **PostNord** – ombud och leveranstider är PostNords egen data och kan inte byggas själv.
- **Leverantörens fil** – produktdatan ägs av leverantören, så alternativet vore att mata in allt för hand.

### 4. När en tjänst är nere

Varje anrop har en timeout, och adaptrarna kastar fel som routerna översätter till 502 med ett begripligt meddelande.

- **Leverantören:** importen svarar "Leverantören svarar inte just nu". Inga produkter ändras.
- **Algolia:** produkten sparas ändå i databasen, och admin får veta att sökindexet inte uppdaterades. Knappen "Indexera om alla produkter" rättar det i efterhand. Om sökningen är nere visar sökfältet ett felmeddelande, men resten av shoppen fungerar.
- **Stripe:** kunden får "Betaltjänsten svarar inte", och ordern markeras som avbruten i stället för att ligga kvar som obetald. Om webhooken misslyckas skickar Stripe om den, och `WHERE stripe_status = 'pending'` gör att ordern ändå bara markeras som betald en gång.
- **Supabase:** admin får ett felmeddelande, och produkten behåller sin gamla bild eftersom databasen bara uppdateras efter en lyckad uppladdning.
- **PostNord:** utan ombud väljs hemleverans automatiskt, och utan leveranstid visas priserna ändå. Kassan går alltså fortfarande att använda.

### 5. Risker med beroendet

**Persondata (GDPR):** Stripe tar emot kundens e-post, adress och betaluppgifter, och PostNord får kundens postnummer. Båda räknas som personuppgifter, och Stripe är ett amerikanskt bolag, vilket innebär att uppgifter kan föras över utanför EU. I en riktig shop krävs då personuppgiftsbiträdesavtal och information i integritetspolicyn. Algolia får däremot bara produktdata, vilket gör den till en mindre risk.

**Ändrade villkor och API:er:** under arbetet med PostNord märktes det tydligt att API:er ändras - sökvägar och parameternamn skilde sig mellan versionerna. En leverantör kan när som helst stänga en gammal version, och då slutar kassan visa leveranstider.

**Kostnad:** Stripe tar en avgift per transaktion, och Algolias och Supabases gratisnivåer har tak för antal sökningar, poster och lagring. Ett gratisprojekt i Supabase kan dessutom pausas efter en tids inaktivitet. Växer shoppen kan kostnaderna öka, och det blir dyrt och tidskrävande att byta tjänst - vilket är ett skäl till att ha en adapter per tjänst.
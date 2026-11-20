# Projektinfo

### Vercel-länk
https://petalhaus-v2.vercel.app/

### Kör projektet lokalt
1. I roten: `vercel env pull .env` och `yarn dev`
2. `cd frontend`
3. `vercel env pull .env` och `npm run dev`

### Testkonton och nycklar (se .env.example)
Hemliga nycklar finns bara i `.env` (lokalt) och i Vercels miljövariabler – aldrig i koden eller i webbläsaren. Bara variabler som börjar med `VITE_` hamnar i frontend, och de är inte hemliga.

| Tjänst | Variabel | Backend/Frontend |
|---|---|---|
| **Leverantörs-API** (produktimport) | `IMPORT_API_KEY` | Backend |
| **Frankfurter** (valutakurser) | `CURRENCY_API_URL` (config) | Backend |
| | `CURRENCY_API_TIMEOUT_MS` (config) – timeout för anropet | Backend |
| | `CURRENCY_CACHE_SECONDS` (config) – hur länge kurserna cachas | Backend |
| **Algolia** (sök) | `ALGOLIA_APP_ID` (config) | Backend |
| | `ALGOLIA_ADMIN_KEY` – får skriva till indexet | Backend |
| | `ALGOLIA_SEARCH_KEY` – får bara söka | Backend |
| | `ALGOLIA_INDEX` (config) | Backend |
| **Stripe** (betalning) | `STRIPE_SECRET_KEY` | Backend |
| | `STRIPE_WEBHOOK_SECRET` – en per webhook-endpoint (lokalt från `stripe listen`) | Backend |
| | `VITE_STRIPE_PUBLISHABLE_KEY` – publik nyckel | Frontend |
| **Supabase** (produktbilder) | `SUPABASE_URL` (config) | Backend |
| | `SUPABASE_SECRET_KEY` | Backend |
| | `SUPABASE_BUCKET` (config) | Backend |
| **PostNord** (ombud och leveranstid) | `POSTNORD_API_KEY` | Backend |
| | `POSTNORD_BASE_URL` (config) | Backend |
| **Google** (kundinloggning, OAuth 2.0) | `GOOGLE_CLIENT_ID` (config) | Backend |
| | `GOOGLE_CLIENT_SECRET` | Backend |
| | `GOOGLE_REDIRECT_URI` (config) – måste stämma exakt med Google Cloud Console | Backend |
| **Resend** (orderbekräftelse via e-post) | `RESEND_API_KEY` – behörighet *Sending access* | Backend |
| | `EMAIL_FROM` (config) – avsändare, t.ex. `Petalhaus <order@petalhaus.se>` | Backend |
| **GitHub** (admininloggning, OAuth 2.0) | `GITHUB_CLIENT_ID` (config) | Backend |
| | `GITHUB_CLIENT_SECRET` | Backend |
| | `GITHUB_CALLBACK_URL` (config) – måste stämma exakt med OAuth Appens Redirect URI | Backend |
| | `ADMIN_GITHUB_LOGINS` (config) – kommaseparerade GitHub-användarnamn som blir admin | Backend |
| **GitHub** (issues) | `GITHUB_ISSUES_TOKEN` – shoppens fine-grained token, *Issues: Read and write*, bara för shoppens repo, med utgångsdatum | Backend |
| | `GITHUB_REPO` (config) – `ägare/repo` | Backend |

### Övriga inställningar

| Variabel | Beskrivning | Var den hamnar |
|---|---|---|
| `DATABASE_URL` | Anslutning till PostgreSQL | Backend |
| `JWT_SECRET` | Signerar inloggningstoken (lösenord, Google och GitHub) | Backend |
| `CLIENT_URL` | Frontendens adress (används för CORS och av Stripe som retur-URL) | Backend |
| `SHOP_POSTAL_CODE` | Lagrets postnummer (för att beräkna leveranstid) | Backend |
| `PORT` | Port för backend lokalt (standard 3000) | Backend |
| `NODE_ENV` | `production` på Vercel – styr t.ex. `secure` på cookies | Backend |
| `VITE_API_URL` | Backendens adress (`/api`, satt i `frontend/.env.production`) | Frontend |

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

## Autentisering – redogörelse (Inlämningsuppgift 2)

Shoppen har tre sätt att logga in: **e-post och lösenord**, **Google** (kunder, Labb 6) och **GitHub** (admin, Labb 7). All inloggning går via backend – React länkar bara till `/api/auth/google` eller `/api/auth/github`, och servern sköter resten. Client secrets och nycklar finns bara i `.env` och i Vercels miljövariabler.

### Inloggningsflödet – Google (OAuth 2.0 + OpenID Connect)

1. Kunden klickar på **Fortsätt med Google** → webbläsaren går till `GET /api/auth/google`.
2. Servern skapar ett slumpat **state** och en slumpad **PKCE code verifier**. Båda läggs i en signerad JWT i cookien `GoogleFlow` (httpOnly, 10 minuter, bara skickad till `/api/auth/google`). Till Google skickas bara verifierns hash, **code challenge** (S256).
3. Servern skickar vidare till Googles inloggning med `scope=openid email profile` – shoppen ber bara om namn och e-post.
4. Kunden loggar in hos Google och skickas tillbaka till `GET /api/auth/google/callback?code=…&state=…`.
5. Servern läser `GoogleFlow`-cookien (och raderar den – den används bara en gång) och kontrollerar att **state** i adressen är samma som i cookien. Stämmer det inte avvisas inloggningen.
6. Servern byter **koden mot tokens** direkt hos Google, server till server, med **client secret** och **code verifier**. Anropet har timeout och svaret valideras med Zod.
7. Kunden läses ur **ID-token** (en JWT). Zod kontrollerar att den är utfärdad av Google (`iss`), till min app (`aud`), inte har gått ut (`exp`) och att e-postadressen är verifierad.
8. Kunden hittas i databasen med Googles **`sub`** – aldrig med e-postadressen – och skapas vid första inloggningen.
9. Shoppen loggar in kunden med sin egen JWT i cookien `TokenCookie` och skickar tillbaka till butiken.

### Inloggningsflödet – GitHub (OAuth 2.0, bara admin)

1. Admin klickar på **Fortsätt med GitHub** → `GET /api/auth/github`.
2. Servern skapar ett slumpat **state** och sparar det i cookien `oauth_state` (httpOnly, 10 minuter, bara skickad till `/api/auth/github`).
3. Servern skickar vidare till GitHub med `scope=read:user` – bara läsrätt till profilen.
4. GitHub skickar tillbaka till `/api/auth/github/callback`. Servern kontrollerar state, byter koden mot en access token med **client secret** och hämtar användaren från `GET https://api.github.com/user`. Båda svaren valideras med Zod.
5. Bara användarnamn i `ADMIN_GITHUB_LOGINS` släpps in – andra får meddelandet "Ingen behörighet".
6. Admin sparas i databasen med GitHubs **`id`** (inte användarnamnet, som kan bytas) och loggas in med samma `TokenCookie` som alla andra, med rollen `admin`.

### Vad state och PKCE skyddar mot – och vad jag valde

- **state** skyddar mot **CSRF i inloggningen**: att en angripare får min webbläsare att avsluta en inloggning som angriparen själv startat, så att jag blir inloggad på angriparens konto. Callbacken godtar bara ett state som min egen webbläsare fick vid starten.
- **PKCE** skyddar mot att en **stulen kod** används. Fångar någon upp koden i callback-adressen (t.ex. i en logg eller webbläsarhistorik) kan den inte bytas mot tokens utan code verifier – och den har bara min server.
- **Google: state + PKCE.** Kunderna är många och okända, så jag använder båda.
- **GitHub: state.** Servern är en konfidentiell klient med client secret, så en stulen kod kan inte bytas utan den. PKCE är förberett i koden (markerat `// PKCE`) och kan slås på. Det vore ett extra lager om client secret skulle läcka.

### Tokens – vilka, till vad, var och hur länge

| Token | Från | Används till | Sparas | Giltig |
|---|---|---|---|---|
| **Kod** (`code`) | Google / GitHub | Bytas mot tokens, en gång | Ingenstans – bara i callback-adressen | Några minuter, en gång |
| **ID-token** (JWT) | Google | Läsa vem kunden är (`sub`, e-post, namn) | Ingenstans – används i callbacken och kastas | ca 1 timme |
| **Access token** | Google | Används inte – shoppen behöver bara ID-token | Ingenstans | ca 1 timme |
| **Access token** | GitHub | Ett anrop till `GET /user`, sedan kastas den | Ingenstans | Tills den återkallas |
| **`GoogleFlow`** (signerad JWT) | Shoppen | Bär state och code verifier mellan start och callback | httpOnly-cookie, bara till `/api/auth/google` | 10 minuter |
| **`oauth_state`** | Shoppen | Bär state mellan start och callback | httpOnly-cookie, bara till `/api/auth/github` | 10 minuter |
| **`TokenCookie`** (JWT) | Shoppen | Håller kunden/admin inloggad: `user_id`, namn, `role` | httpOnly-cookie | 8 timmar |
| **Shoppens GitHub-token** | GitHub (fine-grained PAT) | Skapa och lista issues i shoppens repo | `.env` / Vercel – bara på servern | Utgångsdatum satt på GitHub |
| **Resend API-nyckel** | Resend | Skicka orderbekräftelser | `.env` / Vercel – bara på servern | Tills den återkallas |

Inga tokens från Google eller GitHub når webbläsaren. Webbläsaren ser bara shoppens egna cookies, och de är httpOnly – JavaScript kan inte läsa dem.

### Session eller JWT – och varför JWT

Efter inloggningen håller shoppen användaren inloggad med en **JWT i en httpOnly-cookie** (`TokenCookie`). Samma cookie används för lösenord, Google och GitHub, så resten av shoppen (`verifyToken`, `requireAdmin`) behöver inte veta hur användaren loggade in.

Jag valde JWT eftersom:
- Shoppen körs som **serverless-funktioner på Vercel**, som inte delar minne. En session skulle kräva en extra lagring (t.ex. en sessionstabell eller Redis) som varje anrop måste fråga.
- Shoppen använde redan JWT för lösenordsinloggningen, så Google och GitHub kunde återanvända samma mekanism.

Cookien är **httpOnly** (JavaScript kan inte läsa den, vilket skyddar mot att en XSS-attack stjäl den), **secure** på Vercel (skickas bara över HTTPS) och **`sameSite: lax`** (skickas inte med POST-anrop från andra sajter, vilket skyddar mot CSRF).

### Risker – om en token stjäls, och hur den spärras

- **Om `TokenCookie` stjäls** kan angriparen vara inloggad som användaren tills token går ut – högst 8 timmar. För en admin betyder det tillgång till adminsidorna och möjlighet att skapa issues. httpOnly, secure och sameSite gör den svår att stjäla, och den korta livslängden begränsar skadan.
- **En JWT kan inte spärras en och en.** Servern kontrollerar bara signaturen, inte en lista. Utloggning raderar cookien i webbläsaren, men en kopia av token fungerar fortfarande tills den går ut. Mina alternativ:
  - **Byta `JWT_SECRET`** – alla tokens slutar gälla direkt, men alla användare loggas ut.
  - **Spärrlista eller versionsnummer** – t.ex. en kolumn `token_version` i `user_` som läggs i token och jämförs vid varje anrop. Då går en användare att spärra, men servern måste fråga databasen varje gång – och då är man nästan tillbaka i en session.
- **Rollen ligger i token.** Tas någon bort från `ADMIN_GITHUB_LOGINS` kan hen inte logga in igen, men en redan utfärdad token behåller rollen `admin` tills den går ut. För en shop med få admins är 8 timmar acceptabelt.
- **Googles och GitHubs tokens** sparas aldrig, så det finns inga att stjäla från databasen eller webbläsaren.
- **Om shoppens GitHub-token läcker** kan den bara läsa och skriva issues i ett enda repo – den är fine-grained, har bara behörigheten *Issues: Read and write* och ett utgångsdatum. Den spärras genom att återkalla den på GitHub och lägga in en ny i Vercel.
- **Om en client secret läcker** kan någon utge sig för att vara min app. Den byts i Google Cloud Console eller i GitHubs OAuth App och uppdateras i Vercel.

### När passar session respektive JWT?

- **Session** passar när man måste kunna **spärra direkt** (t.ex. logga ut en stulen inloggning eller ta bort en admin på sekunden), när det är känsliga data som bank eller vård, och när servern ändå har en databas som varje anrop går till.
- **JWT** passar när servern är **tillståndslös** – serverless, flera servrar eller flera tjänster som ska lita på samma inloggning – och när en kort livslängd räcker som skydd.
- För Petalhaus väger enkelheten och serverless tyngst, och 8 timmars livslängd är en rimlig balans. Om shoppen växte med fler admins skulle jag lägga till `token_version` för att kunna spärra enskilda konton.

### Samma e-postadress hos ett lösenordskonto (Labb 6)

Kunder känns igen på Googles `sub`, aldrig på e-postadressen. Om någon loggar in med Google för första gången och e-postadressen redan finns hos ett lösenordskonto slås kontona **inte** ihop automatiskt. Kunden får i stället ett meddelande och inloggningen med lösenord öppnas direkt. Annars skulle vem som helst som kontrollerar ett Google-konto med samma adress kunna ta över ett befintligt konto. Den som vill använda Google kan själv koppla kontot under Mina sidor medan hen är inloggad med lösenord – då har hen bevisat att hen äger båda kontona.

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
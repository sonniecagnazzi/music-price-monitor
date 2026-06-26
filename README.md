# Music Price Monitor

Web app gratuita per uso personale che monitora prezzi di CD/LP su Momox e Medimops, salva i dati su Supabase, mostra una dashboard su Vercel e controlla i prezzi ogni 4 ore con GitHub Actions.

## FASE 1 — Architettura breve

- Dashboard: Next.js App Router + React + Tailwind CSS, in italiano.
- Database: Supabase Postgres piano gratuito.
- Query/ORM: Supabase client lato server, senza service role key nel browser.
- Cron: GitHub Actions `schedule` ogni 4 ore e lancio manuale `workflow_dispatch`.
- Email: Resend via API key in secret; alternativa pratica: SMTP Gmail richiederebbe codice aggiuntivo e app password, quindi qui uso Resend per semplicità.
- Scraping: `fetch` server-side + Cheerio + fallback JSON-LD/meta/regex.
- Hosting: Vercel Hobby per uso personale/non commerciale.
- Sicurezza: API CRUD usano service role solo lato server; endpoint cron protetto da `CRON_SECRET`; input validato con Zod.
- Account da creare: GitHub, Supabase, Vercel, Resend.

Nota: Vercel Hobby è gratuito ma limitato all’uso personale/non commerciale; Supabase e Resend hanno piani gratuiti con limiti che possono cambiare. Controlla sempre le pagine prezzi prima di dipendere da numeri specifici.

## FASE 2 — Albero file

```text
music-price-monitor/
├─ .env.example
├─ .github/workflows/monitor.yml
├─ .gitignore
├─ README.md
├─ app/
│  ├─ api/
│  │  ├─ check/route.ts
│  │  ├─ monitors/[id]/check/route.ts
│  │  ├─ monitors/[id]/route.ts
│  │  ├─ monitors/route.ts
│  │  └─ settings/route.ts
│  ├─ components/Dashboard.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ lib/
│  ├─ email.ts
│  ├─ env.ts
│  ├─ format.ts
│  ├─ monitor-runner.ts
│  ├─ scraper.ts
│  ├─ supabase-server.ts
│  ├─ types.ts
│  └─ validation.ts
├─ next-env.d.ts
├─ next.config.mjs
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ scripts/run-monitor.ts
├─ supabase/schema.sql
├─ tailwind.config.ts
└─ tsconfig.json
```

## FASE 3 — Codice completo

Il codice completo è dentro i file del repository. Questo README spiega come usarlo. Per vedere tutti i file concatenati, apri `CODE_COMPLETO.md` incluso nello zip.

## FASE 4 — SQL Supabase

Apri `supabase/schema.sql`, copia tutto e incollalo nel Supabase SQL Editor. Lo script crea:

- `monitors`: righe di monitoraggio.
- `settings`: email globale.
- `price_checks`: storico dei controlli.
- Indici e trigger `updated_at`.

Scelta RLS: per uso personale e semplicità RLS è disabilitata. L’app usa la `SUPABASE_SERVICE_ROLE_KEY` solo lato server e nei GitHub Secrets. Non inserirla mai in codice pubblico o variabili browser.

## FASE 5 — Variabili ambiente

Copia `.env.example` in `.env.local` solo se vuoi provare in locale. Su Vercel e GitHub devi inserire gli stessi valori come variabili/secrets.

### Variabili

- `NEXT_PUBLIC_SUPABASE_URL`: URL progetto Supabase. Pubblica.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key Supabase. Pubblica, anche se qui è poco usata.
- `SUPABASE_URL`: stesso URL Supabase. Server-side.
- `SUPABASE_SERVICE_ROLE_KEY`: chiave segreta Supabase service role. Segreta.
- `RESEND_API_KEY`: API key Resend. Segreta.
- `ALERT_FROM_EMAIL`: mittente email, per esempio `Music Price Monitor <onboarding@resend.dev>` in test o un dominio verificato Resend.
- `DEFAULT_ALERT_EMAIL`: tua email di default. Può essere segreta.
- `CRON_SECRET`: stringa lunga casuale, per esempio generata da un password manager. Segreta.
- `APP_BASE_URL`: URL Vercel finale, per esempio `https://music-price-monitor.vercel.app`.

### Dove inserirle

- Vercel: Project → Settings → Environment Variables → aggiungi tutte le variabili.
- GitHub: Repository → Settings → Secrets and variables → Actions → New repository secret → aggiungi tutte le variabili del workflow.
- Locale: file `.env.local` nella cartella principale, mai caricarlo su GitHub.

## FASE 6 — Deploy passo-passo per persona non tecnica

### 1. Crea account GitHub

Vai su GitHub, crea un account, conferma l’email.

### 2. Crea repository

Clicca `+` → `New repository`. Nome consigliato: `music-price-monitor`. Lascia `Public` o `Private`. Clicca `Create repository`.

### 3. Carica codice

Metodo semplice dal browser:

1. Apri il repository.
2. Clicca `Add file` → `Upload files`.
3. Trascina tutte le cartelle e i file del progetto, inclusa `.github`.
4. Scrivi commit message: `Initial music price monitor`.
5. Clicca `Commit changes`.

### 4. Crea progetto Supabase

1. Vai su Supabase e crea un account.
2. Clicca `New project`.
3. Scegli nome e password database.
4. Aspetta la creazione del progetto.
5. Vai in `Project Settings` → `API`.
6. Copia `Project URL`, `anon public key`, `service_role key`.

### 5. Esegui SQL

1. In Supabase apri `SQL Editor`.
2. Clicca `New query`.
3. Copia il contenuto di `supabase/schema.sql`.
4. Clicca `Run`.
5. Se non ci sono errori, il database è pronto.

### 6. Crea chiave email Resend

1. Vai su Resend e crea account.
2. Vai su `API Keys`.
3. Clicca `Create API Key`.
4. Copia la chiave in `RESEND_API_KEY`.
5. Per test puoi provare `ALERT_FROM_EMAIL=Music Price Monitor <onboarding@resend.dev>`. Per uso stabile verifica un dominio in Resend e usa un mittente del tuo dominio.

### 7. Configura Vercel

1. Vai su Vercel e accedi con GitHub.
2. Clicca `Add New` → `Project`.
3. Importa il repository `music-price-monitor`.
4. In `Environment Variables`, inserisci tutte le variabili elencate sopra.
5. Clicca `Deploy`.
6. A fine deploy copia l’URL Vercel e aggiornalo in `APP_BASE_URL` su Vercel e GitHub Secrets.

### 8. Configura GitHub Secrets

Nel repository GitHub:

1. `Settings` → `Secrets and variables` → `Actions`.
2. Clicca `New repository secret`.
3. Crea questi secret: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `DEFAULT_ALERT_EMAIL`, `CRON_SECRET`, `APP_BASE_URL`.

### 9. Lancia cron manualmente

1. GitHub → repository → tab `Actions`.
2. Clicca workflow `Music Price Monitor`.
3. Clicca `Run workflow`.
4. Clicca di nuovo `Run workflow`.

### 10. Verifica log

1. Sempre in `Actions`, clicca l’esecuzione appena partita.
2. Apri job `monitor`.
3. Apri step `Run monitor`.
4. Dovresti vedere righe tipo `Totale`, `Controllati`, `Alert inviati`, `Errori`.

### 11. Usa dashboard

1. Apri URL Vercel.
2. Inserisci email globale.
3. Clicca `Nuovo monitor`.
4. Compila Tipo, Artista, Album, Edizione, Sito, URL, Prezzo target.
5. Clicca `Salva`.
6. Clicca `Controlla ora` sulla riga.

## FASE 7 — Test manuali

### Test 1: database

Aggiungi una riga dalla dashboard. In Supabase → Table Editor → `monitors`, verifica che compaia.

### Test 2: URL esempio

Puoi provare l’URL indicato nella richiesta:

```text
https://www.momox-shop.fr/michael-jackson-thriller-special-edition-audio-cd-M0B00005NUZN.html
```

Imposta target alto, per esempio `999,00`, così se il prezzo viene letto dovrebbe risultare sotto target e partire l’email.

### Test 3: prezzo letto

Dopo `Controlla ora`, guarda colonne:

- `Prezzo Attuale`: deve mostrare un valore tipo `4,99 €`.
- `Ultimo rilievo`: deve avere data/ora.
- `Stato`: `ok`, `sotto target` o `errore`.

### Test 4: email partita

Se prezzo attuale <= target:

- Controlla inbox e spam.
- Controlla log GitHub Actions.
- Controlla campo `alert_sent`: deve diventare `true`.

### Test 5: anti-spam

Esegui due volte il controllo con prezzo sotto target. La seconda volta non deve inviare una seconda email. Se poi il prezzo risale sopra target, `alert_sent` torna `false`; alla successiva discesa reinvia.

## FASE 8 — Troubleshooting

### Prezzo non trovato

Cause comuni: HTML cambiato, prezzo caricato via JavaScript, bot bloccato, pagina non disponibile. La riga mostra `errore` e `last_error`. Il codice prova CSS selector, meta tag, JSON-LD e regex, ma lo scraping può rompersi se il sito cambia HTML.

### Email non inviata

Controlla `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, dominio verificato e spam. Se manca email globale e manca email riga, il prezzo viene letto ma l’email non parte.

### GitHub Action fallita

Apri `Actions` → run fallita → `Run monitor`. Errori tipici: secret mancanti, SQL non eseguito, dipendenze non installate.

### Variabile ambiente mancante

Il log mostra `Variabile ambiente mancante: NOME`. Aggiungi quella variabile su Vercel o GitHub Secrets, poi rilancia.

### Sito blocca scraping

Il log può mostrare HTTP 403/429. Riduci numero di URL, attendi, o controlla manualmente. Il progetto include un ritardo tra richieste per non martellare i siti.

### Supabase permission denied

Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia quella `service_role`, non la anon key. Verifica che le tabelle esistano e che RLS sia disabilitata come nello SQL.

### Vercel deploy fallito

Controlla `Build Logs`. Errori frequenti: variabili ambiente mancanti, repository senza `package-lock.json`, file non caricati, Node version non compatibile.

## Comandi locali opzionali

Solo per chi vuole provare sul proprio PC:

```bash
npm install
cp .env.example .env.local
npm run dev
npm run typecheck
npm run monitor
```

## Note di sicurezza

- Non condividere `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.
- Non caricare `.env.local` su GitHub.
- L’endpoint `/api/check` richiede `Authorization: Bearer CRON_SECRET` o query `?secret=...`.
- Il pulsante `Controlla ora` in dashboard esegue il controllo singolo passando da API server-side.

# Codice completo - Music Price Monitor

## `.env.example`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TUO-PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_URL=https://TUO-PROGETTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
RESEND_API_KEY=re_...
ALERT_FROM_EMAIL=Music Price Monitor <onboarding@resend.dev>
DEFAULT_ALERT_EMAIL=tuamail@example.com
CRON_SECRET=incolla-qui-una-stringa-lunga-casuale
APP_BASE_URL=https://tuo-progetto.vercel.app
```

## `.github/workflows/monitor.yml`

```yaml
name: Music Price Monitor

on:
  schedule:
    - cron: '0 */4 * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run monitor
        run: npm run monitor
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERT_FROM_EMAIL: ${{ secrets.ALERT_FROM_EMAIL }}
          DEFAULT_ALERT_EMAIL: ${{ secrets.DEFAULT_ALERT_EMAIL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          APP_BASE_URL: ${{ secrets.APP_BASE_URL }}
```

## `.gitignore`

```
node_modules
.next
.env
.env.local
.vercel
.DS_Store
```

## `README.md`

```
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
```

## `app/api/check/route.ts`

```ts
import { NextResponse } from 'next/server';
import { runMonitor } from '@/lib/monitor-runner';
import { env } from '@/lib/env';

function isAuthorized(request: Request): boolean {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || new URL(request.url).searchParams.get('secret');
  return token === env.cronSecret();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  try {
    const summary = await runMonitor({ onlyActive: true });
    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore controllo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

## `app/api/monitors/[id]/check/route.ts`

```ts
import { NextResponse } from 'next/server';
import { runMonitor } from '@/lib/monitor-runner';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const summary = await runMonitor({ monitorId: params.id, onlyActive: false });
    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore controllo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

## `app/api/monitors/[id]/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { cleanMonitorInput } from '@/lib/validation';
import type { Monitor } from '@/lib/types';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = cleanMonitorInput(await request.json());
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('monitors')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single<Monitor>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('monitors').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

## `app/api/monitors/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { cleanMonitorInput } from '@/lib/validation';
import type { Monitor } from '@/lib/types';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('monitors').select('*').order('created_at', { ascending: false }).returns<Monitor[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = cleanMonitorInput(body);
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('monitors').insert(input).select('*').single<Monitor>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

## `app/api/settings/route.ts`

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import type { Settings } from '@/lib/types';

const settingsSchema = z.object({ alert_email: z.string().trim().email('Email non valida').nullable().or(z.literal('')) });

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle<Settings>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PUT(request: Request) {
  try {
    const parsed = settingsSchema.parse(await request.json());
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, alert_email: parsed.alert_email || null, updated_at: new Date().toISOString() })
      .select('*')
      .single<Settings>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

## `app/components/Dashboard.tsx`

```ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LastStatus, Monitor, MonitorInput, MonitorSite, MonitorType, Settings } from '@/lib/types';
import { formatDate, formatEuro, toNumberFromItalianInput } from '@/lib/format';

type SortKey = 'artist' | 'album' | 'target_price' | 'current_price' | 'last_checked_at';
type FormState = {
  id?: string;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string;
  site: MonitorSite;
  url: string;
  target_price: string;
  alert_email: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  type: 'CD',
  artist: '',
  album: '',
  edition: '',
  site: 'Momox',
  url: '',
  target_price: '0,00',
  alert_email: '',
  is_active: true
};

const statusLabels: Record<LastStatus | 'never_checked', string> = {
  never_checked: 'mai controllato',
  ok: 'ok',
  below_target: 'sotto target',
  error: 'errore'
};

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>('artist');
  const [sortAsc, setSortAsc] = useState(true);
  const [message, setMessage] = useState('Caricamento...');
  const [busy, setBusy] = useState(false);

  async function loadData() {
    const [monitorsResponse, settingsResponse] = await Promise.all([fetch('/api/monitors'), fetch('/api/settings')]);
    const monitorsJson = await monitorsResponse.json() as { data?: Monitor[]; error?: string };
    const settingsJson = await settingsResponse.json() as { data?: Settings; error?: string };
    if (!monitorsResponse.ok) throw new Error(monitorsJson.error || 'Errore caricamento monitor');
    if (!settingsResponse.ok) throw new Error(settingsJson.error || 'Errore caricamento impostazioni');
    setMonitors(monitorsJson.data || []);
    setSettings(settingsJson.data || null);
    setMessage('Pronto.');
  }

  useEffect(() => {
    loadData().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Errore caricamento'));
  }, []);

  const filtered = useMemo(() => {
    const lower = (value: unknown) => String(value ?? '').toLowerCase();
    return monitors
      .filter((monitor) => {
        const status = monitor.last_status || 'never_checked';
        const row: Record<string, unknown> = { ...monitor, status, is_active: monitor.is_active ? 'attivo' : 'disattivo' };
        return Object.entries(filters).every(([key, filterValue]) => !filterValue || lower(row[key]).includes(filterValue.toLowerCase()));
      })
      .sort((a, b) => {
        const left = a[sortKey] ?? '';
        const right = b[sortKey] ?? '';
        const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
        return sortAsc ? result : -result;
      });
  }, [monitors, filters, sortKey, sortAsc]);

  function startNew() {
    setForm(emptyForm);
    setMessage('Nuovo monitor: compila il form e premi Salva.');
  }

  function editMonitor(monitor: Monitor) {
    setForm({
      id: monitor.id,
      type: monitor.type,
      artist: monitor.artist,
      album: monitor.album,
      edition: monitor.edition || '',
      site: monitor.site,
      url: monitor.url,
      target_price: String(monitor.target_price).replace('.', ','),
      alert_email: monitor.alert_email || '',
      is_active: monitor.is_active
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveMonitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('Salvataggio...');
    const input: MonitorInput = {
      type: form.type,
      artist: form.artist,
      album: form.album,
      edition: form.edition || null,
      site: form.site,
      url: form.url,
      target_price: toNumberFromItalianInput(form.target_price),
      alert_email: form.alert_email || null,
      is_active: form.is_active
    };
    try {
      const response = await fetch(form.id ? `/api/monitors/${form.id}` : '/api/monitors', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Errore salvataggio');
      setForm(emptyForm);
      await loadData();
      setMessage('Monitor salvato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore salvataggio');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMonitor(id: string) {
    if (!confirm('Eliminare questo monitor?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Errore eliminazione');
      await loadData();
      setMessage('Monitor eliminato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore eliminazione');
    } finally {
      setBusy(false);
    }
  }

  async function checkOne(id: string) {
    setBusy(true);
    setMessage('Controllo prezzo in corso...');
    try {
      const response = await fetch(`/api/monitors/${id}/check`, { method: 'POST' });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Errore controllo');
      await loadData();
      setMessage('Controllo completato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore controllo');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ alert_email: settings?.alert_email || '' })
      });
      const json = await response.json() as { data?: Settings; error?: string };
      if (!response.ok) throw new Error(json.error || 'Errore impostazioni');
      setSettings(json.data || null);
      setMessage('Impostazioni salvate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore impostazioni');
    } finally {
      setBusy(false);
    }
  }

  function badge(status: LastStatus | null, current: number | null, target: number) {
    const value = status || 'never_checked';
    const cls = value === 'error' ? 'bg-red-100 text-red-800' : value === 'below_target' || (current !== null && current <= target) ? 'bg-green-100 text-green-800' : value === 'ok' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700';
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{statusLabels[value]}</span>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Music Price Monitor</h1>
        <p className="mt-2 text-slate-600">Dashboard italiana per monitorare prezzi CD/LP su Momox e Medimops.</p>
        <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">Stato: {message}</p>
      </div>

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Impostazioni globali email</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="flex-1 rounded-lg border p-2" placeholder="email@example.com" value={settings?.alert_email || ''} onChange={(event) => setSettings({ ...(settings || { id: 1, created_at: '', updated_at: '' }), alert_email: event.target.value })} />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy} onClick={saveSettings}>Salva email globale</button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{form.id ? 'Modifica monitor' : 'Nuovo monitor'}</h2>
          <button className="rounded-lg border px-4 py-2" onClick={startNew}>Nuovo monitor</button>
        </div>
        <form onSubmit={saveMonitor} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Tipo<select className="mt-1 w-full rounded-lg border p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MonitorType })}><option>CD</option><option>LP</option></select></label>
          <label className="text-sm font-medium">Artista<input required className="mt-1 w-full rounded-lg border p-2" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></label>
          <label className="text-sm font-medium">Album<input required className="mt-1 w-full rounded-lg border p-2" value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} /></label>
          <label className="text-sm font-medium">Edizione<input className="mt-1 w-full rounded-lg border p-2" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} /></label>
          <label className="text-sm font-medium">Sito<select className="mt-1 w-full rounded-lg border p-2" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value as MonitorSite })}><option>Momox</option><option>Medimops</option></select></label>
          <label className="text-sm font-medium">Prezzo target<input required className="mt-1 w-full rounded-lg border p-2" value={form.target_price} onChange={(e) => setForm({ ...form, target_price: e.target.value })} /></label>
          <label className="text-sm font-medium lg:col-span-2">URL<input required type="url" className="mt-1 w-full rounded-lg border p-2" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label className="text-sm font-medium">Email specifica<input type="email" className="mt-1 w-full rounded-lg border p-2" value={form.alert_email} onChange={(e) => setForm({ ...form, alert_email: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Attivo</label>
          <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Salva</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold">Monitor</h2>
          <div className="flex gap-2">
            <select className="rounded-lg border p-2" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}><option value="artist">Artista</option><option value="album">Album</option><option value="target_price">Prezzo target</option><option value="current_price">Prezzo attuale</option><option value="last_checked_at">Data ultimo rilievo</option></select>
            <button className="rounded-lg border px-3" onClick={() => setSortAsc(!sortAsc)}>{sortAsc ? 'Crescente' : 'Decrescente'}</button>
          </div>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          {['type','artist','album','edition','site','url','target_price','current_price','last_checked_at','is_active'].map((key) => (
            <input key={key} className="rounded-lg border p-2 text-sm" placeholder={`Filtro ${key}`} value={filters[key] || ''} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead><tr className="bg-slate-100 text-left">{['Stato','Tipo','Artista','Album','Edizione','Sito','URL','Target','Attuale','Ultimo rilievo','Attivo','Errore','Azioni'].map((h) => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((monitor) => {
                const under = monitor.current_price !== null && monitor.current_price <= monitor.target_price;
                return (
                  <tr key={monitor.id} className="border-b align-top">
                    <td className="p-2">{badge(monitor.last_status, monitor.current_price, monitor.target_price)}</td>
                    <td className="p-2">{monitor.type}</td>
                    <td className="p-2 font-medium">{monitor.artist}</td>
                    <td className="p-2">{monitor.album}</td>
                    <td className="p-2">{monitor.edition || '-'}</td>
                    <td className="p-2">{monitor.site}</td>
                    <td className="max-w-xs truncate p-2"><a className="text-blue-700 underline" href={monitor.url} target="_blank">apri</a></td>
                    <td className="p-2">{formatEuro(monitor.target_price)}</td>
                    <td className={`p-2 font-semibold ${under ? 'text-green-700' : ''}`}>{formatEuro(monitor.current_price)}</td>
                    <td className="p-2">{formatDate(monitor.last_checked_at)}</td>
                    <td className="p-2">{monitor.is_active ? 'Sì' : 'No'}</td>
                    <td className="max-w-xs p-2 text-red-700">{monitor.last_error || '-'}</td>
                    <td className="space-y-2 p-2">
                      <button className="block rounded border px-3 py-1" onClick={() => editMonitor(monitor)}>Modifica</button>
                      <button className="block rounded border px-3 py-1" disabled={busy} onClick={() => checkOne(monitor.id)}>Controlla ora</button>
                      <button className="block rounded border border-red-300 px-3 py-1 text-red-700" disabled={busy} onClick={() => deleteMonitor(monitor.id)}>Elimina</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td className="p-4 text-center text-slate-500" colSpan={13}>Nessun monitor trovato.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
```

## `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { background: #f8fafc; color: #0f172a; }
input, select, textarea { color: #0f172a; }
```

## `app/layout.tsx`

```ts
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Music Price Monitor', description: 'Monitoraggio prezzi CD e LP' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
```

## `app/page.tsx`

```ts
import Dashboard from './components/Dashboard';

export default function Home() {
  return <Dashboard />;
}
```

## `lib/email.ts`

```ts
import { Resend } from 'resend';
import type { Monitor } from './types';
import { formatEuro, formatDate } from './format';
import { env } from './env';

export async function sendPriceAlert(monitor: Monitor, detectedPrice: number, recipient: string): Promise<{ ok: boolean; error: string | null }> {
  const apiKey = env.resendApiKey();
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY mancante: email non inviata.' };

  const resend = new Resend(apiKey);
  const checkedAt = new Date().toISOString();
  const subject = `Prezzo sotto target: ${monitor.artist} - ${monitor.album}`;
  const html = `
    <h1>Prezzo sotto target</h1>
    <p>Il prezzo rilevato è minore o uguale al tuo target.</p>
    <ul>
      <li><strong>Tipo:</strong> ${escapeHtml(monitor.type)}</li>
      <li><strong>Artista:</strong> ${escapeHtml(monitor.artist)}</li>
      <li><strong>Album:</strong> ${escapeHtml(monitor.album)}</li>
      <li><strong>Edizione:</strong> ${escapeHtml(monitor.edition || '-')}</li>
      <li><strong>Sito:</strong> ${escapeHtml(monitor.site)}</li>
      <li><strong>Prezzo target:</strong> ${formatEuro(monitor.target_price)}</li>
      <li><strong>Prezzo rilevato:</strong> ${formatEuro(detectedPrice)}</li>
      <li><strong>Data rilevazione:</strong> ${formatDate(checkedAt)}</li>
    </ul>
    <p><a href="${escapeAttribute(monitor.url)}">Apri pagina prodotto</a></p>
  `;

  try {
    const result = await resend.emails.send({
      from: env.alertFromEmail(),
      to: recipient,
      subject,
      html
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Errore email sconosciuto' };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#039;');
}
```

## `lib/env.ts`

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile ambiente mancante: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  resendApiKey: () => process.env.RESEND_API_KEY || '',
  alertFromEmail: () => process.env.ALERT_FROM_EMAIL || 'Music Price Monitor <onboarding@resend.dev>',
  defaultAlertEmail: () => process.env.DEFAULT_ALERT_EMAIL || '',
  cronSecret: () => required('CRON_SECRET'),
  appBaseUrl: () => process.env.APP_BASE_URL || ''
};
```

## `lib/format.ts`

```ts
export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function toNumberFromItalianInput(value: string): number {
  const normalized = value.replace(/\s/g, '').replace('€', '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}
```

## `lib/monitor-runner.ts`

```ts
import { createServiceClient } from './supabase-server';
import { scrapePrice } from './scraper';
import { sendPriceAlert } from './email';
import type { LastStatus, Monitor, Settings } from './types';
import { env } from './env';

const WAIT_MS_BETWEEN_REQUESTS = 1200;

export interface RunSummary {
  total: number;
  checked: number;
  alertsSent: number;
  errors: number;
  details: Array<{ id: string; artist: string; album: string; status: LastStatus; message: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMonitor(options: { monitorId?: string; onlyActive?: boolean } = {}): Promise<RunSummary> {
  const supabase = createServiceClient();
  const settingsResult = await supabase.from('settings').select('*').eq('id', 1).maybeSingle<Settings>();
  const globalEmail = settingsResult.data?.alert_email || env.defaultAlertEmail();

  let query = supabase.from('monitors').select('*').order('artist', { ascending: true });
  if (options.monitorId) query = query.eq('id', options.monitorId);
  if (options.onlyActive !== false) query = query.eq('is_active', true);

  const { data, error } = await query.returns<Monitor[]>();
  if (error) throw new Error(`Errore lettura monitor: ${error.message}`);

  const monitors = data || [];
  const summary: RunSummary = { total: monitors.length, checked: 0, alertsSent: 0, errors: 0, details: [] };

  for (const monitor of monitors) {
    const checkedAt = new Date().toISOString();
    const scrape = await scrapePrice(monitor.url);
    let status: LastStatus = 'error';
    let alertSent = monitor.alert_sent;
    let message = scrape.error || 'OK';
    let emailError: string | null = null;

    if (scrape.price !== null) {
      const belowTarget = scrape.price <= monitor.target_price;
      status = belowTarget ? 'below_target' : 'ok';
      message = belowTarget ? 'Prezzo sotto target' : 'Prezzo aggiornato';
      if (!belowTarget) alertSent = false;

      if (belowTarget && !monitor.alert_sent) {
        const recipient = monitor.alert_email || globalEmail;
        if (recipient) {
          const email = await sendPriceAlert(monitor, scrape.price, recipient);
          if (email.ok) {
            alertSent = true;
            summary.alertsSent += 1;
          } else {
            emailError = email.error;
            message = `Prezzo sotto target, ma email non inviata: ${email.error}`;
          }
        } else {
          emailError = 'Nessuna email configurata';
          message = 'Prezzo sotto target, ma manca email destinatario';
        }
      }
    } else {
      summary.errors += 1;
    }

    const update = {
      current_price: scrape.price,
      last_checked_at: checkedAt,
      last_status: status,
      last_error: emailError || scrape.error,
      alert_sent: alertSent,
      updated_at: checkedAt
    };

    const { error: updateError } = await supabase.from('monitors').update(update).eq('id', monitor.id);
    if (updateError) {
      summary.errors += 1;
      message = `Errore aggiornamento DB: ${updateError.message}`;
      status = 'error';
    }

    await supabase.from('price_checks').insert({
      monitor_id: monitor.id,
      checked_at: checkedAt,
      price: scrape.price,
      status,
      error: emailError || scrape.error,
      source: scrape.source
    });

    summary.checked += 1;
    summary.details.push({ id: monitor.id, artist: monitor.artist, album: monitor.album, status, message });
    if (monitors.length > 1) await sleep(WAIT_MS_BETWEEN_REQUESTS);
  }

  return summary;
}
```

## `lib/scraper.ts`

```ts
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  price: number | null;
  source: string;
  error: string | null;
}

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  'meta[property="product:price:amount"]',
  'meta[itemprop="price"]',
  '.price',
  '.product-price',
  '[class*="price"]',
  '[data-testid*="price"]'
];

export function normalizePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[€£$]/g, '')
    .replace(/[^0-9,.-]/g, '')
    .trim();

  if (!cleaned) return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function extractFromJsonLd($: cheerio.CheerioAPI): number | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    try {
      const parsed: unknown = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of candidates) {
        const price = findOfferPrice(item);
        if (price !== null) return price;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findOfferPrice(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.price === 'string' || typeof record.price === 'number') {
    return normalizePrice(String(record.price));
  }
  const offers = record.offers;
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const price = findOfferPrice(offer);
      if (price !== null) return price;
    }
  } else if (offers && typeof offers === 'object') {
    const price = findOfferPrice(offers);
    if (price !== null) return price;
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const price = findOfferPrice(nested);
      if (price !== null) return price;
    }
  }
  return null;
}

function extractWithSelectors($: cheerio.CheerioAPI): number | null {
  for (const selector of PRICE_SELECTORS) {
    const nodes = $(selector).toArray().slice(0, 20);
    for (const node of nodes) {
      const element = $(node);
      const content = element.attr('content') || element.attr('value') || element.text();
      const price = normalizePrice(content);
      if (price !== null) return price;
    }
  }
  return null;
}

function extractWithRegex(html: string): number | null {
  const patterns = [
    /(?:price|preis|prix)[^0-9]{0,80}(\d{1,4}(?:[.,]\d{2}))/i,
    /(\d{1,4}(?:[.,]\d{2}))\s*€/i,
    /€\s*(\d{1,4}(?:[.,]\d{2}))/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const price = normalizePrice(match[1]);
      if (price !== null) return price;
    }
  }
  return null;
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36 MusicPriceMonitor/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8,fr;q=0.7,de;q=0.7'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return { price: null, source: 'http', error: `HTTP ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selected = extractWithSelectors($);
    if (selected !== null) return { price: selected, source: 'css', error: null };

    const jsonLd = extractFromJsonLd($);
    if (jsonLd !== null) return { price: jsonLd, source: 'json-ld', error: null };

    const regex = extractWithRegex(html);
    if (regex !== null) return { price: regex, source: 'regex', error: null };

    return { price: null, source: 'none', error: 'Prezzo non trovato nell’HTML della pagina.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto durante scraping';
    return { price: null, source: 'exception', error: message };
  }
}
```

## `lib/supabase-server.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export function createServiceClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
```

## `lib/types.ts`

```ts
export type MonitorType = 'CD' | 'LP';
export type MonitorSite = 'Medimops' | 'Momox';
export type LastStatus = 'never_checked' | 'ok' | 'below_target' | 'error';

export interface Monitor {
  id: string;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string | null;
  site: MonitorSite;
  url: string;
  target_price: number;
  current_price: number | null;
  last_checked_at: string | null;
  last_status: LastStatus | null;
  last_error: string | null;
  alert_email: string | null;
  alert_sent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  alert_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceCheck {
  monitor_id: string;
  checked_at: string;
  price: number | null;
  status: LastStatus;
  error: string | null;
}

export interface MonitorInput {
  type: MonitorType;
  artist: string;
  album: string;
  edition?: string | null;
  site: MonitorSite;
  url: string;
  target_price: number;
  alert_email?: string | null;
  is_active: boolean;
}
```

## `lib/validation.ts`

```ts
import { z } from 'zod';

export const monitorSchema = z.object({
  type: z.enum(['CD', 'LP']),
  artist: z.string().trim().min(1, 'Artista obbligatorio').max(200),
  album: z.string().trim().min(1, 'Album obbligatorio').max(250),
  edition: z.string().trim().max(250).nullable().optional(),
  site: z.enum(['Medimops', 'Momox']),
  url: z.string().trim().url('URL non valido').refine((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host.includes('momox') || host.includes('medimops');
    } catch {
      return false;
    }
  }, 'Inserisci un URL Momox o Medimops'),
  target_price: z.coerce.number().positive('Prezzo target obbligatorio').max(999999.99),
  alert_email: z.string().trim().email('Email non valida').nullable().optional().or(z.literal('')),
  is_active: z.boolean().default(true)
});

export function cleanMonitorInput(input: unknown) {
  const parsed = monitorSchema.parse(input);
  return {
    ...parsed,
    edition: parsed.edition ? parsed.edition : null,
    alert_email: parsed.alert_email ? parsed.alert_email : null,
    target_price: Number(parsed.target_price.toFixed(2))
  };
}
```

## `next-env.d.ts`

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

## `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
```

## `package.json`

```json
{"name":"music-price-monitor","version":"1.0.0","private":true,"scripts":{"dev":"next dev","build":"next build","start":"next start","lint":"next lint","monitor":"tsx scripts/run-monitor.ts","typecheck":"tsc --noEmit"},"dependencies":{"@supabase/supabase-js":"^2.45.4","cheerio":"^1.0.0","next":"^14.2.15","react":"^18.3.1","react-dom":"^18.3.1","resend":"^4.0.0","zod":"^3.23.8"},"devDependencies":{"@types/node":"^22.7.4","@types/react":"^18.3.11","@types/react-dom":"^18.3.1","autoprefixer":"^10.4.20","eslint":"^8.57.1","eslint-config-next":"^14.2.15","postcss":"^8.4.47","tailwindcss":"^3.4.13","tsx":"^4.19.1","typescript":"^5.6.2"}}
```

## `postcss.config.js`

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

## `scripts/run-monitor.ts`

```ts
import { runMonitor } from '../lib/monitor-runner';

async function main() {
  console.log(`[monitor] Avvio ${new Date().toISOString()}`);
  const summary = await runMonitor({ onlyActive: true });
  console.log(`[monitor] Totale: ${summary.total}`);
  console.log(`[monitor] Controllati: ${summary.checked}`);
  console.log(`[monitor] Alert inviati: ${summary.alertsSent}`);
  console.log(`[monitor] Errori: ${summary.errors}`);
  for (const detail of summary.details) {
    console.log(`[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`);
  }
}

main().catch((error: unknown) => {
  console.error('[monitor] Errore fatale', error instanceof Error ? error.message : error);
  process.exit(1);
});
```

## `supabase/schema.sql`

```sql
create extension if not exists pgcrypto;

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('CD', 'LP')),
  artist text not null,
  album text not null,
  edition text,
  site text not null check (site in ('Medimops', 'Momox')),
  url text not null,
  target_price numeric(10,2) not null check (target_price > 0),
  current_price numeric(10,2),
  last_checked_at timestamptz,
  last_status text default 'never_checked' check (last_status in ('never_checked', 'ok', 'below_target', 'error')),
  last_error text,
  alert_email text,
  alert_sent boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  alert_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id, alert_email)
values (1, null)
on conflict (id) do nothing;

create table if not exists public.price_checks (
  id bigint generated by default as identity primary key,
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  checked_at timestamptz not null default now(),
  price numeric(10,2),
  status text not null check (status in ('never_checked', 'ok', 'below_target', 'error')),
  error text,
  source text
);

create index if not exists monitors_artist_idx on public.monitors (artist);
create index if not exists monitors_album_idx on public.monitors (album);
create index if not exists monitors_active_idx on public.monitors (is_active);
create index if not exists price_checks_monitor_checked_idx on public.price_checks (monitor_id, checked_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monitors_set_updated_at on public.monitors;
create trigger monitors_set_updated_at
before update on public.monitors
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- Uso personale: l'app accede a Supabase solo lato server con service role key.
-- Per semplicità RLS resta disabilitata. Non esporre mai SUPABASE_SERVICE_ROLE_KEY nel browser.
alter table public.monitors disable row level security;
alter table public.settings disable row level security;
alter table public.price_checks disable row level security;
```

## `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };
export default config;
```

## `tsconfig.json`

```json
{"compilerOptions":{"lib":["dom","dom.iterable","es2022"],"allowJs":false,"skipLibCheck":true,"strict":true,"noEmit":true,"esModuleInterop":true,"module":"esnext","moduleResolution":"bundler","resolveJsonModule":true,"isolatedModules":true,"jsx":"preserve","incremental":true,"plugins":[{"name":"next"}],"paths":{"@/*":["./*"]}},"include":["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],"exclude":["node_modules"]}
```

## `tsconfig.tsbuildinfo`

```
{"fileNames":["./node_modules/typescript/lib/lib.es5.d.ts","./node_modules/typescript/lib/lib.es2015.d.ts","./node_modules/typescript/lib/lib.es2016.d.ts","./node_modules/typescript/lib/lib.es2017.d.ts","./node_modules/typescript/lib/lib.es2018.d.ts","./node_modules/typescript/lib/lib.es2019.d.ts","./node_modules/typescript/lib/lib.es2020.d.ts","./node_modules/typescript/lib/lib.es2021.d.ts","./node_modules/typescript/lib/lib.es2022.d.ts","./node_modules/typescript/lib/lib.dom.d.ts","./node_modules/typescript/lib/lib.dom.iterable.d.ts","./node_modules/typescript/lib/lib.es2015.core.d.ts","./node_modules/typescript/lib/lib.es2015.collection.d.ts","./node_modules/typescript/lib/lib.es2015.generator.d.ts","./node_modules/typescript/lib/lib.es2015.iterable.d.ts","./node_modules/typescript/lib/lib.es2015.promise.d.ts","./node_modules/typescript/lib/lib.es2015.proxy.d.ts","./node_modules/typescript/lib/lib.es2015.reflect.d.ts","./node_modules/typescript/lib/lib.es2015.symbol.d.ts","./node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts","./node_modules/typescript/lib/lib.es2016.array.include.d.ts","./node_modules/typescript/lib/lib.es2016.intl.d.ts","./node_modules/typescript/lib/lib.es2017.arraybuffer.d.ts","./node_modules/typescript/lib/lib.es2017.date.d.ts","./node_modules/typescript/lib/lib.es2017.object.d.ts","./node_modules/typescript/lib/lib.es2017.sharedmemory.d.ts","./node_modules/typescript/lib/lib.es2017.string.d.ts","./node_modules/typescript/lib/lib.es2017.intl.d.ts","./node_modules/typescript/lib/lib.es2017.typedarrays.d.ts","./node_modules/typescript/lib/lib.es2018.asyncgenerator.d.ts","./node_modules/typescript/lib/lib.es2018.asynciterable.d.ts","./node_modules/typescript/lib/lib.es2018.intl.d.ts","./node_modules/typescript/lib/lib.es2018.promise.d.ts","./node_modules/typescript/lib/lib.es2018.regexp.d.ts","./node_modules/typescript/lib/lib.es2019.array.d.ts","./node_modules/typescript/lib/lib.es2019.object.d.ts","./node_modules/typescript/lib/lib.es2019.string.d.ts","./node_modules/typescript/lib/lib.es2019.symbol.d.ts","./node_modules/typescript/lib/lib.es2019.intl.d.ts","./node_modules/typescript/lib/lib.es2020.bigint.d.ts","./node_modules/typescript/lib/lib.es2020.date.d.ts","./node_modules/typescript/lib/lib.es2020.promise.d.ts","./node_modules/typescript/lib/lib.es2020.sharedmemory.d.ts","./node_modules/typescript/lib/lib.es2020.string.d.ts","./node_modules/typescript/lib/lib.es2020.symbol.wellknown.d.ts","./node_modules/typescript/lib/lib.es2020.intl.d.ts","./node_modules/typescript/lib/lib.es2020.number.d.ts","./node_modules/typescript/lib/lib.es2021.promise.d.ts","./node_modules/typescript/lib/lib.es2021.string.d.ts","./node_modules/typescript/lib/lib.es2021.weakref.d.ts","./node_modules/typescript/lib/lib.es2021.intl.d.ts","./node_modules/typescript/lib/lib.es2022.array.d.ts","./node_modules/typescript/lib/lib.es2022.error.d.ts","./node_modules/typescript/lib/lib.es2022.intl.d.ts","./node_modules/typescript/lib/lib.es2022.object.d.ts","./node_modules/typescript/lib/lib.es2022.string.d.ts","./node_modules/typescript/lib/lib.es2022.regexp.d.ts","./node_modules/typescript/lib/lib.decorators.d.ts","./node_modules/typescript/lib/lib.decorators.legacy.d.ts","./node_modules/next/dist/styled-jsx/types/css.d.ts","./node_modules/@types/react/global.d.ts","./node_modules/csstype/index.d.ts","./node_modules/@types/prop-types/index.d.ts","./node_modules/@types/react/index.d.ts","./node_modules/next/dist/styled-jsx/types/index.d.ts","./node_modules/next/dist/styled-jsx/types/macro.d.ts","./node_modules/next/dist/styled-jsx/types/style.d.ts","./node_modules/next/dist/styled-jsx/types/global.d.ts","./node_modules/next/dist/shared/lib/amp.d.ts","./node_modules/next/amp.d.ts","./node_modules/@types/node/compatibility/disposable.d.ts","./node_modules/@types/node/compatibility/indexable.d.ts","./node_modules/@types/node/compatibility/iterators.d.ts","./node_modules/@types/node/compatibility/index.d.ts","./node_modules/@types/node/globals.typedarray.d.ts","./node_modules/@types/node/buffer.buffer.d.ts","./node_modules/@types/node/globals.d.ts","./node_modules/@types/node/web-globals/abortcontroller.d.ts","./node_modules/@types/node/web-globals/domexception.d.ts","./node_modules/@types/node/web-globals/events.d.ts","./node_modules/undici-types/header.d.ts","./node_modules/undici-types/readable.d.ts","./node_modules/undici-types/file.d.ts","./node_modules/undici-types/fetch.d.ts","./node_modules/undici-types/formdata.d.ts","./node_modules/undici-types/connector.d.ts","./node_modules/undici-types/client.d.ts","./node_modules/undici-types/errors.d.ts","./node_modules/undici-types/dispatcher.d.ts","./node_modules/undici-types/global-dispatcher.d.ts","./node_modules/undici-types/global-origin.d.ts","./node_modules/undici-types/pool-stats.d.ts","./node_modules/undici-types/pool.d.ts","./node_modules/undici-types/handlers.d.ts","./node_modules/undici-types/balanced-pool.d.ts","./node_modules/undici-types/agent.d.ts","./node_modules/undici-types/mock-interceptor.d.ts","./node_modules/undici-types/mock-agent.d.ts","./node_modules/undici-types/mock-client.d.ts","./node_modules/undici-types/mock-pool.d.ts","./node_modules/undici-types/mock-errors.d.ts","./node_modules/undici-types/proxy-agent.d.ts","./node_modules/undici-types/env-http-proxy-agent.d.ts","./node_modules/undici-types/retry-handler.d.ts","./node_modules/undici-types/retry-agent.d.ts","./node_modules/undici-types/api.d.ts","./node_modules/undici-types/interceptors.d.ts","./node_modules/undici-types/util.d.ts","./node_modules/undici-types/cookies.d.ts","./node_modules/undici-types/patch.d.ts","./node_modules/undici-types/websocket.d.ts","./node_modules/undici-types/eventsource.d.ts","./node_modules/undici-types/filereader.d.ts","./node_modules/undici-types/diagnostics-channel.d.ts","./node_modules/undici-types/content-type.d.ts","./node_modules/undici-types/cache.d.ts","./node_modules/undici-types/index.d.ts","./node_modules/@types/node/web-globals/fetch.d.ts","./node_modules/@types/node/web-globals/navigator.d.ts","./node_modules/@types/node/web-globals/storage.d.ts","./node_modules/@types/node/web-globals/streams.d.ts","./node_modules/@types/node/assert.d.ts","./node_modules/@types/node/assert/strict.d.ts","./node_modules/@types/node/async_hooks.d.ts","./node_modules/@types/node/buffer.d.ts","./node_modules/@types/node/child_process.d.ts","./node_modules/@types/node/cluster.d.ts","./node_modules/@types/node/console.d.ts","./node_modules/@types/node/constants.d.ts","./node_modules/@types/node/crypto.d.ts","./node_modules/@types/node/dgram.d.ts","./node_modules/@types/node/diagnostics_channel.d.ts","./node_modules/@types/node/dns.d.ts","./node_modules/@types/node/dns/promises.d.ts","./node_modules/@types/node/domain.d.ts","./node_modules/@types/node/events.d.ts","./node_modules/@types/node/fs.d.ts","./node_modules/@types/node/fs/promises.d.ts","./node_modules/@types/node/http.d.ts","./node_modules/@types/node/http2.d.ts","./node_modules/@types/node/https.d.ts","./node_modules/@types/node/inspector.d.ts","./node_modules/@types/node/inspector.generated.d.ts","./node_modules/@types/node/module.d.ts","./node_modules/@types/node/net.d.ts","./node_modules/@types/node/os.d.ts","./node_modules/@types/node/path.d.ts","./node_modules/@types/node/perf_hooks.d.ts","./node_modules/@types/node/process.d.ts","./node_modules/@types/node/punycode.d.ts","./node_modules/@types/node/querystring.d.ts","./node_modules/@types/node/readline.d.ts","./node_modules/@types/node/readline/promises.d.ts","./node_modules/@types/node/repl.d.ts","./node_modules/@types/node/sea.d.ts","./node_modules/@types/node/sqlite.d.ts","./node_modules/@types/node/stream.d.ts","./node_modules/@types/node/stream/promises.d.ts","./node_modules/@types/node/stream/consumers.d.ts","./node_modules/@types/node/stream/web.d.ts","./node_modules/@types/node/string_decoder.d.ts","./node_modules/@types/node/test.d.ts","./node_modules/@types/node/timers.d.ts","./node_modules/@types/node/timers/promises.d.ts","./node_modules/@types/node/tls.d.ts","./node_modules/@types/node/trace_events.d.ts","./node_modules/@types/node/tty.d.ts","./node_modules/@types/node/url.d.ts","./node_modules/@types/node/util.d.ts","./node_modules/@types/node/v8.d.ts","./node_modules/@types/node/vm.d.ts","./node_modules/@types/node/wasi.d.ts","./node_modules/@types/node/worker_threads.d.ts","./node_modules/@types/node/zlib.d.ts","./node_modules/@types/node/index.d.ts","./node_modules/next/dist/server/get-page-files.d.ts","./node_modules/@types/react/canary.d.ts","./node_modules/@types/react/experimental.d.ts","./node_modules/@types/react-dom/index.d.ts","./node_modules/@types/react-dom/canary.d.ts","./node_modules/@types/react-dom/experimental.d.ts","./node_modules/next/dist/compiled/webpack/webpack.d.ts","./node_modules/next/dist/server/config.d.ts","./node_modules/next/dist/lib/load-custom-routes.d.ts","./node_modules/next/dist/shared/lib/image-config.d.ts","./node_modules/next/dist/build/webpack/plugins/subresource-integrity-plugin.d.ts","./node_modules/next/dist/server/body-streams.d.ts","./node_modules/next/dist/server/future/route-kind.d.ts","./node_modules/next/dist/server/future/route-definitions/route-definition.d.ts","./node_modules/next/dist/server/future/route-matches/route-match.d.ts","./node_modules/next/dist/client/components/app-router-headers.d.ts","./node_modules/next/dist/server/request-meta.d.ts","./node_modules/next/dist/server/lib/revalidate.d.ts","./node_modules/next/dist/server/config-shared.d.ts","./node_modules/next/dist/server/base-http/index.d.ts","./node_modules/next/dist/server/api-utils/index.d.ts","./node_modules/next/dist/server/node-environment.d.ts","./node_modules/next/dist/server/require-hook.d.ts","./node_modules/next/dist/server/node-polyfill-crypto.d.ts","./node_modules/next/dist/lib/page-types.d.ts","./node_modules/next/dist/build/analysis/get-page-static-info.d.ts","./node_modules/next/dist/build/webpack/loaders/get-module-build-info.d.ts","./node_modules/next/dist/build/webpack/plugins/middleware-plugin.d.ts","./node_modules/next/dist/server/render-result.d.ts","./node_modules/next/dist/server/future/helpers/i18n-provider.d.ts","./node_modules/next/dist/server/web/next-url.d.ts","./node_modules/next/dist/compiled/@edge-runtime/cookies/index.d.ts","./node_modules/next/dist/server/web/spec-extension/cookies.d.ts","./node_modules/next/dist/server/web/spec-extension/request.d.ts","./node_modules/next/dist/server/web/spec-extension/fetch-event.d.ts","./node_modules/next/dist/server/web/spec-extension/response.d.ts","./node_modules/next/dist/server/web/types.d.ts","./node_modules/next/dist/lib/setup-exception-listeners.d.ts","./node_modules/next/dist/lib/constants.d.ts","./node_modules/next/dist/build/index.d.ts","./node_modules/next/dist/build/webpack/plugins/pages-manifest-plugin.d.ts","./node_modules/next/dist/shared/lib/router/utils/route-regex.d.ts","./node_modules/next/dist/shared/lib/router/utils/route-matcher.d.ts","./node_modules/next/dist/shared/lib/router/utils/parse-url.d.ts","./node_modules/next/dist/server/base-http/node.d.ts","./node_modules/next/dist/server/font-utils.d.ts","./node_modules/next/dist/build/webpack/plugins/flight-manifest-plugin.d.ts","./node_modules/next/dist/server/future/route-modules/route-module.d.ts","./node_modules/next/dist/shared/lib/deep-readonly.d.ts","./node_modules/next/dist/server/load-components.d.ts","./node_modules/next/dist/shared/lib/router/utils/middleware-route-matcher.d.ts","./node_modules/next/dist/build/webpack/plugins/next-font-manifest-plugin.d.ts","./node_modules/next/dist/server/future/route-definitions/locale-route-definition.d.ts","./node_modules/next/dist/server/future/route-definitions/pages-route-definition.d.ts","./node_modules/next/dist/shared/lib/mitt.d.ts","./node_modules/next/dist/client/with-router.d.ts","./node_modules/next/dist/client/router.d.ts","./node_modules/next/dist/client/route-loader.d.ts","./node_modules/next/dist/client/page-loader.d.ts","./node_modules/next/dist/shared/lib/bloom-filter.d.ts","./node_modules/next/dist/shared/lib/router/router.d.ts","./node_modules/next/dist/shared/lib/router-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/loadable-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/loadable.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/image-config-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-definitions/app-page-route-definition.d.ts","./node_modules/next/dist/shared/lib/modern-browserslist-target.d.ts","./node_modules/next/dist/shared/lib/constants.d.ts","./node_modules/next/dist/build/webpack/loaders/metadata/types.d.ts","./node_modules/next/dist/build/page-extensions-type.d.ts","./node_modules/next/dist/build/webpack/loaders/next-app-loader.d.ts","./node_modules/next/dist/server/lib/app-dir-module.d.ts","./node_modules/next/dist/server/response-cache/types.d.ts","./node_modules/next/dist/server/response-cache/index.d.ts","./node_modules/next/dist/server/lib/incremental-cache/index.d.ts","./node_modules/next/dist/client/components/hooks-server-context.d.ts","./node_modules/next/dist/server/app-render/dynamic-rendering.d.ts","./node_modules/next/dist/client/components/static-generation-async-storage-instance.d.ts","./node_modules/next/dist/client/components/static-generation-async-storage.external.d.ts","./node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.d.ts","./node_modules/next/dist/server/async-storage/draft-mode-provider.d.ts","./node_modules/next/dist/server/web/spec-extension/adapters/headers.d.ts","./node_modules/next/dist/client/components/request-async-storage-instance.d.ts","./node_modules/next/dist/client/components/request-async-storage.external.d.ts","./node_modules/next/dist/server/app-render/create-error-handler.d.ts","./node_modules/next/dist/server/app-render/app-render.d.ts","./node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/amp-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/vendored/contexts/entrypoints.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/module.compiled.d.ts","./node_modules/@types/react/jsx-runtime.d.ts","./node_modules/next/dist/client/components/error-boundary.d.ts","./node_modules/next/dist/client/components/router-reducer/create-initial-router-state.d.ts","./node_modules/next/dist/client/components/app-router.d.ts","./node_modules/next/dist/client/components/layout-router.d.ts","./node_modules/next/dist/client/components/render-from-template-context.d.ts","./node_modules/next/dist/client/components/action-async-storage-instance.d.ts","./node_modules/next/dist/client/components/action-async-storage.external.d.ts","./node_modules/next/dist/client/components/client-page.d.ts","./node_modules/next/dist/client/components/search-params.d.ts","./node_modules/next/dist/client/components/not-found-boundary.d.ts","./node_modules/next/dist/server/app-render/rsc/preloads.d.ts","./node_modules/next/dist/server/app-render/rsc/postpone.d.ts","./node_modules/next/dist/server/app-render/rsc/taint.d.ts","./node_modules/next/dist/server/app-render/entry-base.d.ts","./node_modules/next/dist/build/templates/app-page.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/module.d.ts","./node_modules/next/dist/server/lib/builtin-request-context.d.ts","./node_modules/next/dist/server/app-render/types.d.ts","./node_modules/next/dist/client/components/router-reducer/fetch-server-response.d.ts","./node_modules/next/dist/client/components/router-reducer/router-reducer-types.d.ts","./node_modules/next/dist/shared/lib/app-router-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-modules/pages/vendored/contexts/entrypoints.d.ts","./node_modules/next/dist/server/future/route-modules/pages/module.compiled.d.ts","./node_modules/next/dist/build/templates/pages.d.ts","./node_modules/next/dist/server/future/route-modules/pages/module.d.ts","./node_modules/next/dist/server/render.d.ts","./node_modules/next/dist/server/future/route-definitions/pages-api-route-definition.d.ts","./node_modules/next/dist/server/future/route-matches/pages-api-route-match.d.ts","./node_modules/next/dist/server/future/route-matchers/route-matcher.d.ts","./node_modules/next/dist/server/future/route-matcher-providers/route-matcher-provider.d.ts","./node_modules/next/dist/server/future/route-matcher-managers/route-matcher-manager.d.ts","./node_modules/next/dist/server/future/normalizers/normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/locale-route-normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/request/pathname-normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/request/suffix.d.ts","./node_modules/next/dist/server/future/normalizers/request/rsc.d.ts","./node_modules/next/dist/server/future/normalizers/request/prefix.d.ts","./node_modules/next/dist/server/future/normalizers/request/postponed.d.ts","./node_modules/next/dist/server/future/normalizers/request/action.d.ts","./node_modules/next/dist/server/future/normalizers/request/prefetch-rsc.d.ts","./node_modules/next/dist/server/future/normalizers/request/next-data.d.ts","./node_modules/next/dist/server/base-server.d.ts","./node_modules/next/dist/server/image-optimizer.d.ts","./node_modules/next/dist/server/next-server.d.ts","./node_modules/next/dist/lib/coalesced-function.d.ts","./node_modules/next/dist/server/lib/router-utils/types.d.ts","./node_modules/next/dist/trace/types.d.ts","./node_modules/next/dist/trace/trace.d.ts","./node_modules/next/dist/trace/shared.d.ts","./node_modules/next/dist/trace/index.d.ts","./node_modules/next/dist/build/load-jsconfig.d.ts","./node_modules/next/dist/build/webpack-config.d.ts","./node_modules/next/dist/build/webpack/plugins/define-env-plugin.d.ts","./node_modules/next/dist/build/swc/index.d.ts","./node_modules/next/dist/server/dev/parse-version-info.d.ts","./node_modules/next/dist/server/dev/hot-reloader-types.d.ts","./node_modules/next/dist/telemetry/storage.d.ts","./node_modules/next/dist/server/lib/types.d.ts","./node_modules/next/dist/server/lib/render-server.d.ts","./node_modules/next/dist/server/lib/router-server.d.ts","./node_modules/next/dist/shared/lib/router/utils/path-match.d.ts","./node_modules/next/dist/server/lib/router-utils/filesystem.d.ts","./node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.d.ts","./node_modules/next/dist/server/lib/dev-bundler-service.d.ts","./node_modules/next/dist/server/dev/static-paths-worker.d.ts","./node_modules/next/dist/server/dev/next-dev-server.d.ts","./node_modules/next/dist/server/next.d.ts","./node_modules/next/dist/lib/metadata/types/alternative-urls-types.d.ts","./node_modules/next/dist/lib/metadata/types/extra-types.d.ts","./node_modules/next/dist/lib/metadata/types/metadata-types.d.ts","./node_modules/next/dist/lib/metadata/types/manifest-types.d.ts","./node_modules/next/dist/lib/metadata/types/opengraph-types.d.ts","./node_modules/next/dist/lib/metadata/types/twitter-types.d.ts","./node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts","./node_modules/next/types/index.d.ts","./node_modules/next/dist/shared/lib/html-context.shared-runtime.d.ts","./node_modules/@next/env/dist/index.d.ts","./node_modules/next/dist/shared/lib/utils.d.ts","./node_modules/next/dist/pages/_app.d.ts","./node_modules/next/app.d.ts","./node_modules/next/dist/server/web/spec-extension/unstable-cache.d.ts","./node_modules/next/dist/server/web/spec-extension/revalidate.d.ts","./node_modules/next/dist/server/web/spec-extension/unstable-no-store.d.ts","./node_modules/next/cache.d.ts","./node_modules/next/dist/shared/lib/runtime-config.external.d.ts","./node_modules/next/config.d.ts","./node_modules/next/dist/pages/_document.d.ts","./node_modules/next/document.d.ts","./node_modules/next/dist/shared/lib/dynamic.d.ts","./node_modules/next/dynamic.d.ts","./node_modules/next/dist/pages/_error.d.ts","./node_modules/next/error.d.ts","./node_modules/next/dist/shared/lib/head.d.ts","./node_modules/next/head.d.ts","./node_modules/next/dist/client/components/draft-mode.d.ts","./node_modules/next/dist/client/components/headers.d.ts","./node_modules/next/headers.d.ts","./node_modules/next/dist/shared/lib/get-img-props.d.ts","./node_modules/next/dist/client/image-component.d.ts","./node_modules/next/dist/shared/lib/image-external.d.ts","./node_modules/next/image.d.ts","./node_modules/next/dist/client/link.d.ts","./node_modules/next/link.d.ts","./node_modules/next/dist/client/components/redirect-status-code.d.ts","./node_modules/next/dist/client/components/redirect.d.ts","./node_modules/next/dist/client/components/not-found.d.ts","./node_modules/next/dist/client/components/navigation.react-server.d.ts","./node_modules/next/dist/client/components/navigation.d.ts","./node_modules/next/navigation.d.ts","./node_modules/next/router.d.ts","./node_modules/next/dist/client/script.d.ts","./node_modules/next/script.d.ts","./node_modules/next/dist/server/web/spec-extension/user-agent.d.ts","./node_modules/next/dist/compiled/@edge-runtime/primitives/url.d.ts","./node_modules/next/dist/server/web/spec-extension/image-response.d.ts","./node_modules/next/dist/compiled/@vercel/og/satori/index.d.ts","./node_modules/next/dist/compiled/@vercel/og/emoji/index.d.ts","./node_modules/next/dist/compiled/@vercel/og/types.d.ts","./node_modules/next/server.d.ts","./node_modules/next/types/global.d.ts","./node_modules/next/types/compiled.d.ts","./node_modules/next/index.d.ts","./node_modules/next/image-types/global.d.ts","./next-env.d.ts","./node_modules/source-map-js/source-map.d.ts","./node_modules/postcss/lib/previous-map.d.ts","./node_modules/postcss/lib/input.d.ts","./node_modules/postcss/lib/css-syntax-error.d.ts","./node_modules/postcss/lib/declaration.d.ts","./node_modules/postcss/lib/root.d.ts","./node_modules/postcss/lib/warning.d.ts","./node_modules/postcss/lib/lazy-result.d.ts","./node_modules/postcss/lib/no-work-result.d.ts","./node_modules/postcss/lib/processor.d.ts","./node_modules/postcss/lib/result.d.ts","./node_modules/postcss/lib/document.d.ts","./node_modules/postcss/lib/rule.d.ts","./node_modules/postcss/lib/node.d.ts","./node_modules/postcss/lib/comment.d.ts","./node_modules/postcss/lib/container.d.ts","./node_modules/postcss/lib/at-rule.d.ts","./node_modules/postcss/lib/list.d.ts","./node_modules/postcss/lib/postcss.d.ts","./node_modules/postcss/lib/postcss.d.mts","./node_modules/tailwindcss/types/generated/corePluginList.d.ts","./node_modules/tailwindcss/types/generated/colors.d.ts","./node_modules/tailwindcss/types/config.d.ts","./node_modules/tailwindcss/types/index.d.ts","./tailwind.config.ts","./node_modules/@supabase/functions-js/dist/module/types.d.ts","./node_modules/@supabase/functions-js/dist/module/FunctionsClient.d.ts","./node_modules/@supabase/functions-js/dist/module/index.d.ts","./node_modules/@supabase/postgrest-js/dist/index.d.mts","./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.d.ts","./node_modules/@supabase/realtime-js/dist/module/lib/serializer.d.ts","./node_modules/@supabase/phoenix/priv/static/types/constants.d.ts","./node_modules/@supabase/phoenix/priv/static/types/longpoll.d.ts","./node_modules/@supabase/phoenix/priv/static/types/types.d.ts","./node_modules/@supabase/phoenix/priv/static/types/timer.d.ts","./node_modules/@supabase/phoenix/priv/static/types/socket.d.ts","./node_modules/@supabase/phoenix/priv/static/types/push.d.ts","./node_modules/@supabase/phoenix/priv/static/types/channel.d.ts","./node_modules/@supabase/phoenix/priv/static/types/presence.d.ts","./node_modules/@supabase/phoenix/priv/static/types/serializer.d.ts","./node_modules/@supabase/phoenix/priv/static/types/index.d.ts","./node_modules/@supabase/realtime-js/dist/module/phoenix/types.d.ts","./node_modules/@supabase/realtime-js/dist/module/lib/constants.d.ts","./node_modules/@supabase/realtime-js/dist/module/RealtimePresence.d.ts","./node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.d.ts","./node_modules/@supabase/realtime-js/dist/module/RealtimeClient.d.ts","./node_modules/@supabase/realtime-js/dist/module/index.d.ts","./node_modules/iceberg-js/dist/index.d.ts","./node_modules/@supabase/storage-js/dist/index.d.mts","./node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/errors.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/web3/solana.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/webauthn.dom.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/helpers.d.ts","./node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/webauthn.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/types.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/fetch.d.ts","./node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts","./node_modules/@supabase/auth-js/dist/module/AuthAdminApi.d.ts","./node_modules/@supabase/auth-js/dist/module/AuthClient.d.ts","./node_modules/@supabase/auth-js/dist/module/lib/locks.d.ts","./node_modules/@supabase/auth-js/dist/module/index.d.ts","./node_modules/@supabase/supabase-js/dist/index.d.mts","./lib/env.ts","./lib/supabase-server.ts","./node_modules/domelementtype/lib/esm/index.d.ts","./node_modules/domhandler/lib/esm/node.d.ts","./node_modules/domhandler/lib/esm/index.d.ts","./node_modules/htmlparser2/dist/esm/Tokenizer.d.ts","./node_modules/htmlparser2/dist/esm/Parser.d.ts","./node_modules/dom-serializer/lib/esm/index.d.ts","./node_modules/domutils/lib/esm/stringify.d.ts","./node_modules/domutils/lib/esm/traversal.d.ts","./node_modules/domutils/lib/esm/manipulation.d.ts","./node_modules/domutils/lib/esm/querying.d.ts","./node_modules/domutils/lib/esm/legacy.d.ts","./node_modules/domutils/lib/esm/helpers.d.ts","./node_modules/domutils/lib/esm/feeds.d.ts","./node_modules/domutils/lib/esm/index.d.ts","./node_modules/htmlparser2/dist/esm/index.d.ts","./node_modules/parse5/dist/common/html.d.ts","./node_modules/parse5/dist/common/token.d.ts","./node_modules/parse5/dist/common/error-codes.d.ts","./node_modules/parse5/dist/tokenizer/preprocessor.d.ts","./node_modules/parse5/node_modules/entities/dist/esm/generated/decode-data-html.d.ts","./node_modules/parse5/node_modules/entities/dist/esm/generated/decode-data-xml.d.ts","./node_modules/parse5/node_modules/entities/dist/esm/decode-codepoint.d.ts","./node_modules/parse5/node_modules/entities/dist/esm/decode.d.ts","./node_modules/parse5/dist/tokenizer/index.d.ts","./node_modules/parse5/dist/tree-adapters/interface.d.ts","./node_modules/parse5/dist/parser/open-element-stack.d.ts","./node_modules/parse5/dist/parser/formatting-element-list.d.ts","./node_modules/parse5/dist/parser/index.d.ts","./node_modules/parse5/dist/tree-adapters/default.d.ts","./node_modules/parse5/dist/serializer/index.d.ts","./node_modules/parse5/dist/common/foreign-content.d.ts","./node_modules/parse5/dist/index.d.ts","./node_modules/parse5-htmlparser2-tree-adapter/dist/index.d.ts","./node_modules/css-what/lib/es/types.d.ts","./node_modules/css-what/lib/es/parse.d.ts","./node_modules/css-what/lib/es/stringify.d.ts","./node_modules/css-what/lib/es/index.d.ts","./node_modules/css-select/lib/esm/types.d.ts","./node_modules/css-select/lib/esm/pseudo-selectors/filters.d.ts","./node_modules/css-select/lib/esm/pseudo-selectors/pseudos.d.ts","./node_modules/css-select/lib/esm/pseudo-selectors/aliases.d.ts","./node_modules/css-select/lib/esm/pseudo-selectors/index.d.ts","./node_modules/css-select/lib/esm/index.d.ts","./node_modules/cheerio-select/lib/esm/index.d.ts","./node_modules/cheerio/dist/esm/options.d.ts","./node_modules/cheerio/dist/esm/api/attributes.d.ts","./node_modules/cheerio/dist/esm/api/traversing.d.ts","./node_modules/cheerio/dist/esm/api/manipulation.d.ts","./node_modules/cheerio/dist/esm/api/css.d.ts","./node_modules/cheerio/dist/esm/api/forms.d.ts","./node_modules/cheerio/dist/esm/api/extract.d.ts","./node_modules/cheerio/dist/esm/cheerio.d.ts","./node_modules/cheerio/dist/esm/types.d.ts","./node_modules/cheerio/dist/esm/static.d.ts","./node_modules/cheerio/dist/esm/load.d.ts","./node_modules/cheerio/dist/esm/load-parse.d.ts","./node_modules/cheerio/dist/esm/slim.d.ts","./node_modules/encoding-sniffer/dist/esm/sniffer.d.ts","./node_modules/encoding-sniffer/dist/esm/index.d.ts","./node_modules/undici/types/utility.d.ts","./node_modules/undici/types/header.d.ts","./node_modules/undici/types/readable.d.ts","./node_modules/undici/types/fetch.d.ts","./node_modules/undici/types/formdata.d.ts","./node_modules/undici/types/connector.d.ts","./node_modules/undici/types/client-stats.d.ts","./node_modules/undici/types/client.d.ts","./node_modules/undici/types/errors.d.ts","./node_modules/undici/types/dispatcher.d.ts","./node_modules/undici/types/global-dispatcher.d.ts","./node_modules/undici/types/global-origin.d.ts","./node_modules/undici/types/pool-stats.d.ts","./node_modules/undici/types/pool.d.ts","./node_modules/undici/types/handlers.d.ts","./node_modules/undici/types/balanced-pool.d.ts","./node_modules/undici/types/round-robin-pool.d.ts","./node_modules/undici/types/h2c-client.d.ts","./node_modules/undici/types/agent.d.ts","./node_modules/undici/types/mock-interceptor.d.ts","./node_modules/undici/types/mock-call-history.d.ts","./node_modules/undici/types/mock-agent.d.ts","./node_modules/undici/types/mock-client.d.ts","./node_modules/undici/types/mock-pool.d.ts","./node_modules/undici/types/snapshot-agent.d.ts","./node_modules/undici/types/mock-errors.d.ts","./node_modules/undici/types/proxy-agent.d.ts","./node_modules/undici/types/socks5-proxy-agent.d.ts","./node_modules/undici/types/env-http-proxy-agent.d.ts","./node_modules/undici/types/retry-handler.d.ts","./node_modules/undici/types/retry-agent.d.ts","./node_modules/undici/types/api.d.ts","./node_modules/undici/types/cache-interceptor.d.ts","./node_modules/undici/types/interceptors.d.ts","./node_modules/undici/types/util.d.ts","./node_modules/undici/types/cookies.d.ts","./node_modules/undici/types/patch.d.ts","./node_modules/undici/types/websocket.d.ts","./node_modules/undici/types/eventsource.d.ts","./node_modules/undici/types/diagnostics-channel.d.ts","./node_modules/undici/types/content-type.d.ts","./node_modules/undici/types/cache.d.ts","./node_modules/undici/types/index.d.ts","./node_modules/undici/index.d.ts","./node_modules/cheerio/dist/esm/index.d.ts","./lib/scraper.ts","./node_modules/resend/dist/index.d.ts","./lib/types.ts","./lib/format.ts","./lib/email.ts","./lib/monitor-runner.ts","./app/api/check/route.ts","./node_modules/zod/v3/helpers/typeAliases.d.cts","./node_modules/zod/v3/helpers/util.d.cts","./node_modules/zod/v3/index.d.cts","./node_modules/zod/v3/ZodError.d.cts","./node_modules/zod/v3/locales/en.d.cts","./node_modules/zod/v3/errors.d.cts","./node_modules/zod/v3/helpers/parseUtil.d.cts","./node_modules/zod/v3/helpers/enumUtil.d.cts","./node_modules/zod/v3/helpers/errorUtil.d.cts","./node_modules/zod/v3/helpers/partialUtil.d.cts","./node_modules/zod/v3/standard-schema.d.cts","./node_modules/zod/v3/types.d.cts","./node_modules/zod/v3/external.d.cts","./node_modules/zod/index.d.cts","./lib/validation.ts","./app/api/monitors/route.ts","./app/api/monitors/[id]/route.ts","./app/api/monitors/[id]/check/route.ts","./app/api/settings/route.ts","./scripts/run-monitor.ts","./app/layout.tsx","./app/components/Dashboard.tsx","./app/page.tsx","./node_modules/@types/json5/index.d.ts"],"fileIdsList":[[76,125,142,143,387,459,570],[76,125,142,143,387,570],[76,125,142,143,387,460,567,586],[76,125,142,143,387,460,567,585],[64,76,125,142,143,567,568],[76,125,142,143,390],[76,125,142,143,593],[76,125,142,143,459,566,567,568],[76,125,142,143],[76,125,142,143,459,460,565,567,569],[76,125,142,143,564],[76,125,142,143,458,459],[76,125,142,143,585],[76,125,142,143,390,391],[76,125,142,143,453],[76,125,142,143,448],[76,125,142,143,443,451,452],[76,125,142,143,443,447,451,452,453],[76,125,142,143,443,448,451,453,454,455,456],[76,125,142,143,442,451],[76,125,142,143,451],[76,125,142,143,446,451],[76,125,142,143,443,444,445,446,450,452],[76,125,142,143,443,446,448,449,451],[76,125,142,143,418],[76,125,142,143,418,419],[76,125,142,143,426,427,428,429],[76,125,142,143,425,426,427,428,429,430,431,432],[76,125,142,143,426,430],[76,125,142,143,426],[76,125,142,143,425,426,427,430],[76,125,142,143,424,425],[76,125,142,143,433,434,435,436,438],[76,125,142,143,422,423,434,435,437],[76,125,142,143,437],[76,125,142,143,422,436,437,438],[76,125,142,143,434],[76,125,142,143,433],[76,125,142,143,440],[76,125,142,143,420,421,439,441,457],[76,122,123,125,142,143],[76,124,125,142,143],[125,142,143],[76,125,130,142,143,160],[76,125,126,131,136,142,143,145,157,168,524],[76,125,126,127,136,142,143,145],[71,72,73,76,125,142,143],[76,125,128,142,143,169],[76,125,129,130,137,142,143,146],[76,125,130,142,143,157,165,524],[76,125,131,133,136,142,143,145,524],[76,124,125,132,142,143],[76,125,133,134,142,143],[76,125,135,136,142,143],[76,124,125,136,142,143],[76,125,136,137,138,142,143,157,168,524],[76,125,136,137,138,142,143,152,157,160,524],[76,117,125,133,136,139,142,143,145,157,168,524],[76,125,136,137,139,140,142,143,145,157,165,168,524],[76,125,139,141,142,143,157,165,168,524],[74,75,76,77,78,79,80,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174],[76,125,136,142,143],[76,125,142,143,144,168],[76,125,133,136,142,143,145,157,524],[76,125,142,143,146],[76,125,142,143,147],[76,124,125,142,143,148],[76,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,524],[76,125,142,143,150],[76,125,142,143,151],[76,125,136,142,143,152,153],[76,125,142,143,152,154,169,171],[76,125,137,142,143],[76,125,136,142,143,157,158,160,524],[76,125,142,143,159,160,524],[76,125,142,143,157,158],[76,125,142,143,160],[76,125,142,143,161],[76,122,125,142,143,157,162,168],[76,125,136,142,143,163,164],[76,125,142,143,163,164],[76,125,130,142,143,145,157,165,524],[76,125,142,143,166],[76,125,142,143,145,167],[76,125,139,142,143,151,168,524],[76,125,130,142,143,169],[76,125,142,143,157,170,524],[76,125,142,143,144,171,524],[76,125,142,143,172],[76,117,125,142,143],[76,117,125,136,138,142,143,148,157,160,168,170,171,173],[76,125,142,143,157,174,524],[64,76,125,142,143,179,180,181],[64,76,125,142,143,179,180],[64,76,125,142,143],[64,68,76,125,142,143,178,343,386],[64,68,76,125,142,143,177,343,386],[61,62,63,76,125,142,143],[76,125,142,143,463,503],[76,125,142,143,463,512],[76,125,142,143,463,506,512],[76,125,142,143,463,512,513],[76,125,142,143,463,505,506,507,508,509,510,511,513],[76,125,142,143,157,505,513,514,515,516,517,519,563],[76,125,142,143,463,505,515],[76,125,142,143,463,505,512,513,514],[76,125,142,143,463,466,475,492,493,504],[76,125,142,143,463,505,512,513,514,515],[76,125,142,143,463,505,511,512,513,515],[76,125,142,143,497,498,502],[76,125,142,143,498],[76,125,142,143,497,498,499,500,501],[76,125,142,143,497,498],[76,125,142,143,497],[76,125,142,143,494,495,496],[76,125,142,143,494],[76,125,142,143,463],[76,125,142,143,462],[76,125,142,143,461],[76,125,142,143,463,467,468,469,470,471,472,473],[76,125,142,143,461,463],[76,125,142,143,463,466],[76,125,142,143,157,518],[76,125,142,143,464],[76,125,142,143,461,463,464,465,474],[69,76,125,142,143],[76,125,142,143,347],[76,125,142,143,349,350,351],[76,125,142,143,353],[76,125,142,143,184,194,200,202,343],[76,125,142,143,184,191,193,196,214],[76,125,142,143,194],[76,125,142,143,194,196,321],[76,125,142,143,249,267,282,389],[76,125,142,143,291],[76,125,142,143,184,194,201,235,245,318,319,389],[76,125,142,143,201,389],[76,125,142,143,194,245,246,247,389],[76,125,142,143,194,201,235,389],[76,125,142,143,389],[76,125,142,143,184,201,202,389],[76,125,142,143,275],[76,124,125,142,143,175,274],[64,76,125,142,143,268,269,270,288,289],[64,76,125,142,143,268],[76,125,142,143,258],[76,125,142,143,257,259,363],[64,76,125,142,143,268,269,286],[76,125,142,143,264,289,375],[76,125,142,143,373,374],[76,125,142,143,208,372],[76,125,142,143,261],[76,124,125,142,143,175,208,224,257,258,259,260],[64,76,125,142,143,286,288,289],[76,125,142,143,286,288],[76,125,142,143,286,287,289],[76,125,142,143,151,175],[76,125,142,143,256],[76,124,125,142,143,175,193,195,252,253,254,255],[64,76,125,142,143,185,366],[64,76,125,142,143,168,175],[64,76,125,142,143,201,233],[64,76,125,142,143,201],[76,125,142,143,231,236],[64,76,125,142,143,232,346],[64,68,76,125,139,142,143,175,177,178,343,384,385],[76,125,142,143,343],[76,125,142,143,183],[76,125,142,143,336,337,338,339,340,341],[76,125,142,143,338],[64,76,125,142,143,232,268,346],[64,76,125,142,143,268,344,346],[64,76,125,142,143,268,346],[76,125,139,142,143,175,195,346],[76,125,139,142,143,175,192,193,204,222,224,256,261,262,284,286],[76,125,142,143,253,256,261,269,271,272,273,275,276,277,278,279,280,281,389],[76,125,142,143,254],[64,76,125,142,143,151,175,193,194,222,224,225,227,252,284,285,289,343,389],[76,125,139,142,143,175,195,196,208,209,257],[76,125,139,142,143,175,194,196],[76,125,139,142,143,157,175,192,195,196],[76,125,139,142,143,151,168,175,192,193,194,195,196,201,204,205,215,216,218,221,222,224,225,226,227,251,252,285,286,294,296,299,301,304,306,307,308,309],[76,125,139,142,143,157,175],[76,125,142,143,184,185,186,192,193,343,346,389],[76,125,139,142,143,157,168,175,189,320,322,323,389],[76,125,142,143,151,168,175,189,192,195,212,216,218,219,220,225,252,299,310,312,318,332,333],[76,125,142,143,194,198,252],[76,125,142,143,192,194],[76,125,142,143,205,300],[76,125,142,143,302,303],[76,125,142,143,302],[76,125,142,143,300],[76,125,142,143,302,305],[76,125,142,143,188,189],[76,125,142,143,188,228],[76,125,142,143,188],[76,125,142,143,190,205,298],[76,125,142,143,297],[76,125,142,143,189,190],[76,125,142,143,190,295],[76,125,142,143,189],[76,125,142,143,284],[76,125,139,142,143,175,192,204,223,243,249,263,266,283,286],[76,125,142,143,237,238,239,240,241,242,264,265,289,344],[76,125,142,143,293],[76,125,139,142,143,175,192,204,223,229,290,292,294,343,346],[76,125,139,142,143,168,175,185,192,194,251],[76,125,142,143,248],[76,125,139,142,143,175,326,331],[76,125,142,143,215,224,251,346],[76,125,142,143,314,318,332,335],[76,125,139,142,143,198,318,326,327,335],[76,125,142,143,184,194,215,226,329],[76,125,139,142,143,175,194,201,226,313,314,324,325,328,330],[76,125,142,143,176,222,223,224,343,346],[76,125,139,142,143,151,168,175,190,192,193,195,198,203,204,212,215,216,218,219,220,221,225,227,251,252,296,310,311,346],[76,125,139,142,143,175,192,194,198,312,334],[76,125,139,142,143,175,193,195],[64,76,125,139,142,143,151,175,183,185,192,193,196,204,221,222,224,225,227,293,343,346],[76,125,139,142,143,151,168,175,187,190,191,195],[76,125,142,143,188,250],[76,125,139,142,143,175,188,193,204],[76,125,139,142,143,175,194,205],[76,125,139,142,143,175],[76,125,142,143,208],[76,125,142,143,207],[76,125,142,143,209],[76,125,142,143,194,206,208,212],[76,125,142,143,194,206,208],[76,125,139,142,143,175,187,194,195,201,209,210,211],[64,76,125,142,143,286,287,288],[76,125,142,143,244],[64,76,125,142,143,185],[64,76,125,142,143,218],[64,76,125,142,143,176,221,224,227,343,346],[76,125,142,143,185,366,367],[64,76,125,142,143,236],[64,76,125,142,143,151,168,175,183,230,232,234,235,346],[76,125,142,143,195,201,218],[76,125,142,143,217],[64,76,125,137,139,142,143,151,175,183,236,245,343,344,345],[60,64,65,66,67,76,125,142,143,177,178,343,386],[76,125,130,142,143],[76,125,142,143,315,316,317],[76,125,142,143,315],[76,125,142,143,355],[76,125,142,143,357],[76,125,142,143,359],[76,125,142,143,361],[76,125,142,143,364],[76,125,142,143,368],[68,70,76,125,142,143,343,348,352,354,356,358,360,362,365,369,371,377,378,380,387,388,389],[76,125,142,143,370],[76,125,142,143,376],[76,125,142,143,232],[76,125,142,143,379],[76,124,125,142,143,209,210,211,212,381,382,383,386],[76,125,142,143,175],[64,68,76,125,139,141,142,143,151,175,177,178,179,181,183,196,335,342,346,386],[76,125,142,143,463,492],[76,125,142,143,477],[76,125,142,143,476,477],[76,125,142,143,476],[76,125,142,143,476,477,478,484,485,488,489,490,491],[76,125,142,143,477,485],[76,125,142,143,476,477,478,484,485,486,487],[76,125,142,143,476,485],[76,125,142,143,485,489],[76,125,142,143,477,478,479,483],[76,125,142,143,478],[76,125,142,143,476,477,485],[76,125,142,143,480,481,482],[76,125,142,143,408],[76,125,142,143,406,408],[76,125,142,143,397,405,406,407,409,411],[76,125,142,143,395],[76,125,142,143,398,403,408,411],[76,125,142,143,394,411],[76,125,142,143,398,399,402,403,404,411],[76,125,142,143,398,399,400,402,403,411],[76,125,142,143,395,396,397,398,399,403,404,405,407,408,409,411],[76,125,142,143,411],[76,125,142,143,393,395,396,397,398,399,400,402,403,404,405,406,407,408,409,410],[76,125,142,143,393,411],[76,125,142,143,398,400,401,403,404,411],[76,125,142,143,402,411],[76,125,142,143,403,404,408,411],[76,125,142,143,396,406],[76,125,142,143,413,414],[76,125,142,143,412,415],[76,89,93,125,142,143,168],[76,89,125,142,143,157,168],[76,84,125,142,143],[76,86,89,125,142,143,165,168],[76,125,142,143,145,165],[76,84,125,142,143,175],[76,86,89,125,142,143,145,168],[76,81,82,85,88,125,136,142,143,157,168],[76,89,96,125,142,143],[76,81,87,125,142,143],[76,89,110,111,125,142,143],[76,85,89,125,142,143,160,168,175],[76,110,125,142,143,175],[76,83,84,125,142,143,175],[76,89,125,142,143],[76,83,84,85,86,87,88,89,90,91,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,111,112,113,114,115,116,125,142,143],[76,89,104,125,142,143],[76,89,96,97,125,142,143],[76,87,89,97,98,125,142,143],[76,88,125,142,143],[76,81,84,89,125,142,143],[76,89,93,97,98,125,142,143],[76,93,125,142,143],[76,87,89,92,125,142,143,168],[76,81,86,89,96,125,142,143],[76,125,142,143,157],[76,84,89,110,125,142,143,173,175],[76,125,142,143,562],[76,125,142,143,168,526,529,532,533],[76,125,142,143,157,168,529],[76,125,142,143,168,529,533],[76,125,142,143,523],[76,125,142,143,527],[76,125,142,143,168,525,526,529],[76,125,142,143,175,523],[76,125,142,143,145,168,525,529],[76,125,136,142,143,157,168,520,521,522,524,528],[76,125,142,143,529,538,546],[76,125,142,143,521,527],[76,125,142,143,529,556,557],[76,125,142,143,160,168,175,521,524,529],[76,125,142,143,175,523,524],[76,125,142,143,529],[76,125,142,143,168,525,529],[76,125,142,143,520],[76,125,142,143,523,524,525,527,528,529,530,531,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,557,558,559,560,561],[76,125,133,142,143,529,549,552],[76,125,142,143,529,538,539,540],[76,125,142,143,527,529,539,541],[76,125,142,143,528],[76,125,142,143,521,523,529],[76,125,142,143,529,533,539,541],[76,125,142,143,533],[76,125,142,143,168,527,529,532],[76,125,142,143,521,525,529,538],[76,125,142,143,157,524],[76,125,142,143,529,549],[76,125,142,143,541],[76,125,142,143,521,525,529,533],[76,125,142,143,160,173,175,523,524,529,556],[76,125,142,143,584],[76,125,142,143,572,573,574],[76,125,142,143,575,576],[76,125,142,143,572,573,575,577,578,583],[76,125,142,143,573,575],[76,125,142,143,583],[76,125,142,143,575],[76,125,142,143,572,573,575,578,579,580,581,582],[76,125,142,143,570],[76,125,142,143,416]],"fileInfos":[{"version":"c430d44666289dae81f30fa7b2edebf186ecc91a2d4c71266ea6ae76388792e1","affectsGlobalScope":true,"impliedFormat":1},{"version":"45b7ab580deca34ae9729e97c13cfd999df04416a79116c3bfb483804f85ded4","impliedFormat":1},{"version":"3facaf05f0c5fc569c5649dd359892c98a85557e3e0c847964caeb67076f4d75","impliedFormat":1},{"version":"e44bb8bbac7f10ecc786703fe0a6a4b952189f908707980ba8f3c8975a760962","impliedFormat":1},{"version":"5e1c4c362065a6b95ff952c0eab010f04dcd2c3494e813b493ecfd4fcb9fc0d8","impliedFormat":1},{"version":"68d73b4a11549f9c0b7d352d10e91e5dca8faa3322bfb77b661839c42b1ddec7","impliedFormat":1},{"version":"5efce4fc3c29ea84e8928f97adec086e3dc876365e0982cc8479a07954a3efd4","impliedFormat":1},{"version":"feecb1be483ed332fad555aff858affd90a48ab19ba7272ee084704eb7167569","impliedFormat":1},{"version":"ee7bad0c15b58988daa84371e0b89d313b762ab83cb5b31b8a2d1162e8eb41c2","impliedFormat":1},{"version":"080941d9f9ff9307f7e27a83bcd888b7c8270716c39af943532438932ec1d0b9","affectsGlobalScope":true,"impliedFormat":1},{"version":"2e80ee7a49e8ac312cc11b77f1475804bee36b3b2bc896bead8b6e1266befb43","affectsGlobalScope":true,"impliedFormat":1},{"version":"c57796738e7f83dbc4b8e65132f11a377649c00dd3eee333f672b8f0a6bea671","affectsGlobalScope":true,"impliedFormat":1},{"version":"dc2df20b1bcdc8c2d34af4926e2c3ab15ffe1160a63e58b7e09833f616efff44","affectsGlobalScope":true,"impliedFormat":1},{"version":"515d0b7b9bea2e31ea4ec968e9edd2c39d3eebf4a2d5cbd04e88639819ae3b71","affectsGlobalScope":true,"impliedFormat":1},{"version":"0559b1f683ac7505ae451f9a96ce4c3c92bdc71411651ca6ddb0e88baaaad6a3","affectsGlobalScope":true,"impliedFormat":1},{"version":"0dc1e7ceda9b8b9b455c3a2d67b0412feab00bd2f66656cd8850e8831b08b537","affectsGlobalScope":true,"impliedFormat":1},{"version":"ce691fb9e5c64efb9547083e4a34091bcbe5bdb41027e310ebba8f7d96a98671","affectsGlobalScope":true,"impliedFormat":1},{"version":"8d697a2a929a5fcb38b7a65594020fcef05ec1630804a33748829c5ff53640d0","affectsGlobalScope":true,"impliedFormat":1},{"version":"4ff2a353abf8a80ee399af572debb8faab2d33ad38c4b4474cff7f26e7653b8d","affectsGlobalScope":true,"impliedFormat":1},{"version":"fb0f136d372979348d59b3f5020b4cdb81b5504192b1cacff5d1fbba29378aa1","affectsGlobalScope":true,"impliedFormat":1},{"version":"d15bea3d62cbbdb9797079416b8ac375ae99162a7fba5de2c6c505446486ac0a","affectsGlobalScope":true,"impliedFormat":1},{"version":"68d18b664c9d32a7336a70235958b8997ebc1c3b8505f4f1ae2b7e7753b87618","affectsGlobalScope":true,"impliedFormat":1},{"version":"eb3d66c8327153d8fa7dd03f9c58d351107fe824c79e9b56b462935176cdf12a","affectsGlobalScope":true,"impliedFormat":1},{"version":"38f0219c9e23c915ef9790ab1d680440d95419ad264816fa15009a8851e79119","affectsGlobalScope":true,"impliedFormat":1},{"version":"69ab18c3b76cd9b1be3d188eaf8bba06112ebbe2f47f6c322b5105a6fbc45a2e","affectsGlobalScope":true,"impliedFormat":1},{"version":"a680117f487a4d2f30ea46f1b4b7f58bef1480456e18ba53ee85c2746eeca012","affectsGlobalScope":true,"impliedFormat":1},{"version":"2f11ff796926e0832f9ae148008138ad583bd181899ab7dd768a2666700b1893","affectsGlobalScope":true,"impliedFormat":1},{"version":"4de680d5bb41c17f7f68e0419412ca23c98d5749dcaaea1896172f06435891fc","affectsGlobalScope":true,"impliedFormat":1},{"version":"954296b30da6d508a104a3a0b5d96b76495c709785c1d11610908e63481ee667","affectsGlobalScope":true,"impliedFormat":1},{"version":"ac9538681b19688c8eae65811b329d3744af679e0bdfa5d842d0e32524c73e1c","affectsGlobalScope":true,"impliedFormat":1},{"version":"0a969edff4bd52585473d24995c5ef223f6652d6ef46193309b3921d65dd4376","affectsGlobalScope":true,"impliedFormat":1},{"version":"9e9fbd7030c440b33d021da145d3232984c8bb7916f277e8ffd3dc2e3eae2bdb","affectsGlobalScope":true,"impliedFormat":1},{"version":"811ec78f7fefcabbda4bfa93b3eb67d9ae166ef95f9bff989d964061cbf81a0c","affectsGlobalScope":true,"impliedFormat":1},{"version":"717937616a17072082152a2ef351cb51f98802fb4b2fdabd32399843875974ca","affectsGlobalScope":true,"impliedFormat":1},{"version":"d7e7d9b7b50e5f22c915b525acc5a49a7a6584cf8f62d0569e557c5cfc4b2ac2","affectsGlobalScope":true,"impliedFormat":1},{"version":"71c37f4c9543f31dfced6c7840e068c5a5aacb7b89111a4364b1d5276b852557","affectsGlobalScope":true,"impliedFormat":1},{"version":"576711e016cf4f1804676043e6a0a5414252560eb57de9faceee34d79798c850","affectsGlobalScope":true,"impliedFormat":1},{"version":"89c1b1281ba7b8a96efc676b11b264de7a8374c5ea1e6617f11880a13fc56dc6","affectsGlobalScope":true,"impliedFormat":1},{"version":"74f7fa2d027d5b33eb0471c8e82a6c87216223181ec31247c357a3e8e2fddc5b","affectsGlobalScope":true,"impliedFormat":1},{"version":"d6d7ae4d1f1f3772e2a3cde568ed08991a8ae34a080ff1151af28b7f798e22ca","affectsGlobalScope":true,"impliedFormat":1},{"version":"063600664504610fe3e99b717a1223f8b1900087fab0b4cad1496a114744f8df","affectsGlobalScope":true,"impliedFormat":1},{"version":"934019d7e3c81950f9a8426d093458b65d5aff2c7c1511233c0fd5b941e608ab","affectsGlobalScope":true,"impliedFormat":1},{"version":"52ada8e0b6e0482b728070b7639ee42e83a9b1c22d205992756fe020fd9f4a47","affectsGlobalScope":true,"impliedFormat":1},{"version":"3bdefe1bfd4d6dee0e26f928f93ccc128f1b64d5d501ff4a8cf3c6371200e5e6","affectsGlobalScope":true,"impliedFormat":1},{"version":"59fb2c069260b4ba00b5643b907ef5d5341b167e7d1dbf58dfd895658bda2867","affectsGlobalScope":true,"impliedFormat":1},{"version":"639e512c0dfc3fad96a84caad71b8834d66329a1f28dc95e3946c9b58176c73a","affectsGlobalScope":true,"impliedFormat":1},{"version":"368af93f74c9c932edd84c58883e736c9e3d53cec1fe24c0b0ff451f529ceab1","affectsGlobalScope":true,"impliedFormat":1},{"version":"af3dd424cf267428f30ccfc376f47a2c0114546b55c44d8c0f1d57d841e28d74","affectsGlobalScope":true,"impliedFormat":1},{"version":"995c005ab91a498455ea8dfb63aa9f83fa2ea793c3d8aa344be4a1678d06d399","affectsGlobalScope":true,"impliedFormat":1},{"version":"959d36cddf5e7d572a65045b876f2956c973a586da58e5d26cde519184fd9b8a","affectsGlobalScope":true,"impliedFormat":1},{"version":"965f36eae237dd74e6cca203a43e9ca801ce38824ead814728a2807b1910117d","affectsGlobalScope":true,"impliedFormat":1},{"version":"3925a6c820dcb1a06506c90b1577db1fdbf7705d65b62b99dce4be75c637e26b","affectsGlobalScope":true,"impliedFormat":1},{"version":"0a3d63ef2b853447ec4f749d3f368ce642264246e02911fcb1590d8c161b8005","affectsGlobalScope":true,"impliedFormat":1},{"version":"8cdf8847677ac7d20486e54dd3fcf09eda95812ac8ace44b4418da1bbbab6eb8","affectsGlobalScope":true,"impliedFormat":1},{"version":"8444af78980e3b20b49324f4a16ba35024fef3ee069a0eb67616ea6ca821c47a","affectsGlobalScope":true,"impliedFormat":1},{"version":"3287d9d085fbd618c3971944b65b4be57859f5415f495b33a6adc994edd2f004","affectsGlobalScope":true,"impliedFormat":1},{"version":"b4b67b1a91182421f5df999988c690f14d813b9850b40acd06ed44691f6727ad","affectsGlobalScope":true,"impliedFormat":1},{"version":"8e7f8264d0fb4c5339605a15daadb037bf238c10b654bb3eee14208f860a32ea","affectsGlobalScope":true,"impliedFormat":1},{"version":"782dec38049b92d4e85c1585fbea5474a219c6984a35b004963b00beb1aab538","affectsGlobalScope":true,"impliedFormat":1},{"version":"0990a7576222f248f0a3b888adcb7389f957928ce2afb1cd5128169086ff4d29","impliedFormat":1},{"version":"eb5b19b86227ace1d29ea4cf81387279d04bb34051e944bc53df69f58914b788","affectsGlobalScope":true,"impliedFormat":1},{"version":"ac51dd7d31333793807a6abaa5ae168512b6131bd41d9c5b98477fc3b7800f9f","impliedFormat":1},{"version":"87d9d29dbc745f182683f63187bf3d53fd8673e5fca38ad5eaab69798ed29fbc","impliedFormat":1},{"version":"09ddcfcfbe77a8232d155ca1030005106b1328f6210df43629d0be750da07c16","affectsGlobalScope":true,"impliedFormat":1},{"version":"cc69795d9954ee4ad57545b10c7bf1a7260d990231b1685c147ea71a6faa265c","impliedFormat":1},{"version":"8bc6c94ff4f2af1f4023b7bb2379b08d3d7dd80c698c9f0b07431ea16101f05f","impliedFormat":1},{"version":"1b61d259de5350f8b1e5db06290d31eaebebc6baafd5f79d314b5af9256d7153","impliedFormat":1},{"version":"57194e1f007f3f2cbef26fa299d4c6b21f4623a2eddc63dfeef79e38e187a36e","impliedFormat":1},{"version":"0f6666b58e9276ac3a38fdc80993d19208442d6027ab885580d93aec76b4ef00","impliedFormat":1},{"version":"05fd364b8ef02fb1e174fbac8b825bdb1e5a36a016997c8e421f5fab0a6da0a0","impliedFormat":1},{"version":"6c7176368037af28cb72f2392010fa1cef295d6d6744bca8cfb54985f3a18c3e","affectsGlobalScope":true,"impliedFormat":1},{"version":"ab41ef1f2cdafb8df48be20cd969d875602483859dc194e9c97c8a576892c052","affectsGlobalScope":true,"impliedFormat":1},{"version":"437e20f2ba32abaeb7985e0afe0002de1917bc74e949ba585e49feba65da6ca1","affectsGlobalScope":true,"impliedFormat":1},{"version":"21d819c173c0cf7cc3ce57c3276e77fd9a8a01d35a06ad87158781515c9a438a","impliedFormat":1},{"version":"98cffbf06d6bab333473c70a893770dbe990783904002c4f1a960447b4b53dca","affectsGlobalScope":true,"impliedFormat":1},{"version":"3af97acf03cc97de58a3a4bc91f8f616408099bc4233f6d0852e72a8ffb91ac9","affectsGlobalScope":true,"impliedFormat":1},{"version":"808069bba06b6768b62fd22429b53362e7af342da4a236ed2d2e1c89fcca3b4a","affectsGlobalScope":true,"impliedFormat":1},{"version":"1db0b7dca579049ca4193d034d835f6bfe73096c73663e5ef9a0b5779939f3d0","affectsGlobalScope":true,"impliedFormat":1},{"version":"9798340ffb0d067d69b1ae5b32faa17ab31b82466a3fc00d8f2f2df0c8554aaa","affectsGlobalScope":true,"impliedFormat":1},{"version":"f26b11d8d8e4b8028f1c7d618b22274c892e4b0ef5b3678a8ccbad85419aef43","affectsGlobalScope":true,"impliedFormat":1},{"version":"5929864ce17fba74232584d90cb721a89b7ad277220627cc97054ba15a98ea8f","impliedFormat":1},{"version":"763fe0f42b3d79b440a9b6e51e9ba3f3f91352469c1e4b3b67bfa4ff6352f3f4","impliedFormat":1},{"version":"25c8056edf4314820382a5fdb4bb7816999acdcb929c8f75e3f39473b87e85bc","impliedFormat":1},{"version":"c464d66b20788266e5353b48dc4aa6bc0dc4a707276df1e7152ab0c9ae21fad8","impliedFormat":1},{"version":"78d0d27c130d35c60b5e5566c9f1e5be77caf39804636bc1a40133919a949f21","impliedFormat":1},{"version":"c6fd2c5a395f2432786c9cb8deb870b9b0e8ff7e22c029954fabdd692bff6195","impliedFormat":1},{"version":"1d6e127068ea8e104a912e42fc0a110e2aa5a66a356a917a163e8cf9a65e4a75","impliedFormat":1},{"version":"5ded6427296cdf3b9542de4471d2aa8d3983671d4cac0f4bf9c637208d1ced43","impliedFormat":1},{"version":"7f182617db458e98fc18dfb272d40aa2fff3a353c44a89b2c0ccb3937709bfb5","impliedFormat":1},{"version":"cadc8aced301244057c4e7e73fbcae534b0f5b12a37b150d80e5a45aa4bebcbd","impliedFormat":1},{"version":"385aab901643aa54e1c36f5ef3107913b10d1b5bb8cbcd933d4263b80a0d7f20","impliedFormat":1},{"version":"9670d44354bab9d9982eca21945686b5c24a3f893db73c0dae0fd74217a4c219","impliedFormat":1},{"version":"0b8a9268adaf4da35e7fa830c8981cfa22adbbe5b3f6f5ab91f6658899e657a7","impliedFormat":1},{"version":"11396ed8a44c02ab9798b7dca436009f866e8dae3c9c25e8c1fbc396880bf1bb","impliedFormat":1},{"version":"ba7bc87d01492633cb5a0e5da8a4a42a1c86270e7b3d2dea5d156828a84e4882","impliedFormat":1},{"version":"4893a895ea92c85345017a04ed427cbd6a1710453338df26881a6019432febdd","impliedFormat":1},{"version":"c21dc52e277bcfc75fac0436ccb75c204f9e1b3fa5e12729670910639f27343e","impliedFormat":1},{"version":"13f6f39e12b1518c6650bbb220c8985999020fe0f21d818e28f512b7771d00f9","impliedFormat":1},{"version":"9b5369969f6e7175740bf51223112ff209f94ba43ecd3bb09eefff9fd675624a","impliedFormat":1},{"version":"4fe9e626e7164748e8769bbf74b538e09607f07ed17c2f20af8d680ee49fc1da","impliedFormat":1},{"version":"24515859bc0b836719105bb6cc3d68255042a9f02a6022b3187948b204946bd2","impliedFormat":1},{"version":"ea0148f897b45a76544ae179784c95af1bd6721b8610af9ffa467a518a086a43","impliedFormat":1},{"version":"24c6a117721e606c9984335f71711877293a9651e44f59f3d21c1ea0856f9cc9","impliedFormat":1},{"version":"dd3273ead9fbde62a72949c97dbec2247ea08e0c6952e701a483d74ef92d6a17","impliedFormat":1},{"version":"405822be75ad3e4d162e07439bac80c6bcc6dbae1929e179cf467ec0b9ee4e2e","impliedFormat":1},{"version":"0db18c6e78ea846316c012478888f33c11ffadab9efd1cc8bcc12daded7a60b6","impliedFormat":1},{"version":"e61be3f894b41b7baa1fbd6a66893f2579bfad01d208b4ff61daef21493ef0a8","impliedFormat":1},{"version":"bd0532fd6556073727d28da0edfd1736417a3f9f394877b6d5ef6ad88fba1d1a","impliedFormat":1},{"version":"89167d696a849fce5ca508032aabfe901c0868f833a8625d5a9c6e861ef935d2","impliedFormat":1},{"version":"615ba88d0128ed16bf83ef8ccbb6aff05c3ee2db1cc0f89ab50a4939bfc1943f","impliedFormat":1},{"version":"a4d551dbf8746780194d550c88f26cf937caf8d56f102969a110cfaed4b06656","impliedFormat":1},{"version":"8bd86b8e8f6a6aa6c49b71e14c4ffe1211a0e97c80f08d2c8cc98838006e4b88","impliedFormat":1},{"version":"317e63deeb21ac07f3992f5b50cdca8338f10acd4fbb7257ebf56735bf52ab00","impliedFormat":1},{"version":"4732aec92b20fb28c5fe9ad99521fb59974289ed1e45aecb282616202184064f","impliedFormat":1},{"version":"2e85db9e6fd73cfa3d7f28e0ab6b55417ea18931423bd47b409a96e4a169e8e6","impliedFormat":1},{"version":"c46e079fe54c76f95c67fb89081b3e399da2c7d109e7dca8e4b58d83e332e605","impliedFormat":1},{"version":"bf67d53d168abc1298888693338cb82854bdb2e69ef83f8a0092093c2d562107","impliedFormat":1},{"version":"b52476feb4a0cbcb25e5931b930fc73cb6643fb1a5060bf8a3dda0eeae5b4b68","affectsGlobalScope":true,"impliedFormat":1},{"version":"f9501cc13ce624c72b61f12b3963e84fad210fbdf0ffbc4590e08460a3f04eba","affectsGlobalScope":true,"impliedFormat":1},{"version":"e7721c4f69f93c91360c26a0a84ee885997d748237ef78ef665b153e622b36c1","affectsGlobalScope":true,"impliedFormat":1},{"version":"d97fb21da858fb18b8ae72c314e9743fd52f73ebe2764e12af1db32fc03f853f","affectsGlobalScope":true,"impliedFormat":1},{"version":"0fa06ada475b910e2106c98c68b10483dc8811d0c14a8a8dd36efb2672485b29","impliedFormat":1},{"version":"33e5e9aba62c3193d10d1d33ae1fa75c46a1171cf76fef750777377d53b0303f","impliedFormat":1},{"version":"2b06b93fd01bcd49d1a6bd1f9b65ddcae6480b9a86e9061634d6f8e354c1468f","impliedFormat":1},{"version":"6a0cd27e5dc2cfbe039e731cf879d12b0e2dded06d1b1dedad07f7712de0d7f4","affectsGlobalScope":true,"impliedFormat":1},{"version":"13f5c844119c43e51ce777c509267f14d6aaf31eafb2c2b002ca35584cd13b29","impliedFormat":1},{"version":"e60477649d6ad21542bd2dc7e3d9ff6853d0797ba9f689ba2f6653818999c264","impliedFormat":1},{"version":"c2510f124c0293ab80b1777c44d80f812b75612f297b9857406468c0f4dafe29","affectsGlobalScope":true,"impliedFormat":1},{"version":"5524481e56c48ff486f42926778c0a3cce1cc85dc46683b92b1271865bcf015a","impliedFormat":1},{"version":"4c829ab315f57c5442c6667b53769975acbf92003a66aef19bce151987675bd1","affectsGlobalScope":true,"impliedFormat":1},{"version":"b2ade7657e2db96d18315694789eff2ddd3d8aea7215b181f8a0b303277cc579","impliedFormat":1},{"version":"78dbea00e90d2df8ea3dbef0cc379d95b8be9b71cd6bde4c28728f306811803b","impliedFormat":1},{"version":"4d631b81fa2f07a0e63a9a143d6a82c25c5f051298651a9b69176ba28930756d","impliedFormat":1},{"version":"836a356aae992ff3c28a0212e3eabcb76dd4b0cc06bcb9607aeef560661b860d","impliedFormat":1},{"version":"1e0d1f8b0adfa0b0330e028c7941b5a98c08b600efe7f14d2d2a00854fb2f393","impliedFormat":1},{"version":"41670ee38943d9cbb4924e436f56fc19ee94232bc96108562de1a734af20dc2c","affectsGlobalScope":true,"impliedFormat":1},{"version":"8e1e46d0a9837ee058c100501080c920fa98081ea3956af0374308ba6f22a33e","impliedFormat":1},{"version":"22295e8103f1d6d8ea4b5d6211e43421fe4564e34d0dd8e09e520e452d89e659","impliedFormat":1},{"version":"fa7834c715d5357e4540cee40ce96c3250ddb67a7b879a6b7fa0e86d6696f121","impliedFormat":1},{"version":"22dfb07a7ab15b66ac043829056fe70124844636ae719551812ac631ba04985b","impliedFormat":1},{"version":"a10f0e1854f3316d7ee437b79649e5a6ae3ae14ffe6322b02d4987071a95362e","impliedFormat":1},{"version":"e208f73ef6a980104304b0d2ca5f6bf1b85de6009d2c7e404028b875020fa8f2","impliedFormat":1},{"version":"d163b6bc2372b4f07260747cbc6c0a6405ab3fbcea3852305e98ac43ca59f5bc","impliedFormat":1},{"version":"e6fa9ad47c5f71ff733744a029d1dc472c618de53804eae08ffc243b936f87ff","affectsGlobalScope":true,"impliedFormat":1},{"version":"a6f137d651076822d4fe884287e68fd61785a0d3d1fdb250a5059b691fa897db","impliedFormat":1},{"version":"24826ed94a78d5c64bd857570fdbd96229ad41b5cb654c08d75a9845e3ab7dde","impliedFormat":1},{"version":"8b479a130ccb62e98f11f136d3ac80f2984fdc07616516d29881f3061f2dd472","impliedFormat":1},{"version":"928af3d90454bf656a52a48679f199f64c1435247d6189d1caf4c68f2eaf921f","affectsGlobalScope":true,"impliedFormat":1},{"version":"bceb58df66ab8fb00170df20cd813978c5ab84be1d285710c4eb005d8e9d8efb","affectsGlobalScope":true,"impliedFormat":1},{"version":"3f16a7e4deafa527ed9995a772bb380eb7d3c2c0fd4ae178c5263ed18394db2c","impliedFormat":1},{"version":"933921f0bb0ec12ef45d1062a1fc0f27635318f4d294e4d99de9a5493e618ca2","impliedFormat":1},{"version":"71a0f3ad612c123b57239a7749770017ecfe6b66411488000aba83e4546fde25","impliedFormat":1},{"version":"77fbe5eecb6fac4b6242bbf6eebfc43e98ce5ccba8fa44e0ef6a95c945ff4d98","impliedFormat":1},{"version":"4f9d8ca0c417b67b69eeb54c7ca1bedd7b56034bb9bfd27c5d4f3bc4692daca7","impliedFormat":1},{"version":"0cb167c371eaa8c869f8a7656a7296f2e4fae43b4d8b803a680236b24794e5f9","impliedFormat":1},{"version":"0a839dba0287cc0481ad4beedd48a1c64acf1e212ae865d1315f7007ca215161","impliedFormat":1},{"version":"38dc4655376cd1a4bd6bb3763d92949233e33d38d3dd3cbea7bbf218175a38ef","impliedFormat":1},{"version":"37ba7b45141a45ce6e80e66f2a96c8a5ab1bcef0fc2d0f56bb58df96ec67e972","impliedFormat":1},{"version":"45650f47bfb376c8a8ed39d4bcda5902ab899a3150029684ee4c10676d9fbaee","impliedFormat":1},{"version":"d61e0a64cd175208ac0b83670151a9a6b5916f0d1ffcdc5c29c90b1cebfc5045","affectsGlobalScope":true,"impliedFormat":1},{"version":"18fd40412d102c5564136f29735e5d1c3b455b8a37f920da79561f1fde068208","impliedFormat":1},{"version":"48a679952eefe4cb776d5a0e1ccba2d3eb53b57448bbb7abc1fcebcbd5440188","impliedFormat":1},{"version":"f0be1b8078cd549d91f37c30c222c2a187ac1cf981d994fb476a1adc61387b14","affectsGlobalScope":true,"impliedFormat":1},{"version":"0aaed1d72199b01234152f7a60046bc947f1f37d78d182e9ae09c4289e06a592","impliedFormat":1},{"version":"2d14da6ecb49bf828d83948765ec2d3a579d476bbb9645e749610baa6ec880ca","impliedFormat":1},{"version":"66ba1b2c3e3a3644a1011cd530fb444a96b1b2dfe2f5e837a002d41a1a799e60","impliedFormat":1},{"version":"7e514f5b852fdbc166b539fdd1f4e9114f29911592a5eb10a94bb3a13ccac3c4","impliedFormat":1},{"version":"5b7aa3c4c1a5d81b411e8cb302b45507fea9358d3569196b27eb1a27ae3a90ef","affectsGlobalScope":true,"impliedFormat":1},{"version":"5987a903da92c7462e0b35704ce7da94d7fdc4b89a984871c0e2b87a8aae9e69","affectsGlobalScope":true,"impliedFormat":1},{"version":"ea08a0345023ade2b47fbff5a76d0d0ed8bff10bc9d22b83f40858a8e941501c","impliedFormat":1},{"version":"0aef708fb4c7a6b915e8305cbfac40cd207b032dbaabe9a01889a5fff3254681","impliedFormat":1},{"version":"ae062ce7d9510060c5d7e7952ae379224fb3f8f2dd74e88959878af2057c143b","impliedFormat":1},{"version":"ad9bdafb4e7abf14cc53ce7970486a84c87831e62891e5dfe798ddcd55e84701","affectsGlobalScope":true,"impliedFormat":1},{"version":"358765d5ea8afd285d4fd1532e78b88273f18cb3f87403a9b16fef61ac9fdcfe","impliedFormat":1},{"version":"71d3ae6a5e73ca4130762560425e00984ebaff64d5353a3333d1bb7eb86ef336","impliedFormat":1},{"version":"8caa5c86be1b793cd5f599e27ecb34252c41e011980f7d61ae4989a149ff6ccc","impliedFormat":1},{"version":"f9fd93190acb1ffe0bc0fb395df979452f8d625071e9ffc8636e4dfb86ab2508","impliedFormat":1},{"version":"5f41fd8732a89e940c58ce22206e3df85745feb8983e2b4c6257fb8cbb118493","impliedFormat":1},{"version":"17ed71200119e86ccef2d96b73b02ce8854b76ad6bd21b5021d4269bec527b5f","impliedFormat":1},{"version":"1cfa8647d7d71cb03847d616bd79320abfc01ddea082a49569fda71ac5ece66b","impliedFormat":1},{"version":"bb7a61dd55dc4b9422d13da3a6bb9cc5e89be888ef23bbcf6558aa9726b89a1c","impliedFormat":1},{"version":"db6d2d9daad8a6d83f281af12ce4355a20b9a3e71b82b9f57cddcca0a8964a96","impliedFormat":1},{"version":"cfe4ef4710c3786b6e23dae7c086c70b4f4835a2e4d77b75d39f9046106e83d3","impliedFormat":1},{"version":"cbea99888785d49bb630dcbb1613c73727f2b5a2cf02e1abcaab7bcf8d6bf3c5","impliedFormat":1},{"version":"3a8bddb66b659f6bd2ff641fc71df8a8165bafe0f4b799cc298be5cd3755bb20","impliedFormat":1},{"version":"a86f82d646a739041d6702101afa82dcb935c416dd93cbca7fd754fd0282ce1f","impliedFormat":1},{"version":"2dad084c67e649f0f354739ec7df7c7df0779a28a4f55c97c6b6883ae850d1ce","impliedFormat":1},{"version":"fa5bbc7ab4130dd8cdc55ea294ec39f76f2bc507a0f75f4f873e38631a836ca7","impliedFormat":1},{"version":"df45ca1176e6ac211eae7ddf51336dc075c5314bc5c253651bae639defd5eec5","impliedFormat":1},{"version":"cf86de1054b843e484a3c9300d62fbc8c97e77f168bbffb131d560ca0474d4a8","impliedFormat":1},{"version":"196c960b12253fde69b204aa4fbf69470b26daf7a430855d7f94107a16495ab0","impliedFormat":1},{"version":"ee15ea5dd7a9fc9f5013832e5843031817a880bf0f24f37a29fd8337981aae07","impliedFormat":1},{"version":"bf24f6d35f7318e246010ffe9924395893c4e96d34324cde77151a73f078b9ad","impliedFormat":1},{"version":"ea53732769832d0f127ae16620bd5345991d26bf0b74e85e41b61b27d74ea90f","impliedFormat":1},{"version":"10595c7ff5094dd5b6a959ccb1c00e6a06441b4e10a87bc09c15f23755d34439","impliedFormat":1},{"version":"9620c1ff645afb4a9ab4044c85c26676f0a93e8c0e4b593aea03a89ccb47b6d0","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"a9af0e608929aaf9ce96bd7a7b99c9360636c31d73670e4af09a09950df97841","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"c86fe861cf1b4c46a0fb7d74dffe596cf679a2e5e8b1456881313170f092e3fa","impliedFormat":1},{"version":"08ed0b3f0166787f84a6606f80aa3b1388c7518d78912571b203817406e471da","impliedFormat":1},{"version":"47e5af2a841356a961f815e7c55d72554db0c11b4cba4d0caab91f8717846a94","impliedFormat":1},{"version":"65f43099ded6073336e697512d9b80f2d4fec3182b7b2316abf712e84104db00","impliedFormat":1},{"version":"f5f541902bf7ae0512a177295de9b6bcd6809ea38307a2c0a18bfca72212f368","impliedFormat":1},{"version":"b0decf4b6da3ebc52ea0c96095bdfaa8503acc4ac8e9081c5f2b0824835dd3bd","impliedFormat":1},{"version":"ca1b882a105a1972f82cc58e3be491e7d750a1eb074ffd13b198269f57ed9e1b","impliedFormat":1},{"version":"fc3e1c87b39e5ba1142f27ec089d1966da168c04a859a4f6aab64dceae162c2b","impliedFormat":1},{"version":"3b414b99a73171e1c4b7b7714e26b87d6c5cb03d200352da5342ab4088a54c85","impliedFormat":1},{"version":"61888522cec948102eba94d831c873200aa97d00d8989fdfd2a3e0ee75ec65a2","impliedFormat":1},{"version":"4e10622f89fea7b05dd9b52fb65e1e2b5cbd96d4cca3d9e1a60bb7f8a9cb86a1","impliedFormat":1},{"version":"74b2a5e5197bd0f2e0077a1ea7c07455bbea67b87b0869d9786d55104006784f","impliedFormat":1},{"version":"59bf32919de37809e101acffc120596a9e45fdbab1a99de5087f31fdc36e2f11","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"faa03dffb64286e8304a2ca96dd1317a77db6bfc7b3fb385163648f67e535d77","impliedFormat":1},{"version":"c40c848daad198266370c1c72a7a8c3d18d2f50727c7859fcfefd3ff69a7f288","impliedFormat":1},{"version":"ac60bbee0d4235643cc52b57768b22de8c257c12bd8c2039860540cab1fa1d82","impliedFormat":1},{"version":"6428e6edd944ce6789afdf43f9376c1f2e4957eea34166177625aaff4c0da1a0","impliedFormat":1},{"version":"ada39cbb2748ab2873b7835c90c8d4620723aedf323550e8489f08220e477c7f","impliedFormat":1},{"version":"6e5f5cee603d67ee1ba6120815497909b73399842254fc1e77a0d5cdc51d8c9c","impliedFormat":1},{"version":"8dba67056cbb27628e9b9a1cba8e57036d359dceded0725c72a3abe4b6c79cd4","impliedFormat":1},{"version":"70f3814c457f54a7efe2d9ce9d2686de9250bb42eb7f4c539bd2280a42e52d33","impliedFormat":1},{"version":"154dd2e22e1e94d5bc4ff7726706bc0483760bae40506bdce780734f11f7ec47","impliedFormat":1},{"version":"ef61792acbfa8c27c9bd113f02731e66229f7d3a169e3c1993b508134f1a58e0","impliedFormat":1},{"version":"9c82171d836c47486074e4ca8e059735bf97b205e70b196535b5efd40cbe1bc5","impliedFormat":1},{"version":"0131e203d8560edb39678abe10db42564a068f98c4ebd1ed9ffe7279c78b3c81","impliedFormat":1},{"version":"f6404e7837b96da3ea4d38c4f1a3812c96c9dcdf264e93d5bdb199f983a3ef4b","impliedFormat":1},{"version":"c5426dbfc1cf90532f66965a7aa8c1136a78d4d0f96d8180ecbfc11d7722f1a5","impliedFormat":1},{"version":"65a15fc47900787c0bd18b603afb98d33ede930bed1798fc984d5ebb78b26cf9","impliedFormat":1},{"version":"9d202701f6e0744adb6314d03d2eb8fc994798fc83d91b691b75b07626a69801","impliedFormat":1},{"version":"de9d2df7663e64e3a91bf495f315a7577e23ba088f2949d5ce9ec96f44fba37d","impliedFormat":1},{"version":"c7af78a2ea7cb1cd009cfb5bdb48cd0b03dad3b54f6da7aab615c2e9e9d570c5","impliedFormat":1},{"version":"1ee45496b5f8bdee6f7abc233355898e5bf9bd51255db65f5ff7ede617ca0027","impliedFormat":1},{"version":"8b8f00491431fe82f060dfe8c7f2180a9fb239f3d851527db909b83230e75882","affectsGlobalScope":true,"impliedFormat":1},{"version":"db01d18853469bcb5601b9fc9826931cc84cc1a1944b33cad76fd6f1e3d8c544","affectsGlobalScope":true,"impliedFormat":1},{"version":"dba114fb6a32b355a9cfc26ca2276834d72fe0e94cd2c3494005547025015369","impliedFormat":1},{"version":"903e299a28282fa7b714586e28409ed73c3b63f5365519776bf78e8cf173db36","affectsGlobalScope":true,"impliedFormat":1},{"version":"fa6c12a7c0f6b84d512f200690bfc74819e99efae69e4c95c4cd30f6884c526e","impliedFormat":1},{"version":"f1c32f9ce9c497da4dc215c3bc84b722ea02497d35f9134db3bb40a8d918b92b","impliedFormat":1},{"version":"b73c319af2cc3ef8f6421308a250f328836531ea3761823b4cabbd133047aefa","affectsGlobalScope":true,"impliedFormat":1},{"version":"e433b0337b8106909e7953015e8fa3f2d30797cea27141d1c5b135365bb975a6","impliedFormat":1},{"version":"dd3900b24a6a8745efeb7ad27629c0f8a626470ac229c1d73f1fe29d67e44dca","impliedFormat":1},{"version":"ddff7fc6edbdc5163a09e22bf8df7bef75f75369ebd7ecea95ba55c4386e2441","impliedFormat":1},{"version":"106c6025f1d99fd468fd8bf6e5bda724e11e5905a4076c5d29790b6c3745e50c","impliedFormat":1},{"version":"ec29be0737d39268696edcec4f5e97ce26f449fa9b7afc2f0f99a86def34a418","impliedFormat":1},{"version":"aeab39e8e0b1a3b250434c3b2bb8f4d17bbec2a9dbce5f77e8a83569d3d2cbc2","impliedFormat":1},{"version":"ec6cba1c02c675e4dd173251b156792e8d3b0c816af6d6ad93f1a55d674591aa","impliedFormat":1},{"version":"b620391fe8060cf9bedc176a4d01366e6574d7a71e0ac0ab344a4e76576fcbb8","impliedFormat":1},{"version":"d729408dfde75b451530bcae944cf89ee8277e2a9df04d1f62f2abfd8b03c1e1","impliedFormat":1},{"version":"e15d3c84d5077bb4a3adee4c791022967b764dc41cb8fa3cfa44d4379b2c95f5","impliedFormat":1},{"version":"5f58e28cd22e8fc1ac1b3bc6b431869f1e7d0b39e2c21fbf79b9fa5195a85980","impliedFormat":1},{"version":"e1fc1a1045db5aa09366be2b330e4ce391550041fc3e925f60998ca0b647aa97","impliedFormat":1},{"version":"63533978dcda286422670f6e184ac516805a365fb37a086eeff4309e812f1402","impliedFormat":1},{"version":"43ba4f2fa8c698f5c304d21a3ef596741e8e85a810b7c1f9b692653791d8d97a","impliedFormat":1},{"version":"31fb49ef3aa3d76f0beb644984e01eab0ea222372ea9b49bb6533be5722d756c","impliedFormat":1},{"version":"33cd131e1461157e3e06b06916b5176e7a8ec3fce15a5cfe145e56de744e07d2","impliedFormat":1},{"version":"889ef863f90f4917221703781d9723278db4122d75596b01c429f7c363562b86","impliedFormat":1},{"version":"3556cfbab7b43da96d15a442ddbb970e1f2fc97876d055b6555d86d7ac57dae5","impliedFormat":1},{"version":"437751e0352c6e924ddf30e90849f1d9eb00ca78c94d58d6a37202ec84eb8393","impliedFormat":1},{"version":"48e8af7fdb2677a44522fd185d8c87deff4d36ee701ea003c6c780b1407a1397","impliedFormat":1},{"version":"d11308de5a36c7015bb73adb5ad1c1bdaac2baede4cc831a05cf85efa3cc7f2f","impliedFormat":1},{"version":"38e4684c22ed9319beda6765bab332c724103d3a966c2e5e1c5a49cf7007845f","impliedFormat":1},{"version":"f9812cfc220ecf7557183379531fa409acd249b9e5b9a145d0d52b76c20862de","affectsGlobalScope":true,"impliedFormat":1},{"version":"e650298721abc4f6ae851e60ae93ee8199791ceec4b544c3379862f81f43178c","impliedFormat":1},{"version":"2e4f37ffe8862b14d8e24ae8763daaa8340c0df0b859d9a9733def0eee7562d9","impliedFormat":1},{"version":"13283350547389802aa35d9f2188effaeac805499169a06ef5cd77ce2a0bd63f","impliedFormat":1},{"version":"680793958f6a70a44c8d9ae7d46b7a385361c69ac29dcab3ed761edce1c14ab8","impliedFormat":1},{"version":"6ac6715916fa75a1f7ebdfeacac09513b4d904b667d827b7535e84ff59679aff","impliedFormat":1},{"version":"b838d4c72740eb0afd284bf7575b74c624b105eff2e8c7b4aeead57e7ac320ff","impliedFormat":1},{"version":"913ddbba170240070bd5921b8f33ea780021bdf42fbdfcd4fcb2691b1884ddde","impliedFormat":1},{"version":"b4e6d416466999ff40d3fe5ceb95f7a8bfb7ac2262580287ac1a8391e5362431","impliedFormat":1},{"version":"5fe23bd829e6be57d41929ac374ee9551ccc3c44cee893167b7b5b77be708014","impliedFormat":1},{"version":"0a626484617019fcfbfc3c1bc1f9e84e2913f1adb73692aa9075817404fb41a1","impliedFormat":1},{"version":"438c7513b1df91dcef49b13cd7a1c4720f91a36e88c1df731661608b7c055f10","impliedFormat":1},{"version":"cf185cc4a9a6d397f416dd28cca95c227b29f0f27b160060a95c0e5e36cda865","impliedFormat":1},{"version":"0086f3e4ad898fd7ca56bb223098acfacf3fa065595182aaf0f6c4a6a95e6fbd","impliedFormat":1},{"version":"efaa078e392f9abda3ee8ade3f3762ab77f9c50b184e6883063a911742a4c96a","impliedFormat":1},{"version":"54a8bb487e1dc04591a280e7a673cdfb272c83f61e28d8a64cf1ac2e63c35c51","impliedFormat":1},{"version":"021a9498000497497fd693dd315325484c58a71b5929e2bbb91f419b04b24cea","impliedFormat":1},{"version":"9385cdc09850950bc9b59cca445a3ceb6fcca32b54e7b626e746912e489e535e","impliedFormat":1},{"version":"2894c56cad581928bb37607810af011764a2f511f575d28c9f4af0f2ef02d1ab","impliedFormat":1},{"version":"0a72186f94215d020cb386f7dca81d7495ab6c17066eb07d0f44a5bf33c1b21a","impliedFormat":1},{"version":"84124384abae2f6f66b7fbfc03862d0c2c0b71b826f7dbf42c8085d31f1d3f95","impliedFormat":1},{"version":"63a8e96f65a22604eae82737e409d1536e69a467bb738bec505f4f97cce9d878","impliedFormat":1},{"version":"3fd78152a7031315478f159c6a5872c712ece6f01212c78ea82aef21cb0726e2","impliedFormat":1},{"version":"b01bd582a6e41457bc56e6f0f9de4cb17f33f5f3843a7cf8210ac9c18472fb0f","impliedFormat":1},{"version":"58b49e5c1def740360b5ae22ae2405cfac295fee74abd88d74ac4ea42502dc03","impliedFormat":1},{"version":"512fc15cca3a35b8dbbf6e23fe9d07e6f87ad03c895acffd3087ce09f352aad0","impliedFormat":1},{"version":"9a0946d15a005832e432ea0cd4da71b57797efb25b755cc07f32274296d62355","impliedFormat":1},{"version":"a52ff6c0a149e9f370372fc3c715d7f2beee1f3bab7980e271a7ab7d313ec677","impliedFormat":1},{"version":"fd933f824347f9edd919618a76cdb6a0c0085c538115d9a287fa0c7f59957ab3","impliedFormat":1},{"version":"6ac6715916fa75a1f7ebdfeacac09513b4d904b667d827b7535e84ff59679aff","impliedFormat":1},{"version":"6a1aa3e55bdc50503956c5cd09ae4cd72e3072692d742816f65c66ca14f4dfdd","impliedFormat":1},{"version":"ab75cfd9c4f93ffd601f7ca1753d6a9d953bbedfbd7a5b3f0436ac8a1de60dfa","impliedFormat":1},{"version":"f95180f03d827525ca4f990f49e17ec67198c316dd000afbe564655141f725cd","impliedFormat":1},{"version":"b73cbf0a72c8800cf8f96a9acfe94f3ad32ca71342a8908b8ae484d61113f647","impliedFormat":1},{"version":"bae6dd176832f6423966647382c0d7ba9e63f8c167522f09a982f086cd4e8b23","impliedFormat":1},{"version":"1364f64d2fb03bbb514edc42224abd576c064f89be6a990136774ecdd881a1da","impliedFormat":1},{"version":"c9958eb32126a3843deedda8c22fb97024aa5d6dd588b90af2d7f2bfac540f23","impliedFormat":1},{"version":"950fb67a59be4c2dbe69a5786292e60a5cb0e8612e0e223537784c731af55db1","impliedFormat":1},{"version":"e927c2c13c4eaf0a7f17e6022eee8519eb29ef42c4c13a31e81a611ab8c95577","impliedFormat":1},{"version":"07ca44e8d8288e69afdec7a31fa408ce6ab90d4f3d620006701d5544646da6aa","impliedFormat":1},{"version":"70246ad95ad8a22bdfe806cb5d383a26c0c6e58e7207ab9c431f1cb175aca657","impliedFormat":1},{"version":"f00f3aa5d64ff46e600648b55a79dcd1333458f7a10da2ed594d9f0a44b76d0b","impliedFormat":1},{"version":"772d8d5eb158b6c92412c03228bd9902ccb1457d7a705b8129814a5d1a6308fc","impliedFormat":1},{"version":"4e4475fba4ed93a72f167b061cd94a2e171b82695c56de9899275e880e06ba41","impliedFormat":1},{"version":"97c5f5d580ab2e4decd0a3135204050f9b97cd7908c5a8fbc041eadede79b2fa","impliedFormat":1},{"version":"c99a3a5f2215d5b9d735aa04cec6e61ed079d8c0263248e298ffe4604d4d0624","impliedFormat":1},{"version":"49b2375c586882c3ac7f57eba86680ff9742a8d8cb2fe25fe54d1b9673690d41","impliedFormat":1},{"version":"802e797bcab5663b2c9f63f51bdf67eff7c41bc64c0fd65e6da3e7941359e2f7","impliedFormat":1},{"version":"847e160d709c74cc714fbe1f99c41d3425b74cd47b1be133df1623cd87014089","impliedFormat":1},{"version":"9fee04f1e1afa50524862289b9f0b0fdc3735b80e2a0d684cec3b9ff3d94cecc","impliedFormat":1},{"version":"5cdc27fbc5c166fc5c763a30ac21cbac9859dc5ba795d3230db6d4e52a1965bb","impliedFormat":1},{"version":"6459054aabb306821a043e02b89d54da508e3a6966601a41e71c166e4ea1474f","impliedFormat":1},{"version":"f416c9c3eee9d47ff49132c34f96b9180e50485d435d5748f0e8b72521d28d2e","impliedFormat":1},{"version":"05c97cddbaf99978f83d96de2d8af86aded9332592f08ce4a284d72d0952c391","impliedFormat":1},{"version":"14e5cdec6f8ae82dfd0694e64903a0a54abdfe37e1d966de3d4128362acbf35f","impliedFormat":1},{"version":"bbc183d2d69f4b59fd4dd8799ffdf4eb91173d1c4ad71cce91a3811c021bf80c","impliedFormat":1},{"version":"7b6ff760c8a240b40dab6e4419b989f06a5b782f4710d2967e67c695ef3e93c4","impliedFormat":1},{"version":"8dbc4134a4b3623fc476be5f36de35c40f2768e2e3d9ed437e0d5f1c4cd850f6","impliedFormat":1},{"version":"4e06330a84dec7287f7ebdd64978f41a9f70a668d3b5edc69d5d4a50b9b376bb","impliedFormat":1},{"version":"65bfa72967fbe9fc33353e1ac03f0480aa2e2ea346d61ff3ea997dfd850f641a","impliedFormat":1},{"version":"c06f0bb92d1a1a5a6c6e4b5389a5664d96d09c31673296cb7da5fe945d54d786","impliedFormat":1},{"version":"f974e4a06953682a2c15d5bd5114c0284d5abf8bc0fe4da25cb9159427b70072","impliedFormat":1},{"version":"872caaa31423f4345983d643e4649fb30f548e9883a334d6d1c5fff68ede22d4","impliedFormat":1},{"version":"94404c4a878fe291e7578a2a80264c6f18e9f1933fbb57e48f0eb368672e389c","impliedFormat":1},{"version":"5c1b7f03aa88be854bc15810bfd5bd5a1943c5a7620e1c53eddd2a013996343e","impliedFormat":1},{"version":"09dfc64fcd6a2785867f2368419859a6cc5a8d4e73cbe2538f205b1642eb0f51","impliedFormat":1},{"version":"bcf6f0a323653e72199105a9316d91463ad4744c546d1271310818b8cef7c608","impliedFormat":1},{"version":"01aa917531e116485beca44a14970834687b857757159769c16b228eb1e49c5f","impliedFormat":1},{"version":"351475f9c874c62f9b45b1f0dc7e2704e80dfd5f1af83a3a9f841f9dfe5b2912","impliedFormat":1},{"version":"ac457ad39e531b7649e7b40ee5847606eac64e236efd76c5d12db95bf4eacd17","impliedFormat":1},{"version":"187a6fdbdecb972510b7555f3caacb44b58415da8d5825d03a583c4b73fde4cf","impliedFormat":1},{"version":"d4c3250105a612202289b3a266bb7e323db144f6b9414f9dea85c531c098b811","impliedFormat":1},{"version":"95b444b8c311f2084f0fb51c616163f950fb2e35f4eaa07878f313a2d36c98a4","impliedFormat":1},{"version":"741067675daa6d4334a2dc80a4452ca3850e89d5852e330db7cb2b5f867173b1","impliedFormat":1},{"version":"f8acecec1114f11690956e007d920044799aefeb3cece9e7f4b1f8a1d542b2c9","impliedFormat":1},{"version":"178071ccd043967a58c5d1a032db0ddf9bd139e7920766b537d9783e88eb615e","impliedFormat":1},{"version":"3a17f09634c50cce884721f54fd9e7b98e03ac505889c560876291fcf8a09e90","impliedFormat":1},{"version":"32531dfbb0cdc4525296648f53b2b5c39b64282791e2a8c765712e49e6461046","impliedFormat":1},{"version":"0ce1b2237c1c3df49748d61568160d780d7b26693bd9feb3acb0744a152cd86d","impliedFormat":1},{"version":"e489985388e2c71d3542612685b4a7db326922b57ac880f299da7026a4e8a117","impliedFormat":1},{"version":"5cad4158616d7793296dd41e22e1257440910ea8d01c7b75045d4dfb20c5a41a","impliedFormat":1},{"version":"04d3aad777b6af5bd000bfc409907a159fe77e190b9d368da4ba649cdc28d39e","affectsGlobalScope":true,"impliedFormat":1},{"version":"74efc1d6523bd57eb159c18d805db4ead810626bc5bc7002a2c7f483044b2e0f","impliedFormat":1},{"version":"19252079538942a69be1645e153f7dbbc1ef56b4f983c633bf31fe26aeac32cd","impliedFormat":1},{"version":"bc11f3ac00ac060462597add171220aed628c393f2782ac75dd29ff1e0db871c","impliedFormat":1},{"version":"616775f16134fa9d01fc677ad3f76e68c051a056c22ab552c64cc281a9686790","impliedFormat":1},{"version":"65c24a8baa2cca1de069a0ba9fba82a173690f52d7e2d0f1f7542d59d5eb4db0","impliedFormat":1},{"version":"f9fe6af238339a0e5f7563acee3178f51db37f32a2e7c09f85273098cee7ec49","impliedFormat":1},{"version":"3b0b1d352b8d2e47f1c4df4fb0678702aee071155b12ef0185fce9eb4fa4af1e","impliedFormat":1},{"version":"77e71242e71ebf8528c5802993697878f0533db8f2299b4d36aa015bae08a79c","impliedFormat":1},{"version":"a344403e7a7384e0e7093942533d309194ad0a53eca2a3100c0b0ab4d3932773","impliedFormat":1},{"version":"b7fff2d004c5879cae335db8f954eb1d61242d9f2d28515e67902032723caeab","impliedFormat":1},{"version":"5f3dc10ae646f375776b4e028d2bed039a93eebbba105694d8b910feebbe8b9c","impliedFormat":1},{"version":"bb18bf4a61a17b4a6199eb3938ecfa4a59eb7c40843ad4a82b975ab6f7e3d925","impliedFormat":1},{"version":"4545c1a1ceca170d5d83452dd7c4994644c35cf676a671412601689d9a62da35","impliedFormat":1},{"version":"e9b6fc05f536dfddcdc65dbcf04e09391b1c968ab967382e48924f5cb90d88e1","impliedFormat":1},{"version":"a2d648d333cf67b9aeac5d81a1a379d563a8ffa91ddd61c6179f68de724260ff","impliedFormat":1},{"version":"2b664c3cc544d0e35276e1fb2d4989f7d4b4027ffc64da34ec83a6ccf2e5c528","impliedFormat":1},{"version":"a3f41ed1b4f2fc3049394b945a68ae4fdefd49fa1739c32f149d32c0545d67f5","impliedFormat":1},{"version":"3cd8f0464e0939b47bfccbb9bb474a6d87d57210e304029cd8eb59c63a81935d","impliedFormat":1},{"version":"47699512e6d8bebf7be488182427189f999affe3addc1c87c882d36b7f2d0b0e","impliedFormat":1},{"version":"3026abd48e5e312f2328629ede6e0f770d21c3cd32cee705c450e589d015ee09","impliedFormat":1},{"version":"8b140b398a6afbd17cc97c38aea5274b2f7f39b1ae5b62952cfe65bf493e3e75","impliedFormat":1},{"version":"7663d2c19ce5ef8288c790edba3d45af54e58c84f1b37b1249f6d49d962f3d91","impliedFormat":1},{"version":"5cce3b975cdb72b57ae7de745b3c5de5790781ee88bcb41ba142f07c0fa02e97","impliedFormat":1},{"version":"00bd6ebe607246b45296aa2b805bd6a58c859acecda154bfa91f5334d7c175c6","impliedFormat":1},{"version":"ad036a85efcd9e5b4f7dd5c1a7362c8478f9a3b6c3554654ca24a29aa850a9c5","impliedFormat":1},{"version":"fedebeae32c5cdd1a85b4e0504a01996e4a8adf3dfa72876920d3dd6e42978e7","impliedFormat":1},{"version":"0d28b974a7605c4eda20c943b3fa9ae16cb452c1666fc9b8c341b879992c7612","impliedFormat":1},{"version":"cdf21eee8007e339b1b9945abf4a7b44930b1d695cc528459e68a3adc39a622e","impliedFormat":1},{"version":"db036c56f79186da50af66511d37d9fe77fa6793381927292d17f81f787bb195","impliedFormat":1},{"version":"87ac2fb61e629e777f4d161dff534c2023ee15afd9cb3b1589b9b1f014e75c58","impliedFormat":1},{"version":"13c8b4348db91e2f7d694adc17e7438e6776bc506d5c8f5de9ad9989707fa3fe","impliedFormat":1},{"version":"3c1051617aa50b38e9efaabce25e10a5dd9b1f42e372ef0e8a674076a68742ed","impliedFormat":1},{"version":"07a3e20cdcb0f1182f452c0410606711fbea922ca76929a41aacb01104bc0d27","impliedFormat":1},{"version":"1de80059b8078ea5749941c9f863aa970b4735bdbb003be4925c853a8b6b4450","impliedFormat":1},{"version":"1d079c37fa53e3c21ed3fa214a27507bda9991f2a41458705b19ed8c2b61173d","impliedFormat":1},{"version":"4cd4b6b1279e9d744a3825cbd7757bbefe7f0708f3f1069179ad535f19e8ed2c","impliedFormat":1},{"version":"5835a6e0d7cd2738e56b671af0e561e7c1b4fb77751383672f4b009f4e161d70","impliedFormat":1},{"version":"c0eeaaa67c85c3bb6c52b629ebbfd3b2292dc67e8c0ffda2fc6cd2f78dc471e6","impliedFormat":1},{"version":"4b7f74b772140395e7af67c4841be1ab867c11b3b82a51b1aeb692822b76c872","impliedFormat":1},{"version":"27be6622e2922a1b412eb057faa854831b95db9db5035c3f6d4b677b902ab3b7","impliedFormat":1},{"version":"b95a6f019095dd1d48fd04965b50dfd63e5743a6e75478343c46d2582a5132bf","impliedFormat":99},{"version":"c2008605e78208cfa9cd70bd29856b72dda7ad89df5dc895920f8e10bcb9cd0a","impliedFormat":99},{"version":"b97cb5616d2ab82a98ec9ada7b9e9cabb1f5da880ec50ea2b8dc5baa4cbf3c16","impliedFormat":99},{"version":"d23df9ff06ae8bf1dcb7cc933e97ae7da418ac77749fecee758bb43a8d69f840","affectsGlobalScope":true,"impliedFormat":1},{"version":"040c71dde2c406f869ad2f41e8d4ce579cc60c8dbe5aa0dd8962ac943b846572","affectsGlobalScope":true,"impliedFormat":1},{"version":"3586f5ea3cc27083a17bd5c9059ede9421d587286d5a47f4341a4c2d00e4fa91","impliedFormat":1},{"version":"a6df929821e62f4719551f7955b9f42c0cd53c1370aec2dd322e24196a7dfe33","impliedFormat":1},{"version":"b789bf89eb19c777ed1e956dbad0925ca795701552d22e68fd130a032008b9f9","impliedFormat":1},"879741880b6ab48da99dcc06dcc674d381c9826137b0496bf7bb368f302de9fc",{"version":"402e5c534fb2b85fa771170595db3ac0dd532112c8fa44fc23f233bc6967488b","impliedFormat":1},{"version":"52dcc257df5119fb66d864625112ce5033ac51a4c2afe376a0b299d2f7f76e4a","impliedFormat":1},{"version":"e5bab5f871ef708d52d47b3e5d0aa72a08ee7a152f33931d9a60809711a2a9a3","impliedFormat":1},{"version":"e16dc2a81595736024a206c7d5c8a39bfe2e6039208ef29981d0d95434ba8fcf","impliedFormat":1},{"version":"cc4a4903fb698ca1d961d4c10dce658aa3a479faf40509d526f122b044eaf6a4","impliedFormat":1},{"version":"19ee8416e6473ed6c7adb868fa796b5653cf0fa2a337658e677eaa0d134388c3","impliedFormat":1},{"version":"1328ab4e442614b28cdb3d4b414cf68325c0da0dca07287a338d0654b7a00261","impliedFormat":1},{"version":"a039dc21f045919f3cbee2ec13812cc6cc3eebc99dae4be00973230f468d19a6","impliedFormat":1},{"version":"3fbe57af01460e49dcd29df55d6931e1672bc6f1be0fb073d11410bc16f9037d","impliedFormat":1},{"version":"f760be449e8562ec5c09bb5187e8e1eabf3c113c0c58cddda53ef8c69f3e2131","impliedFormat":1},{"version":"44325ed13294fce6ab825b82947bbeed2611db7dad9d9135260192f375e5a189","impliedFormat":1},{"version":"e392e8fb5b514eafc585601c1d781485aa6dd6a320e75daf1064a4c6918a1b45","impliedFormat":1},{"version":"46e4a36e8ddbdfb4e7330e11c81c970dc8b218611df9183d39c41c5f8c653b55","impliedFormat":1},{"version":"370bde134aa8c2abc926d0e99d3a4d5d5dba65c6ee65459137e4f02670cbf841","impliedFormat":1},{"version":"6332f565867cf4a740a70e30f31cefba37ef7cebcf74f22eab8d744fde6d193e","impliedFormat":1},{"version":"2977b7884aedc895a1d0c9c210c7cf3272c29d6959a08a6fa3ff71e0aff08175","impliedFormat":1},{"version":"17f2922d41ddd032830a91371c948cd9ce903b35c95adca72271a54584f19b0b","impliedFormat":1},{"version":"3eed76ede2a1a14d7c9bb0a642041282dcc264811139d3dd275c9fe14efc9840","impliedFormat":1},{"version":"e3cf0611709328b449ec13f8c436712d62003620ce480139fae46ce001c2ee9f","impliedFormat":1},{"version":"8d369483f0c2b9ee388129cfdb6a43bc8112b377e86a41884bd06e19ce04f4c1","impliedFormat":99},{"version":"b558c9a18ea4e6e4157124465c3ef1063e64640da139e67be5edb22f534f2f08","impliedFormat":1},{"version":"01374379f82be05d25c08d2f30779fa4a4c41895a18b93b33f14aeef51768692","impliedFormat":1},{"version":"b0dee183d4e65cf938242efaf3d833c6b645afb35039d058496965014f158141","impliedFormat":1},{"version":"c0bbbf84d3fbd85dd60d040c81e8964cc00e38124a52e9c5dcdedf45fea3f213","impliedFormat":1},"407f9734c3160d6426b5e805f63fe810fda85aec0189de7297b88956a3a7334d",{"version":"5a6237f90ea7b312ce8e331ad5ab88661ca01c64aad1fdfa4d8a9f2f64caf57d","impliedFormat":1},{"version":"924851e1867be3125328ac2172f79672c7fed11c1419798e10bce0017219b26d","impliedFormat":1},{"version":"a3628f430f8d502a5c026a0c932a5c41e6361d8e0248287872cd8999bc534399","impliedFormat":1},{"version":"1bc439753f06b24595c88990c27e2b84e1341f76f664d4567ca9d1bcf081838f","impliedFormat":99},{"version":"0deff63aaf571504405cb4be9de0bf0b445056d063d27d8ce9ab5a85da09d8c8","impliedFormat":1},{"version":"2b6c6039f4d2f656904d66f82231488f4852f861d27147884895097f74e3e812","impliedFormat":1},{"version":"cc6c527d304da87b8873bcf1cf9a47a12fe1630abaf5cbb2c60cbabd8e85e4c2","impliedFormat":1},{"version":"8d14d903616d2aad418dd902e2a7be61e8ba7b80b9ba33b2b1257bb79e961ca2","impliedFormat":1},{"version":"941959cd493fe9e8780f8a704791c83ffff2499447622f7ee63acc7bf08be0f9","impliedFormat":1},{"version":"1fcc4bb6d083b31e1587711ab5a8b0467b52a125f9735467774285bc8cc127e6","impliedFormat":1},{"version":"c938244bbaf0fe8eedb23df3f0da99dc945635043313cfeb0044eead923da54f","impliedFormat":1},{"version":"0e085cc503ad1332728d56244e9f7a603404beca17c0c5b2d815ed29e0727d4b","impliedFormat":1},{"version":"deda38d3245acb0404dd845dae172547c895c99c442082f176071cbb40d092f3","impliedFormat":1},{"version":"2776f7230a2ae50a27bc595893d0fcd8943869a8a3aaff99a2e3f86aafe54bdb","impliedFormat":1},{"version":"585951f20abc465c5acb3674fe5bad232c299f00d073d90c8cb1a416c807d41e","impliedFormat":1},{"version":"e6f3d02d69394dae0771c088b3c0b982cf15b6a91678c59f1d5fbd7c5e6ad8f8","impliedFormat":1},{"version":"ef182902b33ac9b9ad90c163b313722d2bc9d8c2cfefeb418b3205d70504a486","impliedFormat":1},{"version":"85ab6e0f7db4589337a6055a893bfc2f68b69a0492e94f3c12e08f537a830791","impliedFormat":1},{"version":"95bdd836ed77c23e530fcd3a0823df8fd611035590dfd8d38ee164c56f2bd2c4","impliedFormat":1},{"version":"d83c91738d6379bcdea4c8fac49953da13ff283a018c412e14775d12801003e0","impliedFormat":1},{"version":"e689e94b2f63be1124a32f5dfe4a6951aa0d39efb2bae9a635539780ed6f8c82","impliedFormat":1},{"version":"c0e42e780d502d530ce67e30d09a3b81c5d37d500c1f7ef04f4bd806f648b96a","impliedFormat":1},{"version":"447b6a80636a59c918ed18af1019de1efa94109a086e8fd8f3d20eb9b9a6937b","impliedFormat":99},{"version":"861366a94ece3ed48df00e92108710b63ff2284a1f6e4fa93ca3481f21a8ed2f","impliedFormat":99},{"version":"05c9c065eadecdce0ee370455e3c36674bfb08673f1a268a398002a0d2d801b7","impliedFormat":1},{"version":"694b2b1b03e4af8e8a065ee96fd91d4f780c118fcad6c5654eb4af785a3b6d61","impliedFormat":1},{"version":"0eae63800777384563d5727e572982c220d47acf736dcdb569a2749a32378f19","impliedFormat":1},{"version":"9bf41a89bd0bbd4f8a23a7925d04f99267cb84a5a5b239185f3320edea329b9c","impliedFormat":1},{"version":"c8699f2b983bbc3117260c84d2f9f11c83eb2b396ea881a69d4cf10ac73a339f","impliedFormat":1},{"version":"b688a3daef72eae05635460146810781dab458476b855c4366371e17f1a0b546","impliedFormat":1},{"version":"fc10e388394495e3de2a0abc66be6d6241c2cb0ce7417c3870561304530f2718","impliedFormat":1},{"version":"964de3d129316ff79eccce67973270c01d0ed9c61947535ff8f35509a46fe536","impliedFormat":1},{"version":"e444a4edd02caac4c129adb1033df87601f443a38b3b505ab368da6b9c5c5560","impliedFormat":1},{"version":"55683540197812a211dae818219cc9ea5e87655f76c13a8471ea0b5018c21c7f","impliedFormat":1},{"version":"170decb46fc69c7e82174fe44f308115628d033f11ee51c9d554f5ca735353f3","impliedFormat":1},{"version":"cd6afa99f7412ea1defa25be04032938f089491e448011a6e961718f22b13a08","impliedFormat":1},{"version":"4ae9b50481136302de9c77668621ed3a0b34998f3e091ca3701426f4fe369c8a","impliedFormat":1},{"version":"9ba9ecc57d2f52b3ed3ac229636ee9a36e92e18b80eeae11ffb546c12e56d5e5","impliedFormat":1},{"version":"4de20edd5c08e31e4c1b073bbb8b80b39e6d59a22a291a05f4d124927af4bc08","impliedFormat":1},{"version":"d182d419bb30a1408784ed95fbabd973dde7517641e04525f0ce761df5d193a5","impliedFormat":1},{"version":"624550b680420e388a98dafb6396ca6771e4f8347a7130ce4ba58ddfe200bae2","impliedFormat":99},"b385b91595f2f1d1cfb95e0429b9f106ca8317c0ab2cb9b6a4e07e51b60ac99b","fa9507dfb8e36ba2511b839e0a2cd8a3c906b40a9687f60160c9d0a0369e2758",{"version":"2556e7e8bb7e6f0bb3fe25f3da990d1812cb91f8c9b389354b6a0c8a6d687590","impliedFormat":99},{"version":"ad1c91ca536e0962dcbfcdff40073e3dd18da839e0baad3fe990cf0d10c93065","impliedFormat":99},{"version":"19cf605ba2a4e8fba017edebdddbbc45aea897ddc58b4aae4c55f382b570ff53","impliedFormat":99},{"version":"884aab8c07224434c034b49e88de0511f21536aa83ee88f1285160ba6d3fb77a","impliedFormat":99},{"version":"130b39b18c99e5678635f383ef57efaa507196838ddabb47cb104064e2ce4cd3","impliedFormat":99},{"version":"7618d2cb769e2093acd4623d645b683ab9fea78c262b3aa354aba9f5afdcaaee","impliedFormat":99},{"version":"029f1ce606891c3f57f4c0c60b8a46c8ced53e719d27a7c9693817f2fe37690b","impliedFormat":99},{"version":"83596c963e276a9c5911412fba37ae7c1fe280f2d77329928828eed5a3bfa9a6","impliedFormat":99},{"version":"81acfd3a01767770e559bc57d32684756989475be6ea32e2fe6255472c3ea116","impliedFormat":99},{"version":"88d0c3eae81868b4749ba5b88f9b6d564ee748321ce19a2f4269a4e9dd46020a","impliedFormat":99},{"version":"8266b39a828bfb2695cabfa403e7c1226d7d94599f21bea9f760e35f4ca7a576","impliedFormat":99},{"version":"c1c1e740195c882a776cf084acbaf963907785ee39e723c6375fec9a59bf2387","impliedFormat":99},{"version":"137f96b78e477e08876f6372072c3b6f1767672bf182013f84f8ae53d987ff86","impliedFormat":99},{"version":"29896c61d09880ff39f8a86873bf72ce4deb910158d3a496122781e29904c615","impliedFormat":99},{"version":"81ce540acef0d6972b0b163331583181be3603300f618dcd6a6a3138954ff30c","impliedFormat":99},{"version":"19990350fca066265b2c190c9b6cde1229f35002ea2d4df8c9e397e9942f6c89","impliedFormat":99},{"version":"8fb8fdda477cd7382477ffda92c2bb7d9f7ef583b1aa531eb6b2dc2f0a206c10","impliedFormat":99},{"version":"66995b0c991b5c5d42eff1d950733f85482c7419f7296ab8952e03718169e379","impliedFormat":99},{"version":"9863f888da357e35e013ca3465b794a490a198226bd8232c2f81fb44e16ff323","impliedFormat":99},{"version":"84bc2d80326a83ee4a6e7cba2fd480b86502660770c0e24da96535af597c9f1e","impliedFormat":99},{"version":"ea27768379b866ee3f5da2419650acdb01125479f7af73580a4bceb25b79e372","impliedFormat":99},{"version":"598931eeb4362542cae5845f95c5f0e45ac668925a40ce201e244d7fe808e965","impliedFormat":99},{"version":"da9ef88cde9f715756da642ad80c4cd87a987f465d325462d6bc2a0b11d202c8","impliedFormat":99},{"version":"b4c6184d78303b0816e779a48bef779b15aea4a66028eb819aac0abee8407dea","impliedFormat":99},{"version":"db085d2171d48938a99e851dafe0e486dce9859e5dfa73c21de5ed3d4d6fb0c5","impliedFormat":99},{"version":"62a3ad1ddd1f5974b3bf105680b3e09420f2230711d6520a521fab2be1a32838","impliedFormat":99},{"version":"a77be6fc44c876bc10c897107f84eaba10790913ebdcad40fcda7e47469b2160","impliedFormat":99},{"version":"06cf55b6da5cef54eaaf51cdc3d4e5ebf16adfdd9ebd20cec7fe719be9ced017","impliedFormat":99},{"version":"91f5dbcdb25d145a56cffe957ec665256827892d779ef108eb2f3864faff523b","impliedFormat":99},{"version":"052ba354bab8fb943e0bc05a0769f7b81d7c3b3c6cd0f5cfa53c7b2da2a525c5","impliedFormat":99},{"version":"927955a3de5857e0a1c575ced5a4245e74e6821d720ed213141347dd1870197f","impliedFormat":99},{"version":"fec804d54cd97dd77e956232fc37dc13f53e160d4bbeeb5489e86eeaa91f7ebd","impliedFormat":99},{"version":"75ef949153a3e6ff419e39d0fa5eb6617e92de5019738ad3c43872023d9665f5","impliedFormat":99},{"version":"ed9ce8e6dd5b2d00ab95efc44e4ad9d0eba77362e01619cb21dedfdedbad51b8","impliedFormat":1},{"version":"5520611f997f2b8e62a6e191da45b07813ac2e758304690606604a64ac0ca976","impliedFormat":1},{"version":"00b469cba48c9d772a4555216d21ba41cdb5a732af797ccb57267344f4fc6c3d","impliedFormat":1},{"version":"2766bf77766c85c25ec31586823fefb48344e64556faad7e75a3363e517814f6","impliedFormat":1},{"version":"b7d1eaffd8003e8dc0ec275e58bd24c7b9a4dbae2a2d0d83cf248c88237262ce","impliedFormat":99},{"version":"7a8b08c0521c3a9e1db3c8b14f37e59d838fdc32389f1193b96630b435a8e64e","impliedFormat":99},{"version":"2e54848617fae9eb73654d9cf4295d99dab4b9c759934e5b82e2e57e6aaaef20","impliedFormat":99},{"version":"ae056b7c3f727d492166d4c1169d5905ddd194128a014b5d2d621248ed94b49c","impliedFormat":99},{"version":"edc5d99a04130f066f6e8d31c7c3f9ba4749496356470279408833b4faee3554","impliedFormat":99},{"version":"2f502ac2473a2bbf0d6217f9660e9d5bf40165a2f91067596323898c53dab87c","impliedFormat":99},{"version":"21f27a0c8bc8d9a4e2cf6d9c60140f8b071d0e1ffddb4b7dcf6bbf74d0e8d470","impliedFormat":99},{"version":"754108a1e136331ac67dc8ee6aa9c95cb3bea3ac8bbf48dda7b0dbabbc8f970f","impliedFormat":99},{"version":"9e9979adc151111d71ad049305be1b6df324a98d1d1edd84adb1756cc1911bfd","impliedFormat":99},{"version":"0f38bcf19f105cd31ded5d46491ca50a46462c838816c358d445f41ac7a68f5a","impliedFormat":99},{"version":"a65fc667cd78d7cad733fab96f4bff3183c0dcbc15b083dce0055cffc5c64f9f","impliedFormat":99},{"version":"c735e27dfa775155120c50f714f594639dd7b6ad1878097feb005a0b5c59b7c2","impliedFormat":99},{"version":"f3dd541f4d87bba38dabf43fd06b7616c6f86b11608d30e61086ab39f84fa8d8","impliedFormat":99},{"version":"5583f1c0912e96625a30c20b83cff3d175194b222e4eb22170d19e33f7d8729f","impliedFormat":99},{"version":"a515b08047d24de84d89ad80b2843e565e65ed4a4e7cfc9707656470d7c555f9","impliedFormat":99},{"version":"cf43b2783a58e42fca6e45f0d47465b2ab855b7e9bea5ccb68447297df8aade5","impliedFormat":99},{"version":"27a3f158d8e6f59f29e55c37d4ae3c39574ee99539c4f12bcf46d29929974a62","impliedFormat":99},{"version":"a2d23e2f22006483c89f42077bd6a9bf92db721ebb5e0859b06fdb5c8369586d","impliedFormat":99},{"version":"6a8aec6851c09e4524937485f6553ec7332118482f3ed33238cea7496ff42103","impliedFormat":99},{"version":"d67fd6ea8cf37131627c7a9ae1de96d19d41cb32e741a475f0f56942576a7b3b","impliedFormat":99},{"version":"9b2f424a2c5c592d738100d898df3f9ee018bdd23a279f10849c3686abbec158","impliedFormat":99},{"version":"2fef96aedd23d59b6093d12d9f97c95e3a4008fcc02e8c68304235a1770fc70a","impliedFormat":99},{"version":"cdcf9ea426ad970f96ac930cd176d5c69c6c24eebd9fc580e1572d6c6a88f62c","impliedFormat":1},{"version":"23cd712e2ce083d68afe69224587438e5914b457b8acf87073c22494d706a3d0","impliedFormat":1},{"version":"156a859e21ef3244d13afeeba4e49760a6afa035c149dda52f0c45ea8903b338","impliedFormat":1},{"version":"3ac40516c33b87f751f7507346933081a26cdb8a3e11a6b3aa07d23f803c85db","impliedFormat":1},{"version":"4ac80270b6787c2b77a2d98a9714a71f4363c24b5890314f3ba582c94bfbe779","impliedFormat":1},{"version":"14e9acf826baba0ef4b5665704084896e7bcc06f65a9ab13af7e93d27d6b7069","impliedFormat":1},{"version":"68834d631c8838c715f225509cfc3927913b9cc7a4870460b5b60c8dbdb99baf","impliedFormat":1},{"version":"82e8858179f8b8895db6f005f2152d4eda2273721f52be47e22d48bd84590f95","impliedFormat":1},{"version":"eec76bf6b9346f3f95fa402621b889489e96930e72295b0369022f332e9b4a6a","impliedFormat":1},{"version":"171b96f31e3fbdb55fe570f2a29a5ee47223fdca95a84ea2142e4cc4feaf9dfe","impliedFormat":1},{"version":"ea6bc8de8b59f90a7a3960005fd01988f98fd0784e14bc6922dde2e93305ec7d","impliedFormat":1},{"version":"36107995674b29284a115e21a0618c4c2751b32a8766dd4cb3ba740308b16d59","impliedFormat":1},{"version":"914a0ae30d96d71915fc519ccb4efbf2b62c0ddfb3a3fc6129151076bc01dc60","impliedFormat":1},{"version":"9c32412007b5662fd34a8eb04292fb5314ec370d7016d1c2fb8aa193c807fe22","impliedFormat":1},{"version":"d243db6b25788f439e7e2f03c05688e92f46764351673bb0e7b2f3631232e186","impliedFormat":1},{"version":"4d327f7d72ad0918275cea3eee49a6a8dc8114ae1d5b7f3f5d0774de75f7439a","impliedFormat":1},{"version":"6ebe8ebb8659aaa9d1acbf3710d7dae3e923e97610238b9511c25dc39023a166","impliedFormat":1},{"version":"e85d7f8068f6a26710bff0cc8c0fc5e47f71089c3780fbede05857331d2ddec9","impliedFormat":1},{"version":"7befaf0e76b5671be1d47b77fcc65f2b0aad91cc26529df1904f4a7c46d216e9","impliedFormat":1},{"version":"0a60a292b89ca7218b8616f78e5bbd1c96b87e048849469cccb4355e98af959a","impliedFormat":1},{"version":"0b6e25234b4eec6ed96ab138d96eb70b135690d7dd01f3dd8a8ab291c35a683a","impliedFormat":1},{"version":"9666f2f84b985b62400d2e5ab0adae9ff44de9b2a34803c2c5bd3c8325b17dc0","impliedFormat":1},{"version":"40cd35c95e9cf22cfa5bd84e96408b6fcbca55295f4ff822390abb11afbc3dca","impliedFormat":1},{"version":"b1616b8959bf557feb16369c6124a97a0e74ed6f49d1df73bb4b9ddf68acf3f3","impliedFormat":1},{"version":"5b03a034c72146b61573aab280f295b015b9168470f2df05f6080a2122f9b4df","impliedFormat":1},{"version":"40b463c6766ca1b689bfcc46d26b5e295954f32ad43e37ee6953c0a677e4ae2b","impliedFormat":1},{"version":"249b9cab7f5d628b71308c7d9bb0a808b50b091e640ba3ed6e2d0516f4a8d91d","impliedFormat":1},{"version":"d33ce35e3f9cfcc1d94eca415bdd3bde94d5b153ffdd33e6c4455c029986c630","impliedFormat":1},{"version":"80aae6afc67faa5ac0b32b5b8bc8cc9f7fa299cff15cf09cc2e11fd28c6ae29e","impliedFormat":1},{"version":"f473cd2288991ff3221165dcf73cd5d24da30391f87e85b3dd4d0450c787a391","impliedFormat":1},{"version":"499e5b055a5aba1e1998f7311a6c441a369831c70905cc565ceac93c28083d53","impliedFormat":1},{"version":"8aee8b6d4f9f62cf3776cda1305fb18763e2aade7e13cea5bbe699112df85214","impliedFormat":1},{"version":"98498b101803bb3dde9f76a56e65c14b75db1cc8bec5f4db72be541570f74fc5","impliedFormat":1},{"version":"4dc59f6e1dbf3d5f66660fceabe6c174d3261b37b696ae1854f0dbaf255fc753","impliedFormat":1},{"version":"5d0375ca7310efb77e3ef18d068d53784faf62705e0ad04569597ae0e755c401","impliedFormat":1},{"version":"59af37caec41ecf7b2e76059c9672a49e682c1a2aa6f9d7dc78878f53aa284d6","impliedFormat":1},{"version":"addf417b9eb3f938fddf8d81e96393a165e4be0d4a8b6402292f9c634b1cb00d","impliedFormat":1},{"version":"436d7b4543b340b0f3eef4310d524242e41369b9652aa9c70428767c4dcac455","impliedFormat":1},{"version":"adf27937dba6af9f08a68c5b1d3fce0ca7d4b960c57e6d6c844e7d1a8e53adae","impliedFormat":1},{"version":"12950411eeab8563b349cb7959543d92d8d02c289ed893d78499a19becb5a8cc","impliedFormat":1},{"version":"2e85db9e6fd73cfa3d7f28e0ab6b55417ea18931423bd47b409a96e4a169e8e6","impliedFormat":1},{"version":"c46e079fe54c76f95c67fb89081b3e399da2c7d109e7dca8e4b58d83e332e605","impliedFormat":1},{"version":"114f493b30f364255290472111b5a4791d5902c308645670cd0401429cbc6930","impliedFormat":1},{"version":"b3fb72492a07a76f7bfa29ecadd029eea081df11512e4dfe6f930a5a9cb1fb75","impliedFormat":1},{"version":"66b99e58194754a9db09e8ae09b45f878a5041f9ba497feaa9db8cc9773cafcc","impliedFormat":99},"0dbd8a1f40e72423ce45b2bfe670a76dd9bef388c1f59a0ed7d9cbf471c9cb57",{"version":"ecc033be13e96f3dace588afe8c34fc195e2fe0dd086bafcfdbf0d1539a2c40a","impliedFormat":1},"d750b866b0363c83d8512221efd6cbdf19f44175e7cae292122c0f75d0b197c2","c85fd5f7c5732107d6d060c90727c38e0cd9ba1fda096b854e581666e014fc2c","28eb33d41032bad1de9cbc62609f152a8f476a6c9dd32d82ce7dd192e36ff150","95e85ae7899805ab6e8d274ba251a28b829c8521c38d404227a01dd237ef5e1f","465d6511870210420868e1dc2a7933a6f4a4ad42037dd9152da7bf765d4141f7",{"version":"d3cfde44f8089768ebb08098c96d01ca260b88bccf238d55eee93f1c620ff5a5","impliedFormat":1},{"version":"293eadad9dead44c6fd1db6de552663c33f215c55a1bfa2802a1bceed88ff0ec","impliedFormat":1},{"version":"833e92c058d033cde3f29a6c7603f517001d1ddd8020bc94d2067a3bc69b2a8e","impliedFormat":1},{"version":"08b2fae7b0f553ad9f79faec864b179fc58bc172e295a70943e8585dd85f600c","impliedFormat":1},{"version":"f12edf1672a94c578eca32216839604f1e1c16b40a1896198deabf99c882b340","impliedFormat":1},{"version":"e3498cf5e428e6c6b9e97bd88736f26d6cf147dedbfa5a8ad3ed8e05e059af8a","impliedFormat":1},{"version":"dba3f34531fd9b1b6e072928b6f885aa4d28dd6789cbd0e93563d43f4b62da53","impliedFormat":1},{"version":"f672c876c1a04a223cf2023b3d91e8a52bb1544c576b81bf64a8fec82be9969c","impliedFormat":1},{"version":"e4b03ddcf8563b1c0aee782a185286ed85a255ce8a30df8453aade2188bbc904","impliedFormat":1},{"version":"2329d90062487e1eaca87b5e06abcbbeeecf80a82f65f949fd332cfcf824b87b","impliedFormat":1},{"version":"25b3f581e12ede11e5739f57a86e8668fbc0124f6649506def306cad2c59d262","impliedFormat":1},{"version":"4fdb529707247a1a917a4626bfb6a293d52cd8ee57ccf03830ec91d39d606d6d","impliedFormat":1},{"version":"a9ebb67d6bbead6044b43714b50dcb77b8f7541ffe803046fdec1714c1eba206","impliedFormat":1},{"version":"5780b706cece027f0d4444fbb4e1af62dc51e19da7c3d3719f67b22b033859b9","impliedFormat":1},"d6cfce007d0814fdd068167396f6a604c4586d45536a1d35a98c9de7f789c218","b5a8b8ec88b45a32ac3db9326f51bf87cd4354d97cf0354d89e27660ba3b6035","e070ca44490ef857b0836dfaf683dc43ee57d3e03aaaaeaf505f72c8f75a907e","5da2d86036ec13f0303d916406c78cb6255696d6c5867fdfb8ad6714d99b4d35","c4d1279fa96578d76ffacb22d1aaf0dda6b88065f289b07e0a4cdac4ece8fef6","c0bb4d84b5beb8f5289d0e4790a16ce91e2d087723d502c81190f3acfbbd14e2","397840cd5d63a7bfaa9cd37c95f50170df52e70e091fd445c8e8f3a43cd2b407","a0c029450b9726be96429b105a4b38a14a1fc69afc6d5e1911c5d0f1c7e7dc7d","136eb88793fa5bc54656ba537e23ce0253cfcda2c32dc0e2ffdaccf1f49db262",{"version":"96d14f21b7652903852eef49379d04dbda28c16ed36468f8c9fa08f7c14c9538","impliedFormat":1}],"root":[392,417,459,460,565,[567,571],[586,594]],"options":{"allowJs":false,"esModuleInterop":true,"jsx":1,"module":99,"skipLibCheck":true,"strict":true},"referencedMap":[[571,1],[589,2],[588,3],[587,3],[590,4],[593,5],[592,6],[594,7],[569,8],[459,9],[568,9],[570,10],[565,11],[460,12],[567,9],[586,13],[392,14],[345,9],[454,15],[455,16],[453,17],[448,18],[457,19],[442,9],[443,20],[452,21],[447,22],[456,9],[451,23],[444,9],[445,9],[450,24],[446,21],[449,22],[419,25],[420,26],[418,9],[430,27],[424,9],[433,28],[425,9],[431,29],[429,29],[432,30],[428,31],[427,9],[426,32],[421,9],[437,33],[438,34],[436,35],[439,36],[435,37],[423,9],[422,9],[434,38],[441,39],[458,40],[595,9],[122,41],[123,41],[124,42],[76,43],[125,44],[126,45],[127,46],[71,9],[74,47],[72,9],[73,9],[128,48],[129,49],[130,50],[131,51],[132,52],[133,53],[134,53],[135,54],[136,55],[137,56],[138,57],[77,9],[75,9],[139,58],[140,59],[141,60],[175,61],[142,62],[143,9],[144,63],[145,64],[146,65],[147,66],[148,67],[149,68],[150,69],[151,70],[152,71],[153,71],[154,72],[155,9],[156,73],[157,74],[159,75],[158,76],[160,77],[161,78],[162,79],[163,80],[164,81],[165,82],[166,83],[167,84],[168,85],[169,86],[170,87],[171,88],[172,89],[78,9],[79,9],[80,9],[118,90],[119,9],[120,9],[121,77],[173,91],[174,92],[63,9],[180,93],[181,94],[179,95],[177,96],[178,97],[61,9],[64,98],[268,95],[504,99],[506,100],[509,100],[511,101],[510,100],[508,102],[507,102],[512,103],[564,104],[516,105],[515,106],[505,107],[517,108],[514,109],[513,100],[503,110],[501,9],[499,111],[502,112],[500,113],[498,114],[497,115],[495,116],[496,116],[494,9],[62,9],[466,117],[461,9],[463,118],[462,119],[473,117],[472,117],[474,120],[471,121],[469,117],[470,117],[467,122],[468,117],[519,123],[518,9],[465,124],[464,9],[475,125],[440,9],[70,126],[348,127],[352,128],[354,129],[201,130],[215,131],[319,132],[247,9],[322,133],[283,134],[292,135],[320,136],[202,137],[246,9],[248,138],[321,139],[222,140],[203,141],[227,140],[216,140],[186,140],[274,142],[275,143],[191,9],[271,144],[276,145],[363,146],[269,145],[364,147],[253,9],[272,148],[376,149],[375,150],[278,145],[374,9],[372,9],[373,151],[273,95],[260,152],[261,153],[270,154],[287,155],[288,156],[277,157],[255,158],[256,159],[367,160],[370,161],[234,162],[233,163],[232,164],[379,95],[231,165],[207,9],[382,9],[385,9],[384,95],[386,166],[182,9],[313,9],[214,167],[184,168],[336,9],[337,9],[339,9],[342,169],[338,9],[340,170],[341,170],[200,9],[213,9],[347,171],[355,172],[359,173],[196,174],[263,175],[262,9],[254,158],[282,176],[280,177],[279,9],[281,9],[286,178],[258,179],[195,180],[220,181],[310,182],[187,183],[194,184],[183,132],[324,185],[334,186],[323,9],[333,187],[221,9],[205,188],[301,189],[300,9],[307,190],[309,191],[302,192],[306,193],[308,190],[305,192],[304,190],[303,192],[243,194],[228,194],[295,195],[229,195],[189,196],[188,9],[299,197],[298,198],[297,199],[296,200],[190,201],[267,202],[284,203],[266,204],[291,205],[293,206],[290,204],[223,201],[176,9],[311,207],[249,208],[285,9],[332,209],[252,210],[327,211],[193,9],[328,212],[330,213],[331,214],[314,9],[326,183],[225,215],[312,216],[335,217],[197,9],[199,9],[204,218],[294,219],[192,220],[198,9],[251,221],[250,222],[206,223],[259,224],[257,225],[208,226],[210,227],[383,9],[209,228],[211,229],[350,9],[349,9],[351,9],[381,9],[212,230],[265,95],[69,9],[289,231],[235,9],[245,232],[224,9],[357,95],[366,233],[242,95],[361,145],[241,234],[344,235],[240,233],[185,9],[368,236],[238,95],[239,95],[230,9],[244,9],[237,237],[236,238],[226,239],[219,157],[329,9],[218,240],[217,9],[353,9],[264,95],[346,241],[60,9],[68,242],[65,95],[66,9],[67,9],[325,243],[318,244],[317,9],[316,245],[315,9],[356,246],[358,247],[360,248],[362,249],[365,250],[391,251],[369,251],[390,252],[371,253],[377,254],[378,255],[380,256],[387,257],[389,9],[388,258],[343,259],[493,260],[478,261],[491,262],[476,9],[477,263],[492,264],[487,265],[488,266],[486,267],[490,268],[484,269],[479,270],[489,271],[485,262],[482,9],[483,272],[480,9],[481,9],[409,273],[407,274],[408,275],[396,276],[397,274],[404,277],[395,278],[400,279],[410,9],[401,280],[406,281],[412,282],[411,283],[394,284],[402,285],[403,286],[398,287],[405,273],[399,288],[566,95],[393,9],[415,289],[414,9],[413,9],[416,290],[58,9],[59,9],[10,9],[11,9],[13,9],[12,9],[2,9],[14,9],[15,9],[16,9],[17,9],[18,9],[19,9],[20,9],[21,9],[3,9],[22,9],[23,9],[4,9],[24,9],[28,9],[25,9],[26,9],[27,9],[29,9],[30,9],[31,9],[5,9],[32,9],[33,9],[34,9],[35,9],[6,9],[39,9],[36,9],[37,9],[38,9],[40,9],[7,9],[41,9],[46,9],[47,9],[42,9],[43,9],[44,9],[45,9],[8,9],[51,9],[48,9],[49,9],[50,9],[52,9],[9,9],[53,9],[54,9],[55,9],[57,9],[56,9],[1,9],[96,291],[106,292],[95,291],[116,293],[87,294],[86,295],[115,258],[109,296],[114,297],[89,298],[103,299],[88,300],[112,301],[84,302],[83,258],[113,303],[85,304],[90,305],[91,9],[94,305],[81,9],[117,306],[107,307],[98,308],[99,309],[101,310],[97,311],[100,312],[110,258],[92,313],[93,314],[102,315],[82,316],[105,307],[104,305],[108,9],[111,317],[563,318],[538,319],[551,320],[535,321],[552,316],[561,322],[526,323],[527,324],[525,295],[560,258],[555,325],[559,326],[529,327],[548,328],[528,329],[558,330],[523,331],[524,332],[530,333],[531,9],[537,334],[534,333],[521,335],[562,336],[553,337],[541,338],[540,333],[542,339],[545,340],[539,341],[543,342],[556,258],[532,343],[533,344],[546,345],[522,346],[550,347],[549,333],[536,344],[544,348],[547,349],[554,9],[520,9],[557,350],[585,351],[575,352],[577,353],[584,354],[579,9],[580,9],[578,355],[581,356],[572,9],[573,9],[574,351],[576,357],[582,9],[583,358],[591,359],[417,360]],"affectedFilesPendingEmit":[571,589,588,587,590,593,592,594,569,459,568,570,565,460,567,586,591,417],"version":"5.9.3"}
```


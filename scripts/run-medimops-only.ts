import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { scrapePrice } from '@/lib/scraper';

type MonitorRow = Record<string, any>;

type SettingsRow = {
  id?: number;
  alert_email?: string | null;
  email?: string | null;
};

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    'Variabile SUPABASE_URL mancante. Aggiungila nei GitHub Secrets.'
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Variabile SUPABASE_SERVICE_ROLE_KEY mancante. Aggiungila nei GitHub Secrets.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
});

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(',', '.'));

  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100) / 100;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;

  const normalized = String(value).trim().toLowerCase();

  return ['true', '1', 'yes', 'y', 'si', 'sì'].includes(normalized);
}

function getArtist(row: MonitorRow): string {
  return String(row.artist || row.artista || '').trim();
}

function getAlbum(row: MonitorRow): string {
  return String(row.album || row.title || row.titolo || '').trim();
}

function getEdition(row: MonitorRow): string {
  return String(row.edition || row.edizione || '').trim();
}

function getMonitorLabel(row: MonitorRow): string {
  const parts = [getArtist(row), getAlbum(row), getEdition(row)].filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : `Monitor ${row.id}`;
}

function getMedimopsUrl(row: MonitorRow): string | null {
  const direct = String(row.medimops_url || '').trim();

  if (direct) return direct;

  const legacySite = String(row.site || '').trim().toLowerCase();
  const legacyUrl = String(row.url || '').trim();

  if (legacySite === 'medimops' && legacyUrl) {
    return legacyUrl;
  }

  return null;
}

function getMedimopsTarget(row: MonitorRow): number | null {
  const direct = toNumber(row.medimops_target_price);

  if (direct !== null) return direct;

  const legacySite = String(row.site || '').trim().toLowerCase();

  if (legacySite === 'medimops') {
    return toNumber(row.target_price);
  }

  return null;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

async function getAlertEmail(row: MonitorRow): Promise<string | null> {
  const rowEmail = String(row.alert_email || row.email || '').trim();

  if (rowEmail) return rowEmail;

  try {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle<SettingsRow>();

    const settingsEmail = String(
      data?.alert_email || data?.email || ''
    ).trim();

    if (settingsEmail) return settingsEmail;
  } catch {
    // Se la tabella settings non risponde, uso il fallback env.
  }

  const fallback = String(process.env.DEFAULT_ALERT_EMAIL || '').trim();

  return fallback || null;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

async function sendAlert(row: MonitorRow, price: number, target: number) {
  const recipient = await getAlertEmail(row);

  if (!recipient) {
    console.log(
      `[EMAIL] Nessun destinatario configurato per ${getMonitorLabel(row)}`
    );
    return;
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log('[EMAIL] SMTP non configurato. Email non inviata.');
    return;
  }

  const from =
    process.env.ALERT_FROM_EMAIL ||
    process.env.SMTP_USER ||
    'Music Price Monitor';

  const label = getMonitorLabel(row);
  const url = getMedimopsUrl(row);

  await transporter.sendMail({
    from,
    to: recipient,
    subject: `Prezzo Medimops in target: ${label}`,
    text: [
      `Il monitor Medimops è entrato in target.`,
      ``,
      `Titolo: ${label}`,
      `Prezzo attuale: ${formatEuro(price)}`,
      `Prezzo target: ${formatEuro(target)}`,
      url ? `URL: ${url}` : null
    ]
      .filter(Boolean)
      .join('\n')
  });

  console.log(`[EMAIL] Alert inviato a ${recipient} per ${label}`);
}

async function insertPriceCheck(input: {
  monitorId: string;
  price: number | null;
  status: string;
  source: string;
  errorMessage: string | null;
}) {
  try {
    await supabase.from('price_checks').insert({
      monitor_id: input.monitorId,
      price: input.price,
      status: input.status,
      source: input.source,
      error_message: input.errorMessage
    });
  } catch {
    // I log non devono mai bloccare il cron.
  }
}

async function updateMonitor(row: MonitorRow, input: {
  price: number | null;
  target: number | null;
  source: string;
  error: string | null;
}) {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    medimops_current_price: input.price,
    last_checked_at: now,
    last_error: input.error,
    status: input.error ? 'error' : 'ok'
  };

  const legacySite = String(row.site || '').trim().toLowerCase();

  if (legacySite === 'medimops') {
    update.current_price = input.price;
  }

  if (input.price !== null && input.target !== null) {
    const belowTarget = input.price <= input.target;

    if (belowTarget) {
      update.status = 'ok';

      if (!toBoolean(row.alert_sent)) {
        await sendAlert(row, input.price, input.target);
        update.alert_sent = true;
      }
    } else {
      update.alert_sent = false;
    }
  }

  const { error } = await supabase
    .from('monitors')
    .update(update)
    .eq('id', row.id);

  if (error) {
    throw new Error(
      `Errore aggiornamento monitor ${row.id}: ${error.message}`
    );
  }

  await insertPriceCheck({
    monitorId: row.id,
    price: input.price,
    status: update.status === 'error' ? 'error' : 'ok',
    source: `Medimops:${input.source}`,
    errorMessage: input.error
  });
}

async function runMedimopsOnly() {
  console.log('========================================');
  console.log('MUSIC PRICE MONITOR - MEDIMOPS ONLY');
  console.log('Amazon disattivato.');
  console.log('Momox disattivato.');
  console.log('========================================');

  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .order('artist', { ascending: true });

  if (error) {
    throw new Error(`Errore lettura monitors: ${error.message}`);
  }

  const rows = (data || []) as MonitorRow[];

  let checked = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const active = row.is_active === undefined ? true : toBoolean(row.is_active);

    if (!active) {
      skipped += 1;
      continue;
    }

    const medimopsUrl = getMedimopsUrl(row);
    const medimopsTarget = getMedimopsTarget(row);

    if (!medimopsUrl) {
      skipped += 1;
      continue;
    }

    checked += 1;

    console.log('');
    console.log('----------------------------------------');
    console.log(`Monitor: ${getMonitorLabel(row)}`);
    console.log(`Medimops URL: ${medimopsUrl}`);
    console.log(
      `Target: ${medimopsTarget === null ? '-' : formatEuro(medimopsTarget)}`
    );

    try {
      const result = await scrapePrice(medimopsUrl);

      console.log(
        `Risultato: ${
          result.price === null ? '-' : formatEuro(result.price)
        } | source=${result.source} | error=${result.error || '-'}`
      );

      await updateMonitor(row, {
        price: result.price,
        target: medimopsTarget,
        source: result.source,
        error: result.error
      });
    } catch (error) {
      failed += 1;

      const message =
        error instanceof Error
          ? error.message
          : 'Errore sconosciuto durante controllo Medimops';

      console.log(`Errore: ${message}`);

      await updateMonitor(row, {
        price: null,
        target: medimopsTarget,
        source: 'exception',
        error: message
      });
    }
  }

  console.log('');
  console.log('================================--------');
  console.log('MEDIMOPS ONLY FINITO');
  console.log(`Controllati: ${checked}`);
  console.log(`Saltati: ${skipped}`);
  console.log(`Falliti: ${failed}`);
  console.log('========================================');
}

runMedimopsOnly().catch((error) => {
  console.error('MEDIMOPS ONLY CRASH');
  console.error(error);
  process.exitCode = 1;
});

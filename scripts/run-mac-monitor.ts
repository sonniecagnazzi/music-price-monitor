import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type StoreName = 'Medimops' | 'Momox';

type ScrapeOutcome = {
  store: StoreName;
  status: 'ok' | 'error' | 'skipped';
  price: number | null;
  condition: string | null;
  rawCondition: string | null;
  rawPrice: string | null;
  message: string;
};

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');

    if (index < 0) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve('.env.local'));
loadEnvFile(path.resolve('.env'));

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERRORE: mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function getArgValue(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);

  if (index >= 0 && args[index + 1]) return args[index + 1];

  return null;
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(value: string): string {
  return normalize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function appleString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', script], {
    maxBuffer: 30 * 1024 * 1024
  });

  return stdout;
}

async function openDedicatedChromeWindow(): Promise<number> {
  const script = `
tell application "Google Chrome"
  activate
  set newWindow to make new window
  return id of newWindow
end tell
`;

  const outputText = await runAppleScript(script);
  const windowId = Number(outputText.trim());

  if (!Number.isFinite(windowId)) {
    throw new Error(`Impossibile aprire finestra Chrome dedicata. Output: ${outputText}`);
  }

  return windowId;
}

async function closeChromeWindow(windowId: number): Promise<void> {
  const script = `
tell application "Google Chrome"
  try
    close window id ${windowId}
  end try
end tell
`;

  await runAppleScript(script);
}

async function navigateChromeWindow(windowId: number, url: string): Promise<void> {
  const script = `
tell application "Google Chrome"
  tell active tab of window id ${windowId}
    set URL to ${appleString(url)}
  end tell
end tell
`;

  await runAppleScript(script);
}

async function readChromeWindow(windowId: number): Promise<{
  actualUrl: string;
  title: string;
  text: string;
}> {
  const script = `
tell application "Google Chrome"
  tell active tab of window id ${windowId}
    set pageUrl to URL
    set pageTitle to title
    set pageText to execute javascript "document.body ? document.body.innerText : ''"
    return pageUrl & "MPM_SPLIT_URL" & pageTitle & "MPM_SPLIT_TITLE" & pageText
  end tell
end tell
`;

  const result = await runAppleScript(script);
  const [actualUrl = '', rest = ''] = result.split('MPM_SPLIT_URL');
  const [title = '', text = ''] = rest.split('MPM_SPLIT_TITLE');

  return {
    actualUrl: actualUrl.trim(),
    title: title.trim(),
    text
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlocked(title: string, text: string): boolean {
  const normalized = normalizeForSearch(`${title}\n${text}`);

  return (
    normalized.includes('just a moment') ||
    normalized.includes('cloudflare') ||
    normalized.includes('attention required') ||
    normalized.includes('captcha') ||
    normalized.includes('verify you are human')
  );
}

function isUnavailableText(value: string): boolean {
  const normalized = normalizeForSearch(value);

  return (
    normalized.includes('gerade ausverkauft') ||
    normalized.includes('actuellement non disponible') ||
    normalized.includes('non disponible') ||
    normalized.includes('derzeit nicht verfugbar') ||
    normalized.includes('nicht verfugbar') ||
    normalized.includes('sold out') ||
    normalized.includes('currently unavailable') ||
    normalized.includes('unavailable')
  );
}

function parsePriceString(value: string): number | null {
  const match = value.match(/([0-9]{1,4}(?:[.,][0-9]{2}))/);

  if (!match) return null;

  const parsed = Number(match[1].replace('.', '').replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.round(parsed * 100) / 100;
}

function mapCondition(value: string): string | null {
  const normalized = normalizeForSearch(value);

  if (normalized.includes('wie neu') || normalized.includes('comme neuf')) return 'NM';
  if (normalized.includes('sehr gut') || normalized.includes('tres bon')) return 'EX';

  if (
    normalized.includes('gebraucht - gut') ||
    normalized === 'gut' ||
    normalized.includes('bon etat')
  ) {
    return 'VG';
  }

  if (normalized.includes('akzeptabel') || normalized.includes('acceptable')) return 'G';

  return null;
}

function extractMainOffer(text: string, url: string): {
  price: number | null;
  condition: string | null;
  rawCondition: string | null;
  rawPrice: string | null;
} {
  const lines = text
    .split('\n')
    .map((line) => normalize(line))
    .filter(Boolean);

  const normalizedLines = lines.map((line) => normalizeForSearch(line));
  const isMomox = url.includes('momox-shop.fr');

  const anchorIndex = normalizedLines.findIndex((line) => {
    if (isMomox) return line.includes('choisissez') && line.includes('etat');

    return line === 'zustand' || line.includes('zustand');
  });

  if (anchorIndex < 0) {
    return { price: null, condition: null, rawCondition: null, rawPrice: null };
  }

  const windowLines = lines.slice(anchorIndex + 1, anchorIndex + 12);
  const conditionIndex = windowLines.findIndex((line) => mapCondition(line) !== null);
  const conditionLine = conditionIndex >= 0 ? windowLines[conditionIndex] : null;

  const priceSearchWindow =
    conditionIndex >= 0 ? windowLines.slice(conditionIndex + 1) : windowLines;

  const priceLine = priceSearchWindow.find((line) => parsePriceString(line) !== null) || null;

  return {
    price: priceLine ? parsePriceString(priceLine) : null,
    condition: conditionLine ? mapCondition(conditionLine) : null,
    rawCondition: conditionLine,
    rawPrice: priceLine
  };
}

function getString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed || null;
}

function getNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function hasKey(row: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function setIfExists(
  row: Record<string, unknown>,
  update: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  if (hasKey(row, key)) update[key] = value;
}

function isEligibleCondition(condition: string | null): boolean {
  return condition === 'NM' || condition === 'EX';
}

function isInTarget(price: number | null, target: number | null, condition: string | null): boolean {
  if (price === null || target === null) return false;
  if (!isEligibleCondition(condition)) return false;

  return price <= target;
}

function computeLastStatus(
  row: Record<string, unknown>,
  medimops: ScrapeOutcome,
  momox: ScrapeOutcome
): string {
  const medTarget = getNumber(row, 'medimops_target_price');
  const momoxTarget = getNumber(row, 'momox_target_price');

  if (
    medimops.status === 'ok' &&
    isInTarget(medimops.price, medTarget, medimops.condition)
  ) {
    return 'below_target';
  }

  if (
    momox.status === 'ok' &&
    isInTarget(momox.price, momoxTarget, momox.condition)
  ) {
    return 'below_target';
  }

  if (medimops.status === 'ok' || momox.status === 'ok') return 'ok';
  if (medimops.status === 'error' || momox.status === 'error') return 'error';

  return 'skipped';
}

async function scrapeStoreWithChrome(
  windowId: number,
  rl: ReturnType<typeof createInterface>,
  store: StoreName,
  url: string | null
): Promise<ScrapeOutcome> {
  if (!url) {
    return {
      store,
      status: 'skipped',
      price: null,
      condition: null,
      rawCondition: null,
      rawPrice: null,
      message: `${store}: URL mancante.`
    };
  }

  console.log(`[mac-monitor] ${store}: apro ${url}`);

  try {
    await navigateChromeWindow(windowId, url);
    await sleep(10000);

    let page = await readChromeWindow(windowId);

    if (isBlocked(page.title, page.text)) {
      console.log(`[mac-monitor] ${store}: Cloudflare/verifica rilevata.`);
      console.log('Completa manualmente in Chrome finché vedi il prezzo reale.');
      await rl.question('Quando vedi il prezzo nella pagina, premi Invio qui nel Terminale... ');
      page = await readChromeWindow(windowId);
    }

    if (isBlocked(page.title, page.text)) {
      return {
        store,
        status: 'error',
        price: null,
        condition: null,
        rawCondition: null,
        rawPrice: null,
        message: `${store}: pagina ancora bloccata dopo verifica manuale.`
      };
    }

    if (isUnavailableText(page.text)) {
      return {
        store,
        status: 'ok',
        price: null,
        condition: null,
        rawCondition: null,
        rawPrice: null,
        message: `${store}: prodotto non disponibile.`
      };
    }

    const offer = extractMainOffer(page.text, url);

    if (offer.price === null) {
      return {
        store,
        status: 'error',
        price: null,
        condition: null,
        rawCondition: offer.rawCondition,
        rawPrice: offer.rawPrice,
        message: `${store}: prezzo principale non trovato.`
      };
    }

    return {
      store,
      status: 'ok',
      price: offer.price,
      condition: offer.condition,
      rawCondition: offer.rawCondition,
      rawPrice: offer.rawPrice,
      message: `${store}: ${offer.price.toFixed(2)} €, condizione ${offer.condition || 'n/d'}.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'errore sconosciuto';

    return {
      store,
      status: 'error',
      price: null,
      condition: null,
      rawCondition: null,
      rawPrice: null,
      message: `${store}: ${message}`
    };
  }
}

async function updateMonitorRow(
  row: Record<string, unknown>,
  medimops: ScrapeOutcome,
  momox: ScrapeOutcome
): Promise<void> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};

  if (medimops.status === 'ok') {
    setIfExists(row, update, 'medimops_current_price', medimops.price);
    setIfExists(row, update, 'medimops_condition', medimops.condition);
  }

  if (momox.status === 'ok') {
    setIfExists(row, update, 'momox_current_price', momox.price);
    setIfExists(row, update, 'momox_condition', momox.condition);
  }

  const hasFreshOk = medimops.status === 'ok' || momox.status === 'ok';

  if (hasFreshOk) {
    setIfExists(row, update, 'last_checked_at', now);
  }

  setIfExists(row, update, 'last_status', computeLastStatus(row, medimops, momox));

  const errorMessages = [medimops, momox]
    .filter((item) => item.status === 'error')
    .map((item) => item.message);

  setIfExists(row, update, 'last_error', errorMessages.length > 0 ? errorMessages.join(' | ') : null);
  setIfExists(row, update, 'updated_at', now);

  const freshEligiblePrices = [medimops, momox]
    .filter((item) => item.status === 'ok')
    .filter((item) => isEligibleCondition(item.condition))
    .map((item) => item.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));

  if (freshEligiblePrices.length > 0 && hasKey(row, 'lowest_best_price')) {
    const currentFreshBest = Math.min(...freshEligiblePrices);
    const previousLowest = getNumber(row, 'lowest_best_price');

    if (previousLowest === null || currentFreshBest < previousLowest) {
      update.lowest_best_price = currentFreshBest;

      if (hasKey(row, 'lowest_best_price_at')) {
        update.lowest_best_price_at = now;
      }
    }
  }

  const id = String(row.id);

  const { error } = await supabase
    .from('monitors')
    .update(update)
    .eq('id', id);

  if (error) {
    throw new Error(`Errore update Supabase: ${error.message}`);
  }

  console.log('[mac-monitor] Supabase aggiornato.');
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

async function fetchRowsByIds(monitorIds: string[]): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .in('id', monitorIds);

  if (error) {
    throw new Error(`Errore lettura Supabase: ${error.message}`);
  }

  const rows = (data || []) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    throw new Error('Nessun monitor trovato per gli ID indicati.');
  }

  if (rows.length !== monitorIds.length) {
    console.log(`[mac-monitor] ATTENZIONE: richiesti ${monitorIds.length} record, trovati ${rows.length}.`);
  }

  const rowsById = new Map(rows.map((row) => [String(row.id), row]));

  return monitorIds
    .map((id) => rowsById.get(id))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

async function fetchAllActiveRows(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('monitors')
    .select('*');

  if (error) {
    throw new Error(`Errore lettura Supabase: ${error.message}`);
  }

  const rows = ((data || []) as Array<Record<string, unknown>>)
    .filter((row) => row.active !== false);

  if (rows.length === 0) {
    throw new Error('Nessun monitor attivo trovato.');
  }

  return rows;
}

async function processRows(orderedRows: Array<Record<string, unknown>>): Promise<{
  completed: number;
  errors: number;
}> {
  const rl = createInterface({ input, output });
  const windowId = await openDedicatedChromeWindow();

  console.log(`[mac-monitor] Finestra Chrome dedicata: ${windowId}`);

  let completed = 0;
  let errors = 0;

  try {
    for (const record of orderedRows) {
      const id = String(record.id);
      const artist = getString(record, 'artist') || 'Artista n/d';
      const title = getString(record, 'title') || 'Titolo n/d';

      console.log('\n============================================================');
      console.log(`[mac-monitor] ${completed + 1}/${orderedRows.length} - ${artist} - ${title}`);
      console.log(`[mac-monitor] ID: ${id}`);

      const medimopsUrl = getString(record, 'medimops_url');
      const momoxUrl = getString(record, 'momox_url');

      const medimops = await scrapeStoreWithChrome(windowId, rl, 'Medimops', medimopsUrl);
      const momox = await scrapeStoreWithChrome(windowId, rl, 'Momox', momoxUrl);

      console.log('\n[mac-monitor] Risultato record:');
      console.log(`- ${medimops.message}`);
      console.log(`- ${momox.message}`);

      await updateMonitorRow(record, medimops, momox);

      if (medimops.status === 'error' || momox.status === 'error') {
        errors += 1;
      }

      completed += 1;
    }
  } finally {
    rl.close();
    await closeChromeWindow(windowId);
  }

  return { completed, errors };
}

async function runDirectMode(): Promise<void> {
  const singleId = getArgValue('--single');
  const selectedIdsRaw = getArgValue('--selected');
  const allMode = hasArg('--all');

  const monitorIds = singleId
    ? [singleId]
    : selectedIdsRaw
      ? selectedIdsRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  if (!singleId && !selectedIdsRaw && !allMode) {
    console.error('Uso:');
    console.error('  yarn monitor:mac --single <monitor_id>');
    console.error('  yarn monitor:mac --selected <id1,id2,id3>');
    console.error('  yarn monitor:mac --all');
    console.error('  yarn mac-runner');
    console.error('  yarn mac-runner:once');
    process.exit(1);
  }

  const mode = allMode ? 'all' : singleId ? 'single' : 'selected';

  console.log(`[mac-monitor] Avvio controllo modalità: ${mode}`);

  const rows = allMode
    ? await fetchAllActiveRows()
    : await fetchRowsByIds(monitorIds);

  console.log(`[mac-monitor] Record da controllare: ${rows.length}`);

  const summary = await processRows(rows);

  console.log('\n[mac-monitor] Fine.');
  console.log(`[mac-monitor] Record completati: ${summary.completed}`);
  console.log(`[mac-monitor] Record con errori: ${summary.errors}`);
}

function getJobMonitorIds(job: Record<string, unknown>): string[] {
  const value = job.monitor_ids;

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function processNextPendingJob(): Promise<boolean> {
  const { data: pendingJob, error: pendingError } = await supabase
    .from('mac_monitor_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    throw new Error(`Errore lettura job pending: ${pendingError.message}`);
  }

  if (!pendingJob) {
    return false;
  }

  const job = pendingJob as Record<string, unknown>;
  const jobId = String(job.id);
  const mode = getString(job, 'mode') || 'single';
  const runnerId = `mac-${process.env.USER || 'user'}-${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log('\n============================================================');
  console.log(`[mac-runner] Job trovato: ${jobId}`);
  console.log(`[mac-runner] Mode: ${mode}`);

  const { data: claimedJob, error: claimError } = await supabase
    .from('mac_monitor_jobs')
    .update({
      status: 'running',
      runner_id: runnerId,
      started_at: startedAt,
      error_message: null
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimError) {
    throw new Error(`Errore claim job: ${claimError.message}`);
  }

  if (!claimedJob) {
    console.log('[mac-runner] Job già preso da un altro runner.');
    return false;
  }

  try {
    const claimed = claimedJob as Record<string, unknown>;
    const monitorIds = getJobMonitorIds(claimed);

    const rows =
      mode === 'all'
        ? await fetchAllActiveRows()
        : await fetchRowsByIds(monitorIds);

    console.log(`[mac-runner] Record da controllare: ${rows.length}`);

    const summary = await processRows(rows);

    await supabase
      .from('mac_monitor_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_summary: summary,
        error_message: null
      })
      .eq('id', jobId);

    console.log(`[mac-runner] Job completato: ${jobId}`);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'errore sconosciuto';

    await supabase
      .from('mac_monitor_jobs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: message
      })
      .eq('id', jobId);

    console.error(`[mac-runner] Job in errore: ${message}`);

    throw error;
  }
}

async function watchPendingJobs(): Promise<void> {
  console.log('[mac-runner] Avvio runner locale. Premi Ctrl+C per fermarlo.');
  console.log('[mac-runner] Controllo job pending ogni 5 secondi.');

  while (true) {
    try {
      const processed = await processNextPendingJob();

      if (!processed) {
        await sleep(5000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'errore sconosciuto';
      console.error(`[mac-runner] Errore ciclo runner: ${message}`);
      await sleep(5000);
    }
  }
}

async function main(): Promise<void> {
  if (hasArg('--job-once')) {
    const processed = await processNextPendingJob();

    if (!processed) {
      console.log('[mac-runner] Nessun job pending.');
    }

    return;
  }

  if (hasArg('--watch')) {
    await watchPendingJobs();
    return;
  }

  await runDirectMode();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

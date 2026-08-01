import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { sendTargetSummaryEmail, type TargetEmailOffer } from '@/lib/email';

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


const RUNNER_HOME_MARKER = 'MPM_RUNNER_WINDOW';
const RUNNER_HOME_TITLE = 'MPM Runner';
const RUNNER_HOME_HTML = `<!doctype html>
<html>
  <head>
    <title>${RUNNER_HOME_TITLE}</title>
    <meta charset="utf-8" />
  </head>
  <body data-mpm-runner="${RUNNER_HOME_MARKER}" style="font-family: system-ui; padding: 32px;">
    <h1>Music Price Monitor</h1>
    <p>Finestra dedicata al Mac runner. Puoi lasciarla su Desktop 2.</p>
    <p style="opacity: 0.45; font-size: 12px;">${RUNNER_HOME_MARKER}</p>
  </body>
</html>`;
const RUNNER_HOME_URL = `data:text/html;charset=utf-8,${encodeURIComponent(RUNNER_HOME_HTML)}`;
const RUNNER_WINDOW_ID_FILE = '.mac-runner-window-id';
let cachedRunnerWindowId: number | null = null;

function asAppleScriptString(value: string): string {
  return JSON.stringify(value);
}

function parseChromeWindowId(value: unknown): number | null {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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

function readStoredRunnerWindowId(): number | null {
  if (cachedRunnerWindowId !== null) {
    return cachedRunnerWindowId;
  }

  try {
    if (!existsSync(RUNNER_WINDOW_ID_FILE)) {
      return null;
    }

    const value = readFileSync(RUNNER_WINDOW_ID_FILE, 'utf8').trim();
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    cachedRunnerWindowId = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredRunnerWindowId(windowId: number): void {
  cachedRunnerWindowId = windowId;
  writeFileSync(RUNNER_WINDOW_ID_FILE, String(windowId));
}

async function validateChromeWindowId(windowId: number): Promise<number | null> {
  try {
    const output = await runAppleScript(`
tell application "Google Chrome"
  try
    set targetWindow to window id ${windowId}
    return id of targetWindow
  on error
    return ""
  end try
end tell
`);

    return parseChromeWindowId(output);
  } catch {
    return null;
  }
}

async function findRunnerWindowByMarker(): Promise<number | null> {
  const markerTitle = asAppleScriptString(RUNNER_HOME_TITLE);
  const markerToken = asAppleScriptString(RUNNER_HOME_MARKER);
  const markerUrl = asAppleScriptString(RUNNER_HOME_URL);

  const output = await runAppleScript(`
tell application "Google Chrome"
  repeat with w in windows
    try
      repeat with t in tabs of w
        try
          set tabTitle to title of t as string
          set tabUrl to URL of t as string

          if tabTitle is ${markerTitle} or tabUrl contains ${markerToken} then
            set active tab index of w to index of t
            return id of w
          end if
        end try
      end repeat
    end try
  end repeat

  return ""
end tell
`);

  const parsed = parseChromeWindowId(output);

  if (parsed === null) {
    return null;
  }

  await runAppleScript(`
tell application "Google Chrome"
  tell active tab of window id ${parsed}
    set URL to ${markerUrl}
  end tell
end tell
`);

  return parsed;
}

async function createRunnerWindow(): Promise<number> {
  const markerUrl = asAppleScriptString(RUNNER_HOME_URL);

  const output = await runAppleScript(`
tell application "Google Chrome"
  set newWindow to make new window
  set URL of active tab of newWindow to ${markerUrl}
  delay 1
  return id of newWindow
end tell
`);

  const windowId = parseChromeWindowId(output);

  if (windowId === null) {
    throw new Error(`ID finestra Chrome non valido: ${output}`);
  }

  return windowId;
}

async function openDedicatedChromeWindow(): Promise<number> {
  const storedWindowId = readStoredRunnerWindowId();

  if (storedWindowId !== null) {
    const validWindowId = await validateChromeWindowId(storedWindowId);

    if (validWindowId !== null) {
      console.log(`[mac-monitor] Riutilizzo finestra Chrome runner salvata: ${validWindowId}`);
      saveStoredRunnerWindowId(validWindowId);
      return validWindowId;
    }

    console.log('[mac-monitor] Finestra Chrome runner salvata non trovata: ne cerco/creo una nuova.');
  }

  const foundWindowId = await findRunnerWindowByMarker();

  if (foundWindowId !== null) {
    console.log(`[mac-monitor] Riutilizzo finestra Chrome runner trovata: ${foundWindowId}`);
    saveStoredRunnerWindowId(foundWindowId);
    return foundWindowId;
  }

  const newWindowId = await createRunnerWindow();

  console.log(`[mac-monitor] Nuova finestra Chrome runner creata: ${newWindowId}`);
  saveStoredRunnerWindowId(newWindowId);

  return newWindowId;
}

async function closeChromeWindow(windowId: number | string): Promise<void> {
  if (process.env.MAC_CHROME_CLOSE === '1') {
    await runAppleScript(`
tell application "Google Chrome"
  try
    close window id ${windowId}
  end try
end tell
`);
    return;
  }

  try {
    const markerUrl = asAppleScriptString(RUNNER_HOME_URL);

    await runAppleScript(`
tell application "Google Chrome"
  tell active tab of window id ${windowId}
    set URL to ${markerUrl}
  end tell
end tell
`);
    await sleep(500);
    console.log('[mac-monitor] Finestra Chrome runner lasciata aperta per i prossimi job.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'errore sconosciuto';
    console.log(`[mac-monitor] Non riesco a riportare la finestra runner alla home: ${message}`);
  }
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
    await sleep(4000);

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


function parkChromeRunnerWindow(windowId: number | string): void {
  if (process.env.MAC_CHROME_PARK !== '1') {
    return;
  }

  try {
    runAppleScript(`
tell application "Google Chrome"
  try
    set bounds of window id ${windowId} to {-1600, 80, -700, 700}
  end try
end tell
`);
    console.log('[mac-monitor] Finestra Chrome runner parcheggiata fuori schermo.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'errore sconosciuto';
    console.log(`[mac-monitor] Non riesco a parcheggiare la finestra Chrome, continuo comunque: ${message}`);
  }
}



type ProcessRowsSummary = {
  completed: number;
  errors: number;
  targetOffers: TargetEmailOffer[];
};

function getDefaultRecipient(): string {
  return String(process.env.DEFAULT_ALERT_EMAIL || '').trim();
}

function getMonitorDisplayTitle(row: Record<string, unknown>): string {
  return (
    getString(row, 'title') ||
    getString(row, 'album') ||
    getString(row, 'name') ||
    'Titolo n/d'
  );
}

function getMonitorType(row: Record<string, unknown>): 'CD' | 'LP' {
  const value = String(getString(row, 'type') || 'CD').toUpperCase();

  return value === 'LP' ? 'LP' : 'CD';
}

function buildMacTargetOffer(
  row: Record<string, unknown>,
  outcome: ScrapeOutcome
): TargetEmailOffer | null {
  if (outcome.status !== 'ok') return null;
  if (outcome.price === null) return null;
  if (!outcome.condition) return null;

  const isMedimops = outcome.store === 'Medimops';

  const target = getNumber(
    row,
    isMedimops ? 'medimops_target_price' : 'momox_target_price'
  );

  if (!isInTarget(outcome.price, target, outcome.condition)) {
    return null;
  }

  const url = getString(row, isMedimops ? 'medimops_url' : 'momox_url');

  if (!url) return null;

  const recipient =
    getString(row, 'alert_email') ||
    getString(row, 'recipient') ||
    getDefaultRecipient();

  if (!recipient) {
    throw new Error('DEFAULT_ALERT_EMAIL mancante: impossibile inviare riepilogo offerte.');
  }

  return {
    id: String(row.id),
    type: getMonitorType(row),
    channel: outcome.store,
    artist: getString(row, 'artist') || 'Artista n/d',
    title: getMonitorDisplayTitle(row),
    country: getString(row, 'country'),
    genre: getString(row, 'genre') || '',
    price: outcome.price,
    condition: outcome.condition,
    url,
    recipient
  };
}

function buildMacTargetOffers(
  row: Record<string, unknown>,
  medimops: ScrapeOutcome,
  momox: ScrapeOutcome
): TargetEmailOffer[] {
  return [buildMacTargetOffer(row, medimops), buildMacTargetOffer(row, momox)].filter(
    (offer): offer is TargetEmailOffer => Boolean(offer)
  );
}

function sortMacTargetOffers(offers: TargetEmailOffer[]): TargetEmailOffer[] {
  const channelOrder: Record<TargetEmailOffer['channel'], number> = {
    Medimops: 0,
    Momox: 1
  };

  return [...offers].sort((left, right) => {
    const channelDiff = channelOrder[left.channel] - channelOrder[right.channel];

    if (channelDiff !== 0) return channelDiff;

    const artistDiff = left.artist.localeCompare(right.artist, 'it', {
      sensitivity: 'base'
    });

    if (artistDiff !== 0) return artistDiff;

    return left.title.localeCompare(right.title, 'it', {
      sensitivity: 'base'
    });
  });
}

function groupMacOffersByRecipient(
  offers: TargetEmailOffer[]
): Record<string, TargetEmailOffer[]> {
  return offers.reduce<Record<string, TargetEmailOffer[]>>((accumulator, offer) => {
    accumulator[offer.recipient] = accumulator[offer.recipient] || [];
    accumulator[offer.recipient].push(offer);
    return accumulator;
  }, {});
}

async function sendMacSummaryEmails(offers: TargetEmailOffer[]): Promise<number> {
  if (offers.length === 0) return 0;

  const standardOffers = offers.filter((offer) => offer.genre !== 'Alt');
  const altOffers = offers.filter((offer) => offer.genre === 'Alt');

  let sent = 0;

  async function sendGrouped(
    groupedOffers: TargetEmailOffer[],
    subjectPrefix?: string
  ): Promise<number> {
    if (groupedOffers.length === 0) return 0;

    const sortedOffers = sortMacTargetOffers(groupedOffers);
    const grouped = groupMacOffersByRecipient(sortedOffers);

    let groupedSent = 0;

    for (const [recipient, recipientOffers] of Object.entries(grouped)) {
      if (recipientOffers.length === 0) continue;

      await sendTargetSummaryEmail({
        to: recipient,
        offers: recipientOffers,
        subjectPrefix
      });

      groupedSent += 1;
    }

    return groupedSent;
  }

  sent += await sendGrouped(standardOffers);
  sent += await sendGrouped(altOffers, 'ALT');

  return sent;
}

function shouldSendSummaryForMode(mode: string): boolean {
  return mode === 'selected' || mode === 'all';
}

async function processRows(
  orderedRows: Array<Record<string, unknown>>
): Promise<ProcessRowsSummary> {
  const rl = createInterface({ input, output });
  const windowId = await openDedicatedChromeWindow();

  console.log(`[mac-monitor] Finestra Chrome dedicata: ${windowId}`);

  let completed = 0;
  let errors = 0;
  const targetOffers: TargetEmailOffer[] = [];

  try {
    for (const record of orderedRows) {
      const id = String(record.id);
      const artist = getString(record, 'artist') || 'Artista n/d';
      const title = getMonitorDisplayTitle(record);

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

      const rowTargetOffers = buildMacTargetOffers(record, medimops, momox);

      if (rowTargetOffers.length > 0) {
        console.log(`[mac-monitor] Offerte in target trovate: ${rowTargetOffers.length}`);
        targetOffers.push(...rowTargetOffers);
      }

      completed += 1;
    }
  } finally {
    rl.close();
    await closeChromeWindow(windowId);
  }

  return { completed, errors, targetOffers };
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
  const alertsSent = shouldSendSummaryForMode(mode)
    ? await sendMacSummaryEmails(summary.targetOffers)
    : 0;

  console.log('\n[mac-monitor] Fine.');
  console.log(`[mac-monitor] Record completati: ${summary.completed}`);
  console.log(`[mac-monitor] Record con errori: ${summary.errors}`);
  console.log(`[mac-monitor] Offerte in target: ${summary.targetOffers.length}`);
  console.log(`[mac-monitor] Email riepilogative inviate: ${alertsSent}`);
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
    const alertsSent = shouldSendSummaryForMode(mode)
      ? await sendMacSummaryEmails(summary.targetOffers)
      : 0;

    const resultSummary = {
      completed: summary.completed,
      errors: summary.errors,
      targetOffers: summary.targetOffers.length,
      alertsSent
    };

    await supabase
      .from('mac_monitor_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_summary: resultSummary,
        error_message: null
      })
      .eq('id', jobId);

    console.log(`[mac-runner] Job completato: ${jobId}`);
    console.log(`[mac-runner] Offerte in target: ${summary.targetOffers.length}`);
    console.log(`[mac-runner] Email riepilogative inviate: ${alertsSent}`);

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

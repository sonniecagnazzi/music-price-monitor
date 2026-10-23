import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { sendNewLowSummaryEmail, sendSpecialAvailableSummaryEmail, type NewLowEmailOffer, type TargetEmailOffer } from '@/lib/email';
import { persistentChromeRunner } from './lib/persistent-chrome-runner';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}




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

type EligibleScrapeOutcome = ScrapeOutcome & {
  status: 'ok';
  price: number;
  condition: string;
};

type NewLowDetection = {
  previousLowestBestPrice: number | null;
  currentBestPrice: number;
  outcome: EligibleScrapeOutcome;
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

function getFreshEligibleOutcomes(
  medimops: ScrapeOutcome,
  momox: ScrapeOutcome
): EligibleScrapeOutcome[] {
  return [medimops, momox]
    .filter((item): item is EligibleScrapeOutcome => {
      return (
        item.status === 'ok' &&
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        Boolean(item.condition) &&
        isEligibleCondition(item.condition)
      );
    })
    .sort((left, right) => {
      const priceDiff = left.price - right.price;

      if (priceDiff !== 0) return priceDiff;
      if (left.store === right.store) return 0;

      return left.store === 'Medimops' ? -1 : 1;
    });
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
    await persistentChromeRunner.navigate(url);
    await sleep(4000);

    let page = await persistentChromeRunner.readPage();

    if (isBlocked(page.title, page.text)) {
      console.log(`[mac-monitor] ${store}: Cloudflare/verifica rilevata.`);
      console.log('Completa manualmente in Chrome finché vedi il prezzo reale.');
      await rl.question('Quando vedi il prezzo nella pagina, premi Invio qui nel Terminale... ');
      page = await persistentChromeRunner.readPage();
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
): Promise<{ newLowDetection: NewLowDetection | null }> {
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

  let newLowDetection: NewLowDetection | null = null;
  const freshEligibleOutcomes = getFreshEligibleOutcomes(medimops, momox);

  if (freshEligibleOutcomes.length > 0 && hasKey(row, 'lowest_best_price')) {
    const bestOutcome = freshEligibleOutcomes[0];
    const currentFreshBest = bestOutcome.price;
    const previousLowest = getNumber(row, 'lowest_best_price');

    if (previousLowest === null || currentFreshBest < previousLowest) {
      update.lowest_best_price = currentFreshBest;

      if (hasKey(row, 'lowest_best_price_at')) {
        update.lowest_best_price_at = now;
      }

      newLowDetection = {
        previousLowestBestPrice: previousLowest,
        currentBestPrice: currentFreshBest,
        outcome: bestOutcome
      };
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

  return { newLowDetection };
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

  return rows.sort((a, b) => {
    const artistOrder = (getString(a, 'artist') || '').localeCompare(getString(b, 'artist') || '', 'it', { sensitivity: 'base' });
    return artistOrder || getMonitorDisplayTitle(a).localeCompare(getMonitorDisplayTitle(b), 'it', { sensitivity: 'base' });
  });
}



type ProcessRowsSummary = {
  completed: number;
  errors: number;
  targetOffers: TargetEmailOffer[];
  newLowOffers: NewLowEmailOffer[];
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

  const previousLowest = getNumber(row, 'lowest_best_price');
  const lowestBestPrice =
    previousLowest === null || outcome.price < previousLowest
      ? outcome.price
      : previousLowest;

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
    lowestBestPrice,
    condition: outcome.condition,
    url,
    recipient
  };
}

function buildMacNewLowOffer(
  row: Record<string, unknown>,
  detection: NewLowDetection
): NewLowEmailOffer | null {
  const isMedimops = detection.outcome.store === 'Medimops';
  const url = getString(row, isMedimops ? 'medimops_url' : 'momox_url');

  if (!url) return null;

  const recipient =
    getString(row, 'alert_email') ||
    getString(row, 'recipient') ||
    getDefaultRecipient();

  return {
    id: String(row.id),
    type: getMonitorType(row),
    channel: detection.outcome.store,
    artist: getString(row, 'artist') || 'Artista n/d',
    title: getMonitorDisplayTitle(row),
    country: getString(row, 'country'),
    genre: getString(row, 'genre') || '',
    price: detection.currentBestPrice,
    previousLowestBestPrice: detection.previousLowestBestPrice,
    condition: detection.outcome.condition,
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

function sortMacOffersByArtist<TOffer extends { channel: 'Medimops' | 'Momox'; artist: string; title: string }>(
  offers: TOffer[]
): TOffer[] {
  const channelOrder: Record<'Medimops' | 'Momox', number> = {
    Medimops: 0,
    Momox: 1
  };

  return [...offers].sort((left, right) => {
    const artistDiff = left.artist.localeCompare(right.artist, 'it', {
      sensitivity: 'base'
    });

    if (artistDiff !== 0) return artistDiff;

    const titleDiff = left.title.localeCompare(right.title, 'it', {
      sensitivity: 'base'
    });

    if (titleDiff !== 0) return titleDiff;

    return channelOrder[left.channel] - channelOrder[right.channel];
  });
}

function groupMacOffersByRecipient<TOffer extends { recipient: string }>(
  offers: TOffer[]
): Record<string, TOffer[]> {
  return offers.reduce<Record<string, TOffer[]>>((accumulator, offer) => {
    accumulator[offer.recipient] = accumulator[offer.recipient] || [];
    accumulator[offer.recipient].push(offer);
    return accumulator;
  }, {});
}

function getMacMailCategoryPrefix(offer: TargetEmailOffer): string {
  const genre = String(offer.genre || '').trim() || 'Senza genere';

  return `${offer.type} ${genre}`;
}

// Un'unica email, organizzata per genere e poi alfabeticamente per artista e titolo.
const NEW_LOW_GENRE_ORDER = ['Alt', 'Jazz', 'H&M', 'Rock Pop'];

function sortNewLowOffersByGenre(offers: NewLowEmailOffer[]): NewLowEmailOffer[] {
  const alphabetical = sortMacOffersByArtist(offers);
  const normalizedGenre = (genre: string) => genre.trim().toLocaleLowerCase('it');

  return alphabetical.sort((left, right) => {
    const leftGenre = normalizedGenre(left.genre);
    const rightGenre = normalizedGenre(right.genre);
    const leftRank = NEW_LOW_GENRE_ORDER.findIndex((genre) => normalizedGenre(genre) === leftGenre);
    const rightRank = NEW_LOW_GENRE_ORDER.findIndex((genre) => normalizedGenre(genre) === rightGenre);
    const rankDiff = (leftRank < 0 ? NEW_LOW_GENRE_ORDER.length : leftRank) -
      (rightRank < 0 ? NEW_LOW_GENRE_ORDER.length : rightRank);
    if (rankDiff !== 0) return rankDiff;
    if (leftRank < 0 && rightRank < 0) {
      const genreDiff = leftGenre.localeCompare(rightGenre, 'it', { sensitivity: 'base' });
      if (genreDiff !== 0) return genreDiff;
    }
    return 0; // L'ordinamento alfabetico precedente resta stabile all'interno del genere.
  });
}

async function sendMacSpecialAvailableEmail(rows: Array<Record<string, unknown>>): Promise<number> {
  const offers: NewLowEmailOffer[] = [];
  for (const row of rows) {
    if (row.is_special !== true) continue;
    const candidates = [
      { store: 'Medimops' as const, price: getNumber(row, 'medimops_current_price'), condition: getString(row, 'medimops_condition'), url: getString(row, 'medimops_url') },
      { store: 'Momox' as const, price: getNumber(row, 'momox_current_price'), condition: getString(row, 'momox_condition'), url: getString(row, 'momox_url') }
    ].filter((item) => item.price !== null && isEligibleCondition(item.condition) && Boolean(item.url));
    candidates.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const best = candidates[0];
    if (!best || best.price === null || !best.condition || !best.url) continue;
    offers.push({
      id: String(row.id), type: getMonitorType(row), channel: best.store,
      artist: getString(row, 'artist') || 'Artista n/d', title: getMonitorDisplayTitle(row),
      country: getString(row, 'country'), genre: getString(row, 'genre') || '',
      price: best.price, previousLowestBestPrice: getNumber(row, 'lowest_best_price'),
      condition: best.condition, url: best.url, recipient: getDefaultRecipient()
    });
  }
  if (offers.length === 0) return 0;
  const recipient = getDefaultRecipient();
  if (!recipient) throw new Error('DEFAULT_ALERT_EMAIL mancante per Speciali Disponibili.');
  await sendSpecialAvailableSummaryEmail({ to: recipient, offers: sortNewLowOffersByGenre(offers) });
  return 1;
}

// Le precedenti mail in target per genere sono disattivate.
// NEW LOW usa un solo destinatario e una sola email per run.
async function sendMacNewLowSummaryEmails(offers: NewLowEmailOffer[]): Promise<number> {
  if (offers.length === 0) return 0;

  const recipient = getDefaultRecipient();
  if (!recipient) {
    throw new Error('DEFAULT_ALERT_EMAIL mancante: impossibile inviare Nuovo Minimo Storico.');
  }

  await sendNewLowSummaryEmail({
    to: recipient,
    offers: sortNewLowOffersByGenre(offers)
  });
  return 1;
}

async function processRows(
  orderedRows: Array<Record<string, unknown>>
): Promise<ProcessRowsSummary> {
  const rl = createInterface({ input, output });

  await persistentChromeRunner.ensureReady();

  console.log(
    `[mac-monitor] Browser Chrome dedicato pronto: ${persistentChromeRunner.getDescription()}`
  );

  let completed = 0;
  let errors = 0;
  const targetOffers: TargetEmailOffer[] = [];
  const newLowOffers: NewLowEmailOffer[] = [];

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

      const medimops = await scrapeStoreWithChrome(rl, 'Medimops', medimopsUrl);
      const momox = await scrapeStoreWithChrome(rl, 'Momox', momoxUrl);

      console.log('\n[mac-monitor] Risultato record:');
      console.log(`- ${medimops.message}`);
      console.log(`- ${momox.message}`);

      const updateResult = await updateMonitorRow(record, medimops, momox);

      if (medimops.status === 'error' || momox.status === 'error') {
        errors += 1;
      }


      const rowNewLowOffer = updateResult.newLowDetection
        ? buildMacNewLowOffer(record, updateResult.newLowDetection)
        : null;

      if (rowNewLowOffer) {
        console.log(`[mac-monitor] NEW LOW trovato: ${rowNewLowOffer.artist} - ${rowNewLowOffer.title} (${rowNewLowOffer.price.toFixed(2)} € < ${updateResult.newLowDetection?.previousLowestBestPrice?.toFixed(2) ?? 'nessuno'} €)`);
        newLowOffers.push(rowNewLowOffer);
      }

      completed += 1;
    }
  } finally {
    rl.close();

    try {
      await persistentChromeRunner.leaveWaiting();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'errore sconosciuto';

      console.log(
        `[mac-monitor] Browser non riportato in attesa: ${message}`
      );
    }

    await persistentChromeRunner.disconnect();
  }

  return { completed, errors, targetOffers, newLowOffers };
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
  const alertsSent = 0; // Invii in target disabilitati.
  const newLowAlertsSent = await sendMacNewLowSummaryEmails(summary.newLowOffers);
  console.log('\n[mac-monitor] Fine.');
  console.log(`[mac-monitor] Record completati: ${summary.completed}`);
  console.log(`[mac-monitor] Record con errori: ${summary.errors}`);
  console.log(`[mac-monitor] Offerte in target: ${summary.targetOffers.length}`);
  console.log(`[mac-monitor] Email riepilogative inviate: ${alertsSent}`);
  console.log(`[mac-monitor] NEW LOW trovati: ${summary.newLowOffers.length}`);
  console.log(`[mac-monitor] Email NEW LOW inviate: ${newLowAlertsSent}`);
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

async function processNextPendingJob(onRunningChange?: (running: boolean) => void): Promise<boolean> {
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

  onRunningChange?.(true);
  try {
    const claimed = claimedJob as Record<string, unknown>;
    const monitorIds = getJobMonitorIds(claimed);

    const rows =
      mode === 'all'
        ? await fetchAllActiveRows()
        : await fetchRowsByIds(monitorIds);

    console.log(`[mac-runner] Record da controllare: ${rows.length}`);

    const summary = await processRows(rows);
    const alertsSent = 0; // Invii in target disabilitati.
    const newLowAlertsSent = await sendMacNewLowSummaryEmails(summary.newLowOffers);

    const resultSummary = {
      completed: summary.completed,
      errors: summary.errors,
      targetOffers: summary.targetOffers.length,
      alertsSent,
      newLowOffers: summary.newLowOffers.length,
      newLowAlertsSent
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
    console.log(`[mac-runner] NEW LOW trovati: ${summary.newLowOffers.length}`);
    console.log(`[mac-runner] Email NEW LOW inviate: ${newLowAlertsSent}`);

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
  } finally {
    onRunningChange?.(false);
  }
}

// Local wall-clock scheduling: never creates a Supabase job or persists missed runs.
const SCHEDULED_HOURS = new Set([9, 14, 19, 22]);
const SCHEDULE_TIMEZONE = 'Europe/Zagreb';

function currentScheduleSlot(): string | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  if (!SCHEDULED_HOURS.has(Number(part('hour'))) || part('minute') !== '00') return null;
  // A sleeping Mac waking in the middle of the minute does not catch up.
  if (Number(part('second')) > 10) return null;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:00`;
}

async function runScheduledFullCheck(slot: string): Promise<void> {
  console.log(`\n[mac-runner] Controllo automatico ${slot} (${SCHEDULE_TIMEZONE})`);
  const rows = await fetchAllActiveRows();
  console.log(`[mac-runner] Record automatici da controllare: ${rows.length}`);
  const summary = await processRows(rows);
  const alertsSent = 0; // Invii in target disabilitati.
  const newLowAlertsSent = await sendMacNewLowSummaryEmails(summary.newLowOffers);
  const specialEmailsSent = await sendMacSpecialAvailableEmail(await fetchAllActiveRows());
  console.log(`[mac-runner] Email Speciali Disponibili inviate: ${specialEmailsSent}`);
  console.log(
    `[mac-runner] Controllo ${slot} completato: ${summary.completed} record, ${summary.errors} errori, ${alertsSent} email offerte in target, ${newLowAlertsSent} email NEW LOW.`
  );
}

async function watchPendingJobs(): Promise<void> {
  console.log('[mac-runner] Avvio runner locale. Premi Ctrl+C per fermarlo.');
  console.log('[mac-runner] Controllo job pending ogni 5 secondi.');
  console.log('[mac-runner] Controlli automatici 09:00, 14:00, 19:00 e 22:00 (Europe/Zagreb), senza recupero.');

  let busy = false;
  let pendingSlot: string | null = null;
  let lastSlot: string | null = null;
  const checkSchedule = () => {
    const slot = currentScheduleSlot();
    if (!slot || slot === lastSlot) return;
    lastSlot = slot;
    if (busy || pendingSlot !== null) {
      console.log(`[mac-runner] SALTATO ${slot}: controllo precedente ancora in corso.`);
    } else {
      pendingSlot = slot; // RAM only, removed if a manual job wins the race.
      console.log(`[mac-runner] Slot automatico ${slot} rilevato.`);
    }
  };
  checkSchedule();
  const timer = setInterval(checkSchedule, 1000);
  timer.unref();

  while (true) {
    try {
      // Manual jobs retain priority. A scheduled run never waits behind a manual run.
      const processed = await processNextPendingJob((running) => {
        busy = running;
        if (running && pendingSlot) {
          console.log(`[mac-runner] SALTATO ${pendingSlot}: avviato job manuale.`);
          pendingSlot = null;
        }
      });
      if (processed) continue;

      const slot = pendingSlot;
      if (slot) {
        pendingSlot = null;
        busy = true;
        try {
          await runScheduledFullCheck(slot);
        } finally {
          busy = false;
        }
        continue;
      }
      await sleep(5000);
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

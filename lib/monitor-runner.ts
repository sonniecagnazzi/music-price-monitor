import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { scrapePrice } from '@/lib/scraper';
import { sendTargetSummaryEmail, type TargetEmailOffer } from '@/lib/email';

type MonitorRow = {
  id: string;
  genre: string;
  type: 'CD' | 'LP';
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string | null;
  release_year: number | null;
  country: string | null;

  site: string | null;
  url: string | null;
  target_price: number | null;
  current_price: number | null;

  medimops_url: string | null;
  medimops_target_price: number | null;
  medimops_current_price: number | null;
  medimops_condition: string | null;

  momox_url: string | null;
  momox_target_price: number | null;
  momox_current_price: number | null;
  momox_condition: string | null;

  amazon_asin: string | null;
  amazon_target_price: number | null;
  amazon_fr_current_price: number | null;
  amazon_de_current_price: number | null;
  amazon_it_current_price: number | null;

  alert_email: string | null;
  is_active: boolean;
  alert_sent: boolean;

  last_checked_at: string | null;
  last_status: 'ok' | 'below_target' | 'not_found' | 'error' | null;
  last_error: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type SiteName = 'Medimops' | 'Momox';

type SiteCheck = {
  site: SiteName;
  url: string | null;
  targetPrice: number | null;
  previousPrice: number | null;
  previousCondition: string | null;
  currentPrice: number | null;
  condition: string | null;
  status: 'ok' | 'not_found' | 'error' | 'skipped';
  message: string;
};

export type MonitorDetail = {
  id: string;
  artist: string;
  album: string;
  status: 'checked' | 'skipped' | 'error';
  message: string;
};

export type MonitorSummary = {
  total: number;
  checked: number;
  alertsSent: number;
  errors: number;
  details: MonitorDetail[];
};

export type RunMonitorOptions = {
  monitorId?: string;
  onlyActive?: boolean;
};

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function normalizeCondition(value: string | null | undefined): string | null {
  const condition = String(value || '').trim().toUpperCase();

  if (!condition) return null;

  if (condition === 'NM') return 'NM';
  if (condition === 'EX') return 'EX';
  if (condition === 'VG') return 'VG';
  if (condition === 'G') return 'G';

  return null;
}

function isTargetCondition(value: string | null | undefined): boolean {
  const condition = normalizeCondition(value);

  return condition === 'NM' || condition === 'EX';
}

function isInTarget(
  currentPrice: number | null,
  targetPrice: number | null,
  condition: string | null
): boolean {
  return (
    currentPrice !== null &&
    targetPrice !== null &&
    currentPrice <= targetPrice &&
    isTargetCondition(condition)
  );
}

function getMonitorMode(): 'all' | 'single' {
  const value = String(process.env.MONITOR_MODE || 'all').trim();

  if (value === 'single') return 'single';

  return 'all';
}

function shouldSendSummaryEmail(): boolean {
  return getMonitorMode() !== 'single';
}

function getDefaultAlertEmail(): string {
  return String(process.env.DEFAULT_ALERT_EMAIL || '').trim();
}

function getRecipientEmail(monitor: MonitorRow): string {
  return String(monitor.alert_email || '').trim() || getDefaultAlertEmail();
}

function getPrimaryLegacySite(monitor: MonitorRow): {
  site: string;
  url: string;
  targetPrice: number | null;
  currentPrice: number | null;
} {
  if (monitor.medimops_url) {
    return {
      site: 'Medimops',
      url: monitor.medimops_url,
      targetPrice: monitor.medimops_target_price,
      currentPrice: monitor.medimops_current_price
    };
  }

  if (monitor.momox_url) {
    return {
      site: 'Momox',
      url: monitor.momox_url,
      targetPrice: monitor.momox_target_price,
      currentPrice: monitor.momox_current_price
    };
  }

  return {
    site: monitor.site || 'Medimops',
    url: monitor.url || '',
    targetPrice: monitor.target_price,
    currentPrice: monitor.current_price
  };
}

async function checkStoreSite(
  monitor: MonitorRow,
  site: SiteName
): Promise<SiteCheck> {
  const url = site === 'Medimops' ? monitor.medimops_url : monitor.momox_url;
  const targetPrice =
    site === 'Medimops'
      ? monitor.medimops_target_price
      : monitor.momox_target_price;
  const previousPrice =
    site === 'Medimops'
      ? monitor.medimops_current_price
      : monitor.momox_current_price;
  const previousCondition =
    site === 'Medimops'
      ? monitor.medimops_condition
      : monitor.momox_condition;

  if (!url || !url.trim()) {
    return {
      site,
      url,
      targetPrice,
      previousPrice,
      previousCondition,
      currentPrice: previousPrice,
      condition: previousCondition,
      status: 'skipped',
      message: `${site}: URL mancante.`
    };
  }

  try {
    const result = await scrapePrice(url);

    if (result.status === 'ok') {
      return {
        site,
        url,
        targetPrice,
        previousPrice,
        previousCondition,
        currentPrice: result.price,
        condition: normalizeCondition(result.condition),
        status: 'ok',
        message: result.message || `${site}: prezzo trovato.`
      };
    }

    if (result.status === 'not_found') {
      return {
        site,
        url,
        targetPrice,
        previousPrice,
        previousCondition,
        currentPrice: previousPrice,
        condition: previousCondition,
        status: 'not_found',
        message: result.message || `${site}: prezzo non trovato.`
      };
    }

    return {
      site,
      url,
      targetPrice,
      previousPrice,
      previousCondition,
      currentPrice: previousPrice,
      condition: previousCondition,
      status: 'error',
      message: result.message || `${site}: errore durante scraping.`
    };
  } catch (error) {
    return {
      site,
      url,
      targetPrice,
      previousPrice,
      previousCondition,
      currentPrice: previousPrice,
      condition: previousCondition,
      status: 'error',
      message: error instanceof Error ? error.message : 'Errore scraping sconosciuto.'
    };
  }
}

function getNextPrice(check: SiteCheck): number | null {
  if (check.status === 'skipped') return check.previousPrice;
  if (check.currentPrice === null) return check.previousPrice;

  return check.currentPrice;
}

function getNextCondition(check: SiteCheck): string | null {
  if (check.status === 'skipped') return check.previousCondition;
  if (check.currentPrice === null) return check.previousCondition;

  return normalizeCondition(check.condition);
}

function buildCheckMessage(checks: SiteCheck[]): string {
  return checks
    .map((check) => {
      const priceText =
        check.currentPrice === null ? 'prezzo non disponibile' : `${check.currentPrice} €`;
      const targetText =
        check.targetPrice === null ? 'target non impostato' : `target ${check.targetPrice} €`;
      const conditionText = check.condition
        ? `condizione ${check.condition}`
        : 'condizione non disponibile';

      if (check.status === 'skipped') {
        return `${check.site}: saltato, URL mancante.`;
      }

      return `${check.site}: ${priceText}, ${targetText}, ${conditionText}, stato ${check.status}. ${check.message}`;
    })
    .join(' | ');
}

function hasAnyUsefulCheck(checks: SiteCheck[]): boolean {
  return checks.some((check) => check.status !== 'skipped');
}

function hasAnyError(checks: SiteCheck[]): boolean {
  return checks.some((check) => check.status === 'error');
}

function getLastStatus(checks: SiteCheck[]): 'ok' | 'below_target' | 'not_found' | 'error' {
  const medimops = checks.find((check) => check.site === 'Medimops');
  const momox = checks.find((check) => check.site === 'Momox');

  const medimopsInTarget =
    medimops && medimops.status === 'ok'
      ? isInTarget(
          getNextPrice(medimops),
          medimops.targetPrice,
          getNextCondition(medimops)
        )
      : false;

  const momoxInTarget =
    momox && momox.status === 'ok'
      ? isInTarget(getNextPrice(momox), momox.targetPrice, getNextCondition(momox))
      : false;

  if (medimopsInTarget || momoxInTarget) return 'below_target';
  if (hasAnyError(checks)) return 'error';

  const hasFreshOk = checks.some((check) => check.status === 'ok');
  const hasNotFound = checks.some((check) => check.status === 'not_found');

  if (!hasFreshOk && hasNotFound) return 'not_found';

  return 'ok';
}

function buildTargetOffers(monitor: MonitorRow, checks: SiteCheck[]): TargetEmailOffer[] {
  const offers: TargetEmailOffer[] = [];

  checks.forEach((check) => {
    if (check.status !== 'ok') return;

    const price = getNextPrice(check);
    const condition = getNextCondition(check);

    if (!isInTarget(price, check.targetPrice, condition)) return;
    if (!check.url) return;
    if (price === null || condition === null) return;

    offers.push({
      type: monitor.type,
      channel: check.site,
      artist: monitor.artist,
      title: monitor.album,
      price,
      condition,
      url: check.url,
      recipient: getRecipientEmail(monitor)
    });
  });

  return offers;
}

function sortTargetOffers(offers: TargetEmailOffer[]): TargetEmailOffer[] {
  const channelRank: Record<SiteName, number> = {
    Medimops: 1,
    Momox: 2
  };

  return [...offers].sort((a, b) => {
    const channelCompare = channelRank[a.channel] - channelRank[b.channel];

    if (channelCompare !== 0) return channelCompare;

    const artistCompare = a.artist.localeCompare(b.artist, 'it', {
      sensitivity: 'base'
    });

    if (artistCompare !== 0) return artistCompare;

    return a.title.localeCompare(b.title, 'it', {
      sensitivity: 'base'
    });
  });
}

function groupOffersByRecipient(
  offers: TargetEmailOffer[]
): Record<string, TargetEmailOffer[]> {
  return offers.reduce<Record<string, TargetEmailOffer[]>>((accumulator, offer) => {
    const recipient = offer.recipient.trim();

    if (!recipient) return accumulator;

    if (!accumulator[recipient]) {
      accumulator[recipient] = [];
    }

    accumulator[recipient].push(offer);

    return accumulator;
  }, {});
}

async function getMonitorRows(options: RunMonitorOptions): Promise<MonitorRow[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase.from('monitors').select('*');

  if (options.monitorId) {
    query = query.eq('id', options.monitorId);
  }

  if (options.onlyActive) {
    query = query.eq('is_active', true);
  }

  query = query.order('artist', { ascending: true });
  query = query.order('release_year', { ascending: true, nullsFirst: false });
  query = query.order('album', { ascending: true });
  query = query.order('country', { ascending: true, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as MonitorRow[];
}

async function updateMonitorAfterChecks(
  monitor: MonitorRow,
  checks: SiteCheck[]
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const medimops = checks.find((check) => check.site === 'Medimops');
  const momox = checks.find((check) => check.site === 'Momox');

  const primary = getPrimaryLegacySite(monitor);
  const legacyCurrentPrice =
    primary.site === 'Medimops'
      ? medimops
        ? getNextPrice(medimops)
        : primary.currentPrice
      : momox
        ? getNextPrice(momox)
        : primary.currentPrice;

  const lastStatus = getLastStatus(checks);
  const now = new Date().toISOString();
  const message = buildCheckMessage(checks);

  console.log(
    `[runner-debug] update-payload monitor=${monitor.id} medimops_price=${medimops ? getNextPrice(medimops) : monitor.medimops_current_price} medimops_condition=${medimops ? getNextCondition(medimops) : monitor.medimops_condition} momox_price=${momox ? getNextPrice(momox) : monitor.momox_current_price} momox_condition=${momox ? getNextCondition(momox) : monitor.momox_condition} lastStatus=${lastStatus} message="${message}"`
  );

  const { error } = await supabase
    .from('monitors')
    .update({
      site: primary.site,
      url: primary.url,
      target_price: primary.targetPrice,
      current_price: legacyCurrentPrice,

      medimops_current_price: medimops
        ? getNextPrice(medimops)
        : monitor.medimops_current_price,
      medimops_condition: medimops
        ? getNextCondition(medimops)
        : monitor.medimops_condition,

      momox_current_price: momox ? getNextPrice(momox) : monitor.momox_current_price,
      momox_condition: momox ? getNextCondition(momox) : monitor.momox_condition,

      last_checked_at: now,
      last_status: lastStatus,
      last_error: lastStatus === 'error' || lastStatus === 'not_found' ? message : null,
      alert_sent: lastStatus === 'below_target'
    })
    .eq('id', monitor.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function sendSummaryEmails(offers: TargetEmailOffer[]): Promise<number> {
  if (!shouldSendSummaryEmail()) return 0;
  if (offers.length === 0) return 0;

  const sortedOffers = sortTargetOffers(offers);
  const grouped = groupOffersByRecipient(sortedOffers);
  const recipients = Object.keys(grouped);

  let sent = 0;

  for (const recipient of recipients) {
    const recipientOffers = grouped[recipient];

    if (!recipientOffers || recipientOffers.length === 0) continue;

    await sendTargetSummaryEmail({
      to: recipient,
      offers: recipientOffers
    });

    sent += 1;
  }

  return sent;
}

export async function runMonitor(
  options: RunMonitorOptions = {}
): Promise<MonitorSummary> {
  const monitors = await getMonitorRows(options);
  const details: MonitorDetail[] = [];
  const allTargetOffers: TargetEmailOffer[] = [];

  let checked = 0;
  let errors = 0;

  for (const monitor of monitors) {
    try {
      const checks = await Promise.all([
        checkStoreSite(monitor, 'Medimops'),
        checkStoreSite(monitor, 'Momox')
      ]);

      for (const check of checks) {
        console.log(
          `[runner-debug] check monitor=${monitor.id} site=${check.site} artist="${monitor.artist}" album="${monitor.album}" url="${check.url || ''}" nextPrice=${getNextPrice(check)} previousPrice=${check.previousPrice} nextCondition=${getNextCondition(check)} previousCondition=${check.previousCondition} status=${check.status} message="${check.message}"`
        );
      }

      if (!hasAnyUsefulCheck(checks)) {
        details.push({
          id: monitor.id,
          artist: monitor.artist,
          album: monitor.album,
          status: 'skipped',
          message: 'Nessun URL Medimops/Momox presente.'
        });

        continue;
      }

      await updateMonitorAfterChecks(monitor, checks);

      checked += 1;

      if (hasAnyError(checks)) {
        errors += 1;
      }

      const targetOffers = buildTargetOffers(monitor, checks);
      allTargetOffers.push(...targetOffers);

      details.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: hasAnyError(checks) ? 'error' : 'checked',
        message: buildCheckMessage(checks)
      });
    } catch (error) {
      errors += 1;

      const message =
        error instanceof Error
          ? error.message
          : 'Errore sconosciuto durante controllo monitor.';

      details.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: 'error',
        message
      });

      try {
        const supabase = getSupabaseAdmin();

        await supabase
          .from('monitors')
          .update({
            last_checked_at: new Date().toISOString(),
            last_status: 'error',
            last_error: message
          })
          .eq('id', monitor.id);
      } catch {
        // Evita che un errore nel salvataggio dello stato blocchi tutto il run.
      }
    }
  }

  const alertsSent = await sendSummaryEmails(allTargetOffers);

  return {
    total: monitors.length,
    checked,
    alertsSent,
    errors,
    details
  };
}
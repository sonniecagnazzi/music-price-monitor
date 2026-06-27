import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { scrapePrice } from '@/lib/scraper';
import {
  scrapeAmazonPrice,
  type AmazonMarketplace
} from '@/lib/amazon-scraper';
import { sendPriceAlert } from '@/lib/email';
import type { Monitor, Settings } from '@/lib/types';

export type RunMonitorOptions = {
  monitorId?: string;
  onlyActive?: boolean;
};

type SettingsWithLegacyEmail = Settings & {
  alert_email?: string | null;
};

type MonitorRunStatus = 'ok' | 'below_target' | 'error';

type SiteCheck = {
  site: string;
  price: number | null;
  target: number | null;
  error: string | null;
  source: string | null;
  isBelowTarget: boolean;
  skipped: boolean;
};

type MonitorRunDetail = {
  id: string;
  artist: string;
  album: string;
  status: MonitorRunStatus;
  price: number | null;
  error: string | null;
  alertSent: boolean;
  message: string;
};

export type MonitorRunSummary = {
  total: number;
  checked: number;
  alertsSent: number;
  errors: number;
  details: MonitorRunDetail[];
  results: MonitorRunDetail[];
};

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function getGlobalAlertEmail(settings: SettingsWithLegacyEmail | null): string {
  return (
    settings?.global_alert_email ||
    settings?.alert_email ||
    env.defaultAlertEmail()
  );
}

function getMonitorAlertEmail(
  monitor: Monitor,
  globalAlertEmail: string
): string {
  return monitor.alert_email || globalAlertEmail;
}

function hasConfiguredSite(url: string | null, target: number | null): boolean {
  return Boolean(url && target && target > 0);
}

function hasConfiguredAmazon(
  asin: string | null,
  target: number | null
): boolean {
  return Boolean(asin && target && target > 0);
}

async function checkStoreSite(
  site: 'Medimops' | 'Momox',
  url: string | null,
  target: number | null
): Promise<SiteCheck> {
  if (!hasConfiguredSite(url, target)) {
    return {
      site,
      price: null,
      target,
      error: null,
      source: null,
      isBelowTarget: false,
      skipped: true
    };
  }

  try {
    const result = await scrapePrice(url as string);
    const price = result.price;
    const isBelowTarget =
      price !== null && target !== null && price <= target;

    return {
      site,
      price,
      target,
      error: result.error,
      source: result.source,
      isBelowTarget,
      skipped: false
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore scraping sconosciuto';

    return {
      site,
      price: null,
      target,
      error: message,
      source: `${site}:exception`,
      isBelowTarget: false,
      skipped: false
    };
  }
}

async function checkAmazonSite(
  asin: string | null,
  target: number | null,
  marketplace: AmazonMarketplace
): Promise<SiteCheck> {
  const site = `Amazon ${marketplace}`;

  if (!hasConfiguredAmazon(asin, target)) {
    return {
      site,
      price: null,
      target,
      error: null,
      source: null,
      isBelowTarget: false,
      skipped: true
    };
  }

  try {
    const result = await scrapeAmazonPrice(asin as string, marketplace);
    const price = result.price;
    const isBelowTarget =
      price !== null && target !== null && price <= target;

    return {
      site,
      price,
      target,
      error: result.error,
      source: result.source,
      isBelowTarget,
      skipped: false
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore scraping Amazon sconosciuto';

    return {
      site,
      price: null,
      target,
      error: message,
      source: `${site}:exception`,
      isBelowTarget: false,
      skipped: false
    };
  }
}

function buildMessage(checks: SiteCheck[]) {
  return checks
    .filter((check) => !check.skipped)
    .map((check) => {
      if (check.price === null) {
        if (check.error) {
          return `${check.site}: errore ${check.error}; fonte ${check.source || '-'}`;
        }

        return `${check.site}: nessuna offerta valida; fonte ${check.source || '-'}`;
      }

      return `${check.site}: prezzo ${check.price}, target ${check.target}; fonte ${check.source || '-'}`;
    })
    .join(' | ');
}

function buildErrorMessage(checks: SiteCheck[]) {
  return checks
    .filter((check) => !check.skipped && check.price === null && check.error)
    .map(
      (check) =>
        `${check.site}: ${check.error || 'prezzo non trovato'}; fonte ${check.source || '-'}`
    )
    .join(' | ');
}

function hasAnyRealError(checks: SiteCheck[]) {
  return checks.some(
    (check) => !check.skipped && check.price === null && Boolean(check.error)
  );
}

function getLowestPrice(checks: SiteCheck[]): number | null {
  const prices = checks
    .map((check) => check.price)
    .filter((price): price is number => price !== null);

  if (prices.length === 0) return null;

  return Math.min(...prices);
}

function mergeSources(checks: SiteCheck[]) {
  return checks
    .filter((check) => !check.skipped && (check.source || check.error))
    .map(
      (check) =>
        `${check.site}: ${check.source || check.error || 'nessuna fonte'}`
    )
    .join(' | ');
}

export async function runMonitor(
  options: RunMonitorOptions = {}
): Promise<MonitorRunSummary> {
  const supabase = getSupabaseAdmin();

  const settingsResult = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<SettingsWithLegacyEmail>();

  const globalEmail = getGlobalAlertEmail(settingsResult.data || null);

  let query = supabase
    .from('monitors')
    .select('*')
    .order('artist', { ascending: true });

  if (options.monitorId) {
    query = query.eq('id', options.monitorId);
  }

  if (options.onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data: monitors, error } = await query.returns<Monitor[]>();

  if (error) {
    throw new Error(error.message);
  }

  const monitorsToCheck = monitors || [];
  const details: MonitorRunDetail[] = [];

  let alertsSent = 0;
  let errors = 0;

  for (const monitor of monitorsToCheck) {
    const checkedAt = new Date().toISOString();

    try {
      const medimopsCheck = await checkStoreSite(
        'Medimops',
        monitor.medimops_url,
        monitor.medimops_target_price
      );

      const momoxCheck = await checkStoreSite(
        'Momox',
        monitor.momox_url,
        monitor.momox_target_price
      );

      const amazonFrCheck = await checkAmazonSite(
        monitor.amazon_asin,
        monitor.amazon_target_price,
        'FR'
      );

      const amazonDeCheck = await checkAmazonSite(
        monitor.amazon_asin,
        monitor.amazon_target_price,
        'DE'
      );

      const amazonItCheck = await checkAmazonSite(
        monitor.amazon_asin,
        monitor.amazon_target_price,
        'IT'
      );

      const checks = [
        medimopsCheck,
        momoxCheck,
        amazonFrCheck,
        amazonDeCheck,
        amazonItCheck
      ];

      const configuredChecks = checks.filter((check) => !check.skipped);

      const realErrorChecks = configuredChecks.filter(
        (check) => check.price === null && Boolean(check.error)
      );

      const belowTargetChecks = configuredChecks.filter(
        (check) => check.isBelowTarget
      );

      const hasAnyPrice = configuredChecks.some((check) => check.price !== null);
      const hasAnyBelowTarget = belowTargetChecks.length > 0;
      const hasRealError = hasAnyRealError(checks);
      const hasAllRealErrors =
        configuredChecks.length > 0 &&
        realErrorChecks.length === configuredChecks.length;

      const nextStatus: MonitorRunStatus = hasAllRealErrors
        ? 'error'
        : hasAnyBelowTarget
          ? 'below_target'
          : 'ok';

      if (hasRealError) {
        errors += 1;
      }

      const lowestPrice = getLowestPrice(checks);
      const alertEmail = getMonitorAlertEmail(monitor, globalEmail);

      let nextAlertSent = monitor.alert_sent;
      let alertSentNow = false;

      const monitorForEmail: Monitor = {
        ...monitor,
        medimops_current_price: medimopsCheck.price,
        momox_current_price: momoxCheck.price,
        amazon_fr_current_price: amazonFrCheck.price,
        amazon_de_current_price: amazonDeCheck.price,
        amazon_it_current_price: amazonItCheck.price,
        current_price: lowestPrice
      };

      if (hasAnyBelowTarget && !monitor.alert_sent && alertEmail) {
        await sendPriceAlert({
          to: alertEmail,
          monitor: monitorForEmail,
          price: lowestPrice || 0,
          source: mergeSources(checks),
          triggeredSites: belowTargetChecks.map((check) => check.site)
        });

        nextAlertSent = true;
        alertSentNow = true;
        alertsSent += 1;
      } else if (!hasAnyBelowTarget && monitor.alert_sent && hasAnyPrice) {
        nextAlertSent = false;
      }

      const fullMessage = buildMessage(checks);
      const visibleErrorMessage = hasRealError ? buildErrorMessage(checks) : null;

      await supabase.from('price_checks').insert({
        monitor_id: monitor.id,
        checked_at: checkedAt,
        price: lowestPrice,
        status: nextStatus,
        error_message: visibleErrorMessage,
        source: mergeSources(checks)
      });

      await supabase
        .from('monitors')
        .update({
          medimops_current_price: medimopsCheck.price,
          momox_current_price: momoxCheck.price,
          amazon_fr_current_price: amazonFrCheck.price,
          amazon_de_current_price: amazonDeCheck.price,
          amazon_it_current_price: amazonItCheck.price,
          current_price: lowestPrice,
          last_checked_at: checkedAt,
          last_status: nextStatus,
          last_error: visibleErrorMessage,
          alert_sent: nextAlertSent,
          updated_at: checkedAt
        })
        .eq('id', monitor.id);

      details.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: nextStatus,
        price: lowestPrice,
        error: visibleErrorMessage,
        alertSent: alertSentNow,
        message: fullMessage
      });
    } catch (error) {
      errors += 1;

      const message =
        error instanceof Error
          ? error.message
          : 'Errore sconosciuto durante controllo';

      await supabase.from('price_checks').insert({
        monitor_id: monitor.id,
        checked_at: checkedAt,
        price: null,
        status: 'error',
        error_message: message,
        source: 'record-exception'
      });

      await supabase
        .from('monitors')
        .update({
          last_checked_at: checkedAt,
          last_status: 'error',
          last_error: message,
          updated_at: checkedAt
        })
        .eq('id', monitor.id);

      details.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: 'error',
        price: null,
        error: message,
        alertSent: false,
        message
      });
    }
  }

  return {
    total: monitorsToCheck.length,
    checked: monitorsToCheck.length,
    alertsSent,
    errors,
    details,
    results: details
  };
}

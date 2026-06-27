import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { scrapePrice } from '@/lib/scraper';
import { sendPriceAlert } from '@/lib/email';
import type { Monitor, Settings } from '@/lib/types';

export type RunMonitorOptions = {
  monitorId?: string;
  onlyActive?: boolean;
};

type SettingsWithLegacyEmail = Settings & {
  alert_email?: string | null;
};

type MonitorRunResult = {
  id: string;
  artist: string;
  album: string;
  status: 'ok' | 'below_target' | 'error';
  price: number | null;
  error: string | null;
  alertSent: boolean;
};

export type MonitorRunSummary = {
  total: number;
  checked: number;
  alertsSent: number;
  errors: number;
  results: MonitorRunResult[];
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

function shouldSendAlert(monitor: Monitor, price: number): boolean {
  return price <= monitor.target_price && !monitor.alert_sent;
}

function shouldResetAlert(monitor: Monitor, price: number): boolean {
  return price > monitor.target_price && monitor.alert_sent;
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
  const results: MonitorRunResult[] = [];

  let alertsSent = 0;
  let errors = 0;

  for (const monitor of monitorsToCheck) {
    const checkedAt = new Date().toISOString();

    try {
      const scrapeResult = await scrapePrice(monitor.url);

      if (scrapeResult.price === null) {
        errors += 1;

        await supabase.from('price_checks').insert({
          monitor_id: monitor.id,
          checked_at: checkedAt,
          price: null,
          status: 'error',
          error_message: scrapeResult.error,
          source: scrapeResult.source
        });

        await supabase
          .from('monitors')
          .update({
            last_checked_at: checkedAt,
            last_status: 'error',
            last_error: scrapeResult.error,
            updated_at: checkedAt
          })
          .eq('id', monitor.id);

        results.push({
          id: monitor.id,
          artist: monitor.artist,
          album: monitor.album,
          status: 'error',
          price: null,
          error: scrapeResult.error,
          alertSent: false
        });

        continue;
      }

      const price = scrapeResult.price;
      const isBelowTarget = price <= monitor.target_price;
      const nextStatus = isBelowTarget ? 'below_target' : 'ok';
      const alertEmail = getMonitorAlertEmail(monitor, globalEmail);

      let alertSent = monitor.alert_sent;
      let alertSentNow = false;

      if (shouldSendAlert(monitor, price) && alertEmail) {
        await sendPriceAlert({
          to: alertEmail,
          monitor,
          price,
          source: scrapeResult.source
        });

        alertSent = true;
        alertSentNow = true;
        alertsSent += 1;
      } else if (shouldResetAlert(monitor, price)) {
        alertSent = false;
      }

      await supabase.from('price_checks').insert({
        monitor_id: monitor.id,
        checked_at: checkedAt,
        price,
        status: nextStatus,
        error_message: null,
        source: scrapeResult.source
      });

      await supabase
        .from('monitors')
        .update({
          current_price: price,
          last_checked_at: checkedAt,
          last_status: nextStatus,
          last_error: null,
          alert_sent: alertSent,
          updated_at: checkedAt
        })
        .eq('id', monitor.id);

      results.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: nextStatus,
        price,
        error: null,
        alertSent: alertSentNow
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
        source: 'exception'
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

      results.push({
        id: monitor.id,
        artist: monitor.artist,
        album: monitor.album,
        status: 'error',
        price: null,
        error: message,
        alertSent: false
      });
    }
  }

  return {
    total: monitorsToCheck.length,
    checked: monitorsToCheck.length,
    alertsSent,
    errors,
    results
  };
}

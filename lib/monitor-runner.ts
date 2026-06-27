import { createServiceClient } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { scrapePrice } from '@/lib/scraper';
import { sendPriceAlert } from '@/lib/email';
import type { Monitor, Settings } from '@/lib/types';

export type RunMonitorOptions = {
  monitorId?: string;
};

function getGlobalAlertEmail(settings: Settings | null): string {
  return settings?.global_alert_email || env.defaultAlertEmail();
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

export async function runMonitor(options: RunMonitorOptions = {}) {
  const supabase = createServiceClient();

  const settingsResult = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<Settings>();

  const globalEmail = getGlobalAlertEmail(settingsResult.data || null);

  let query = supabase
    .from('monitors')
    .select('*')
    .order('artist', { ascending: true });

  if (options.monitorId) {
    query = query.eq('id', options.monitorId);
  }

  const { data: monitors, error } = await query.returns<Monitor[]>();

  if (error) {
    throw new Error(error.message);
  }

  const activeMonitors = (monitors || []).filter(
    (monitor) => monitor.is_active
  );

  const results = [];

  for (const monitor of activeMonitors) {
    const checkedAt = new Date().toISOString();

    try {
      const scrapeResult = await scrapePrice(monitor.url);

      if (scrapeResult.price === null) {
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
          error: scrapeResult.error
        });

        continue;
      }

      const price = scrapeResult.price;
      const isBelowTarget = price <= monitor.target_price;
      const nextStatus = isBelowTarget ? 'below_target' : 'ok';
      const alertEmail = getMonitorAlertEmail(monitor, globalEmail);

      let alertSent = monitor.alert_sent;

      if (shouldSendAlert(monitor, price) && alertEmail) {
        await sendPriceAlert({
          to: alertEmail,
          monitor,
          price,
          source: scrapeResult.source
        });

        alertSent = true;
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
        error: null
      });
    } catch (error) {
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
        error: message
      });
    }
  }

  return {
    checked: activeMonitors.length,
    results
  };
}

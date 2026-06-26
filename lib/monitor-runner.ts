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

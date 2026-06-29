import { runMonitor } from '../lib/monitor-runner';
import {
  setMonitorJobFinished,
  setMonitorJobRunning
} from '../lib/monitor-job-status';

function getMonitorMode(): 'all' | 'single' {
  const value = String(process.env.MONITOR_MODE || 'all').trim();

  if (value === 'single') return 'single';

  return 'all';
}

async function main() {
  const mode = getMonitorMode();
  const monitorId = String(process.env.MONITOR_ID || '').trim();

  console.log(`[monitor] Avvio ${new Date().toISOString()}`);
  console.log(`[monitor] Modalità: ${mode}`);

  await setMonitorJobRunning(
    mode === 'single'
      ? `Controllo singolo in corso: ${monitorId || 'ID mancante'}`
      : 'Controllo completo in corso.'
  );

  if (mode === 'single') {
    if (!monitorId) {
      throw new Error('MONITOR_ID mancante per modalità single.');
    }

    console.log(`[monitor] Monitor singolo: ${monitorId}`);
    console.log('[monitor] Mail riepilogativa disabilitata per controllo singolo.');

    const summary = await runMonitor({
      monitorId,
      onlyActive: false
    });

    console.log(`[monitor] Totale: ${summary.total}`);
    console.log(`[monitor] Controllati: ${summary.checked}`);
    console.log(`[monitor] Mail riepilogative inviate: ${summary.alertsSent}`);
    console.log(`[monitor] Errori: ${summary.errors}`);

    for (const detail of summary.details) {
      console.log(
        `[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`
      );
    }

    await setMonitorJobFinished(
      `Controllo singolo completato. Controllati: ${summary.checked}. Errori: ${summary.errors}. Nessuna mail inviata.`
    );

    return;
  }

  console.log('[monitor] Mail riepilogativa abilitata per controllo completo/cron.');

  const summary = await runMonitor({
    onlyActive: true
  });

  console.log(`[monitor] Totale: ${summary.total}`);
  console.log(`[monitor] Controllati: ${summary.checked}`);
  console.log(`[monitor] Mail riepilogative inviate: ${summary.alertsSent}`);
  console.log(`[monitor] Errori: ${summary.errors}`);

  for (const detail of summary.details) {
    console.log(
      `[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`
    );
  }

  await setMonitorJobFinished(
    `Controllo completo completato. Controllati: ${summary.checked}. Errori: ${summary.errors}. Mail riepilogative inviate: ${summary.alertsSent}.`
  );
}

main().catch(async (error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Errore fatale sconosciuto';

  console.error('[monitor] Errore fatale', message);

  try {
    await setMonitorJobFinished(`Controllo terminato con errore: ${message}`);
  } catch (statusError) {
    console.error(
      '[monitor] Errore aggiornamento stato job',
      statusError instanceof Error ? statusError.message : statusError
    );
  }

  process.exit(1);
});
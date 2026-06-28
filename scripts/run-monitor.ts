import { runMonitor } from '../lib/monitor-runner';

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

  if (mode === 'single') {
    if (!monitorId) {
      throw new Error('MONITOR_ID mancante per modalità single.');
    }

    console.log(`[monitor] Monitor singolo: ${monitorId}`);

    const summary = await runMonitor({
      monitorId,
      onlyActive: false
    });

    console.log(`[monitor] Totale: ${summary.total}`);
    console.log(`[monitor] Controllati: ${summary.checked}`);
    console.log(`[monitor] Alert inviati: ${summary.alertsSent}`);
    console.log(`[monitor] Errori: ${summary.errors}`);

    for (const detail of summary.details) {
      console.log(
        `[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`
      );
    }

    return;
  }

  const summary = await runMonitor({
    onlyActive: true
  });

  console.log(`[monitor] Totale: ${summary.total}`);
  console.log(`[monitor] Controllati: ${summary.checked}`);
  console.log(`[monitor] Alert inviati: ${summary.alertsSent}`);
  console.log(`[monitor] Errori: ${summary.errors}`);

  for (const detail of summary.details) {
    console.log(
      `[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '[monitor] Errore fatale',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});

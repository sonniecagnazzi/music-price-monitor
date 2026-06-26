import { runMonitor } from '../lib/monitor-runner';

async function main() {
  console.log(`[monitor] Avvio ${new Date().toISOString()}`);
  const summary = await runMonitor({ onlyActive: true });
  console.log(`[monitor] Totale: ${summary.total}`);
  console.log(`[monitor] Controllati: ${summary.checked}`);
  console.log(`[monitor] Alert inviati: ${summary.alertsSent}`);
  console.log(`[monitor] Errori: ${summary.errors}`);
  for (const detail of summary.details) {
    console.log(`[monitor] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`);
  }
}

main().catch((error: unknown) => {
  console.error('[monitor] Errore fatale', error instanceof Error ? error.message : error);
  process.exit(1);
});

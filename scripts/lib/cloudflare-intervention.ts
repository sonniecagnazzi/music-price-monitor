import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Runs once when a Cloudflare challenge is detected. No email is sent. */
export async function notifyCloudflareIntervention(store: string): Promise<void> {
  const script = [
    `display notification "Completa la verifica nel Chrome del monitor per riprendere la scansione." with title "Music Price Monitor" subtitle "Cloudflare: ${store}" sound name "Glass"`,
    'tell application "Google Chrome" to activate',
  ].join('\n');

  try {
    await execFileAsync('/usr/bin/osascript', ['-e', script], {
      timeout: 15_000,
    });
  } catch (error) {
    // Notifications / foreground activation can be unavailable on a locked Mac.
    // Never turn that into a scraping failure.
    console.warn(`[mac-monitor] Notifica macOS non disponibile: ${String(error)}`);
  }
}

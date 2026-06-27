import nodemailer from 'nodemailer';
import { env } from '@/lib/env';
import type { Monitor } from '@/lib/types';

export type PriceAlertPayload = {
  to: string;
  monitor: Monitor;
  price: number;
  source?: string | null;
  triggeredSites?: string[];
};

function formatEuro(value: number | null): string {
  if (value === null) return '-';

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

function formatOptional(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';

  return String(value);
}

function buildSubject(payload: PriceAlertPayload): string {
  const sites =
    payload.triggeredSites && payload.triggeredSites.length > 0
      ? payload.triggeredSites.join(', ')
      : 'prezzo';

  return `Prezzo in target ${sites}: ${payload.monitor.artist} - ${payload.monitor.album}`;
}

function buildTextBody(payload: PriceAlertPayload): string {
  const { monitor, source } = payload;

  return [
    'Music Price Monitor',
    '',
    'Un prodotto monitorato è entrato in target.',
    '',
    `Artista: ${monitor.artist}`,
    `Album: ${monitor.album}`,
    `Tipo: ${monitor.type}`,
    `Medimops prezzo attuale: ${formatEuro(monitor.medimops_current_price)}`,
    `Medimops prezzo target: ${formatEuro(monitor.medimops_target_price)}`,
    `Momox prezzo attuale: ${formatEuro(monitor.momox_current_price)}`,
    `Momox prezzo target: ${formatEuro(monitor.momox_target_price)}`,
    `Label: ${formatOptional(monitor.edition)}`,
    `EAN: ${formatOptional(monitor.ean_code)}`,
    `Anno: ${formatOptional(monitor.release_year)}`,
    `Country: ${formatOptional(monitor.country)}`,
    '',
    monitor.medimops_url ? `Medimops URL: ${monitor.medimops_url}` : '',
    monitor.momox_url ? `Momox URL: ${monitor.momox_url}` : '',
    '',
    source ? `Fonte controllo: ${source}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function buildHtmlBody(payload: PriceAlertPayload): string {
  const { monitor, source } = payload;

  return `
<!doctype html>
<html lang="it">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:760px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#166534;">Prezzo in target</h1>

        <p style="margin:0 0 20px;color:#475569;">
          Almeno uno dei prezzi monitorati ha raggiunto o superato la soglia impostata.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Artista</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${monitor.artist}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Album</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${monitor.album}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Tipo</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${monitor.type}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Medimops prezzo attuale</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#166534;font-weight:bold;">${formatEuro(monitor.medimops_current_price)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Medimops prezzo target</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatEuro(monitor.medimops_target_price)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Momox prezzo attuale</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#166534;font-weight:bold;">${formatEuro(monitor.momox_current_price)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Momox prezzo target</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatEuro(monitor.momox_target_price)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Label</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatOptional(monitor.edition)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">EAN</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatOptional(monitor.ean_code)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Anno</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatOptional(monitor.release_year)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Country</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatOptional(monitor.country)}</td></tr>
        </table>

        <p style="margin:24px 0 0;">
          ${
            monitor.medimops_url
              ? `<a href="${monitor.medimops_url}" target="_blank" rel="noreferrer" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;margin-right:8px;">Apri Medimops</a>`
              : ''
          }
          ${
            monitor.momox_url
              ? `<a href="${monitor.momox_url}" target="_blank" rel="noreferrer" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">Apri Momox</a>`
              : ''
          }
        </p>

        ${
          source
            ? `<p style="margin:20px 0 0;color:#64748b;font-size:12px;">Fonte controllo: ${source}</p>`
            : ''
        }
      </div>
    </div>
  </body>
</html>
`;
}

export async function sendPriceAlert(payload: PriceAlertPayload) {
  const transporter = nodemailer.createTransport({
    host: env.smtpHost(),
    port: env.smtpPort(),
    secure: env.smtpPort() === 465,
    auth: {
      user: env.smtpUser(),
      pass: env.smtpPassword()
    }
  });

  await transporter.sendMail({
    from: env.alertFromEmail(),
    to: payload.to,
    subject: buildSubject(payload),
    text: buildTextBody(payload),
    html: buildHtmlBody(payload)
  });
}

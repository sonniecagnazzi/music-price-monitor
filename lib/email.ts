import nodemailer from 'nodemailer';
import type { Monitor } from './types';
import { formatEuro, formatDate } from './format';
import { env } from './env';

export async function sendPriceAlert(
  monitor: Monitor,
  detectedPrice: number,
  recipient: string
): Promise<{ ok: boolean; error: string | null }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail = env.alertFromEmail();

  if (!smtpHost || !smtpUser || !smtpPassword) {
    return {
      ok: false,
      error: 'Configurazione SMTP Gmail mancante: controlla SMTP_HOST, SMTP_USER e SMTP_PASSWORD.'
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  const checkedAt = new Date().toISOString();

  const subject = `Prezzo sotto target: ${monitor.artist} - ${monitor.album}`;

  const html = `
    <h1>Prezzo sotto target</h1>
    <p>Il prezzo rilevato è minore o uguale al tuo target.</p>
    <ul>
      <li><strong>Tipo:</strong> ${escapeHtml(monitor.type)}</li>
      <li><strong>Artista:</strong> ${escapeHtml(monitor.artist)}</li>
      <li><strong>Album:</strong> ${escapeHtml(monitor.album)}</li>
      <li><strong>Edizione:</strong> ${escapeHtml(monitor.edition || '-')}</li>
      <li><strong>Sito:</strong> ${escapeHtml(monitor.site)}</li>
      <li><strong>URL:</strong> <a href="${escapeAttribute(monitor.url)}">${escapeHtml(monitor.url)}</a></li>
      <li><strong>Prezzo target:</strong> ${formatEuro(monitor.target_price)}</li>
      <li><strong>Prezzo rilevato:</strong> ${formatEuro(detectedPrice)}</li>
      <li><strong>Data rilevazione:</strong> ${formatDate(checkedAt)}</li>
    </ul>
    <p><a href="${escapeAttribute(monitor.url)}">Apri pagina prodotto</a></p>
  `;

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: recipient,
      subject,
      html
    });

    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Errore email SMTP sconosciuto'
    };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char] || char));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#039;');
}

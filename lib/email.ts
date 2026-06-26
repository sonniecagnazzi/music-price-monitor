import { Resend } from 'resend';
import type { Monitor } from './types';
import { formatEuro, formatDate } from './format';
import { env } from './env';

export async function sendPriceAlert(monitor: Monitor, detectedPrice: number, recipient: string): Promise<{ ok: boolean; error: string | null }> {
  const apiKey = env.resendApiKey();
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY mancante: email non inviata.' };

  const resend = new Resend(apiKey);
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
      <li><strong>Prezzo target:</strong> ${formatEuro(monitor.target_price)}</li>
      <li><strong>Prezzo rilevato:</strong> ${formatEuro(detectedPrice)}</li>
      <li><strong>Data rilevazione:</strong> ${formatDate(checkedAt)}</li>
    </ul>
    <p><a href="${escapeAttribute(monitor.url)}">Apri pagina prodotto</a></p>
  `;

  try {
    const result = await resend.emails.send({
      from: env.alertFromEmail(),
      to: recipient,
      subject,
      html
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Errore email sconosciuto' };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#039;');
}

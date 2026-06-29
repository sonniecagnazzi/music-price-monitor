import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

export type TargetEmailOffer = {
  type: 'CD' | 'LP';
  channel: 'Medimops' | 'Momox';
  artist: string;
  title: string;
  price: number;
  condition: string;
  url: string;
  recipient: string;
};

type SendTargetSummaryEmailOptions = {
  to: string;
  offers: TargetEmailOffer[];
};

type SendAlertEmailOptions = {
  to: string;
  artist: string;
  album: string;
  site: string;
  url: string;
  currentPrice: number;
  targetPrice: number;
};

function getTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost(),
    port: env.smtpPort(),
    secure: env.smtpPort() === 465,
    auth: {
      user: env.smtpUser(),
      pass: env.smtpPassword()
    }
  });
}

function getFromEmail() {
  return env.alertFromEmail();
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

function getChannelColor(channel: 'Medimops' | 'Momox') {
  if (channel === 'Medimops') {
    return {
      background: '#ecfeff',
      color: '#168c95',
      border: '#cffafe'
    };
  }

  return {
    background: '#ecfdf5',
    color: '#159b77',
    border: '#d1fae5'
  };
}

function buildOfferRows(offers: TargetEmailOffer[]) {
  return offers
    .map((offer) => {
      const colors = getChannelColor(offer.channel);

      return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
            <a href="${escapeHtml(offer.url)}" style="color: #12201f; text-decoration: none; display: block;">
              <span style="display: inline-block; min-width: 34px; text-align: center; padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 12px; font-weight: 800;">
                ${escapeHtml(offer.type)}
              </span>
            </a>
          </td>

          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
            <a href="${escapeHtml(offer.url)}" style="color: ${colors.color}; text-decoration: none; display: block;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: ${colors.background}; border: 1px solid ${colors.border}; font-size: 12px; font-weight: 800;">
                ${escapeHtml(offer.channel)}
              </span>
            </a>
          </td>

          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
            <a href="${escapeHtml(offer.url)}" style="color: #12201f; text-decoration: none; display: block; font-weight: 800;">
              ${escapeHtml(offer.artist)}
            </a>
          </td>

          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
            <a href="${escapeHtml(offer.url)}" style="color: #334155; text-decoration: none; display: block;">
              ${escapeHtml(offer.title)}
            </a>
          </td>

          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; white-space: nowrap;">
            <a href="${escapeHtml(offer.url)}" style="color: #159b77; text-decoration: none; display: block; font-weight: 900;">
              ${escapeHtml(formatEuro(offer.price))}
            </a>
          </td>

          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
            <a href="${escapeHtml(offer.url)}" style="color: #12201f; text-decoration: none; display: block;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: #ecfdf5; color: #159b77; border: 1px solid #d1fae5; font-size: 12px; font-weight: 900;">
                ${escapeHtml(offer.condition)}
              </span>
            </a>
          </td>
        </tr>
      `;
    })
    .join('');
}

function buildTextSummary(offers: TargetEmailOffer[]) {
  return offers
    .map((offer) => {
      return [
        `${offer.channel}`,
        `${offer.type}`,
        `${offer.artist}`,
        `${offer.title}`,
        `${formatEuro(offer.price)}`,
        `Condizione ${offer.condition}`,
        `${offer.url}`
      ].join(' | ');
    })
    .join('\n');
}

function buildSummaryHtml(offers: TargetEmailOffer[]) {
  const medimopsCount = offers.filter((offer) => offer.channel === 'Medimops').length;
  const momoxCount = offers.filter((offer) => offer.channel === 'Momox').length;

  return `
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Music Price Monitor</title>
      </head>

      <body style="margin: 0; padding: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #12201f;">
        <div style="max-width: 980px; margin: 0 auto; padding: 28px 16px;">
          <div style="background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 18px 40px rgba(43, 64, 62, 0.08);">
            <div style="background: linear-gradient(135deg, #2b403e 0%, #16312f 100%); padding: 26px 28px; color: #ffffff;">
              <div style="font-size: 14px; font-weight: 800; color: #24bfbf; text-transform: uppercase; letter-spacing: 0.08em;">
                Music Price Monitor
              </div>

              <h1 style="margin: 8px 0 0; font-size: 28px; line-height: 1.2;">
                Offerte in target trovate
              </h1>

              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.72); font-size: 15px;">
                Questo riepilogo contiene solo prezzi sotto target con condizione NM o EX.
              </p>
            </div>

            <div style="padding: 22px 28px;">
              <div style="display: block; margin-bottom: 18px;">
                <span style="display: inline-block; margin-right: 8px; margin-bottom: 8px; padding: 8px 12px; border-radius: 999px; background: #ecfeff; color: #168c95; font-size: 13px; font-weight: 900; border: 1px solid #cffafe;">
                  Medimops: ${medimopsCount}
                </span>

                <span style="display: inline-block; margin-right: 8px; margin-bottom: 8px; padding: 8px 12px; border-radius: 999px; background: #ecfdf5; color: #159b77; font-size: 13px; font-weight: 900; border: 1px solid #d1fae5;">
                  Momox: ${momoxCount}
                </span>

                <span style="display: inline-block; margin-bottom: 8px; padding: 8px 12px; border-radius: 999px; background: #fff7ed; color: #d97825; font-size: 13px; font-weight: 900; border: 1px solid #fed7aa;">
                  Totale offerte: ${offers.length}
                </span>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Tipo</th>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Canale</th>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Artista</th>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Titolo</th>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Prezzo</th>
                    <th align="left" style="padding: 10px; border-bottom: 2px solid #dbe4e2; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Condizione</th>
                  </tr>
                </thead>

                <tbody>
                  ${buildOfferRows(offers)}
                </tbody>
              </table>

              <p style="margin: 20px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                Clicca su qualsiasi campo della riga per aprire direttamente la pagina prodotto Medimops o Momox.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendTargetSummaryEmail(options: SendTargetSummaryEmailOptions) {
  if (!options.to || options.offers.length === 0) return;

  const transporter = getTransporter();

  await transporter.sendMail({
    from: getFromEmail(),
    to: options.to,
    subject: `Music Price Monitor: ${options.offers.length} offerte in target`,
    text: `Offerte in target trovate:\n\n${buildTextSummary(options.offers)}`,
    html: buildSummaryHtml(options.offers)
  });
}

/**
 * Compatibilità con la vecchia logica.
 * La nuova logica usa sendTargetSummaryEmail dal monitor-runner.
 */
export async function sendAlertEmail(options: SendAlertEmailOptions) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getFromEmail(),
    to: options.to,
    subject: `Prezzo in target: ${options.artist} - ${options.album}`,
    text: [
      `Prezzo in target trovato.`,
      ``,
      `Sito: ${options.site}`,
      `Artista: ${options.artist}`,
      `Album: ${options.album}`,
      `Prezzo attuale: ${formatEuro(options.currentPrice)}`,
      `Target: ${formatEuro(options.targetPrice)}`,
      `URL: ${options.url}`
    ].join('\n'),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
        <h1>Prezzo in target trovato</h1>
        <p><strong>Sito:</strong> ${escapeHtml(options.site)}</p>
        <p><strong>Artista:</strong> ${escapeHtml(options.artist)}</p>
        <p><strong>Album:</strong> ${escapeHtml(options.album)}</p>
        <p><strong>Prezzo attuale:</strong> ${escapeHtml(formatEuro(options.currentPrice))}</p>
        <p><strong>Target:</strong> ${escapeHtml(formatEuro(options.targetPrice))}</p>
        <p>
          <a href="${escapeHtml(options.url)}">Apri prodotto</a>
        </p>
      </div>
    `
  });
}
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  price: number | null;
  source: string;
  error: string | null;
}

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  'meta[property="product:price:amount"]',
  'meta[itemprop="price"]',
  '.price',
  '.product-price',
  '[class*="price"]',
  '[data-testid*="price"]'
];

export function normalizePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[€£$]/g, '')
    .replace(/[^0-9,.-]/g, '')
    .trim();

  if (!cleaned) return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function extractFromJsonLd($: cheerio.CheerioAPI): number | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    try {
      const parsed: unknown = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of candidates) {
        const price = findOfferPrice(item);
        if (price !== null) return price;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findOfferPrice(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.price === 'string' || typeof record.price === 'number') {
    return normalizePrice(String(record.price));
  }
  const offers = record.offers;
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const price = findOfferPrice(offer);
      if (price !== null) return price;
    }
  } else if (offers && typeof offers === 'object') {
    const price = findOfferPrice(offers);
    if (price !== null) return price;
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const price = findOfferPrice(nested);
      if (price !== null) return price;
    }
  }
  return null;
}

function extractWithSelectors($: cheerio.CheerioAPI): number | null {
  for (const selector of PRICE_SELECTORS) {
    const nodes = $(selector).toArray().slice(0, 20);
    for (const node of nodes) {
      const element = $(node);
      const content = element.attr('content') || element.attr('value') || element.text();
      const price = normalizePrice(content);
      if (price !== null) return price;
    }
  }
  return null;
}

function extractWithRegex(html: string): number | null {
  const patterns = [
    /(?:price|preis|prix)[^0-9]{0,80}(\d{1,4}(?:[.,]\d{2}))/i,
    /(\d{1,4}(?:[.,]\d{2}))\s*€/i,
    /€\s*(\d{1,4}(?:[.,]\d{2}))/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const price = normalizePrice(match[1]);
      if (price !== null) return price;
    }
  }
  return null;
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36 MusicPriceMonitor/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8,fr;q=0.7,de;q=0.7'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return { price: null, source: 'http', error: `HTTP ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selected = extractWithSelectors($);
    if (selected !== null) return { price: selected, source: 'css', error: null };

    const jsonLd = extractFromJsonLd($);
    if (jsonLd !== null) return { price: jsonLd, source: 'json-ld', error: null };

    const regex = extractWithRegex(html);
    if (regex !== null) return { price: regex, source: 'regex', error: null };

    return { price: null, source: 'none', error: 'Prezzo non trovato nell’HTML della pagina.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto durante scraping';
    return { price: null, source: 'exception', error: message };
  }
}

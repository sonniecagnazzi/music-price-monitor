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
  'meta[name="twitter:data1"]',
  'meta[property="og:price:amount"]',
  'meta[property="product:price"]',
  '[data-testid*="price"]',
  '[class*="price"]',
  '[class*="Price"]',
  '.price',
  '.product-price',
  '.sales-price'
];

const BROWSER_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.9,it-IT,it;q=0.8,en-US;q=0.7,en;q=0.6,de;q=0.5',
  'accept-encoding': 'gzip, deflate, br',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'upgrade-insecure-requests': '1',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1'
};

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

    normalized =
      lastComma > lastDot
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

  if (
    typeof record.lowPrice === 'string' ||
    typeof record.lowPrice === 'number'
  ) {
    return normalizePrice(String(record.lowPrice));
  }

  if (
    typeof record.highPrice === 'string' ||
    typeof record.highPrice === 'number'
  ) {
    return normalizePrice(String(record.highPrice));
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
    const nodes = $(selector).toArray().slice(0, 40);

    for (const node of nodes) {
      const element = $(node);
      const content =
        element.attr('content') ||
        element.attr('value') ||
        element.attr('data-price') ||
        element.attr('aria-label') ||
        element.text();

      const price = normalizePrice(content);

      if (price !== null) return price;
    }
  }

  return null;
}

function extractWithRegex(html: string): number | null {
  const patterns = [
    /"price"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /"lowPrice"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /(?:price|preis|prix|prezzo)[^0-9]{0,120}(\\d{1,4}(?:[.,]\\d{2}))/i,
    /(\\d{1,4}(?:[.,]\\d{2}))\\s*€/i,
    /€\\s*(\\d{1,4}(?:[.,]\\d{2}))/i
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

function buildReferer(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return 'https://www.google.com/';
  }
}

async function fetchHtml(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  html: string | null;
}> {
  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      referer: buildReferer(url)
    },
    cache: 'no-store',
    redirect: 'follow'
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      html: null
    };
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    html: await response.text()
  };
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  try {
    const firstAttempt = await fetchHtml(url);

    if (!firstAttempt.ok) {
      if (firstAttempt.status === 403) {
        return {
          price: null,
          source: 'http-403',
          error:
            'HTTP 403 Forbidden: il sito ha bloccato la richiesta automatica dal server. Il monitor funziona, ma questo URL potrebbe bloccare Vercel/GitHub Actions.'
        };
      }

      return {
        price: null,
        source: 'http',
        error: `HTTP ${firstAttempt.status} ${firstAttempt.statusText}`
      };
    }

    const html = firstAttempt.html || '';
    const $ = cheerio.load(html);

    const selected = extractWithSelectors($);
    if (selected !== null) {
      return { price: selected, source: 'css', error: null };
    }

    const jsonLd = extractFromJsonLd($);
    if (jsonLd !== null) {
      return { price: jsonLd, source: 'json-ld', error: null };
    }

    const regex = extractWithRegex(html);
    if (regex !== null) {
      return { price: regex, source: 'regex', error: null };
    }

    return {
      price: null,
      source: 'none',
      error: 'Prezzo non trovato nell’HTML della pagina.'
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante scraping';

    return {
      price: null,
      source: 'exception',
      error: message
    };
  }
}

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
  'meta[property="product:price:amount"]',
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
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'upgrade-insecure-requests': '1'
};

const JINA_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'text/plain, text/markdown, */*',
  'x-no-cache': 'true'
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

function extractWithRegex(text: string): number | null {
  const patterns = [
    /"price"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /"lowPrice"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /(?:price|preis|prix|prezzo|price current|prix actuel|actuel)[^0-9]{0,160}(\\d{1,4}(?:[.,]\\d{2}))/i,
    /(\\d{1,4}(?:[.,]\\d{2}))\\s*€/i,
    /€\\s*(\\d{1,4}(?:[.,]\\d{2}))/i,
    /\\b(\\d{1,4}[.,]\\d{2})\\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

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

function buildJinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

async function fetchDirectHtml(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
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
      text: null
    };
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    text: await response.text()
  };
}

async function fetchViaJinaReader(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
}> {
  const readerUrl = buildJinaReaderUrl(url);

  const response = await fetch(readerUrl, {
    headers: JINA_HEADERS,
    cache: 'no-store',
    redirect: 'follow'
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      text: null
    };
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    text: await response.text()
  };
}

function extractPriceFromHtml(html: string): ScrapeResult {
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
    return { price: regex, source: 'regex-html', error: null };
  }

  return {
    price: null,
    source: 'none',
    error: 'Prezzo non trovato nell’HTML della pagina.'
  };
}

function extractPriceFromReaderText(text: string): ScrapeResult {
  const price = extractWithRegex(text);

  if (price !== null) {
    return {
      price,
      source: 'jina-reader',
      error: null
    };
  }

  return {
    price: null,
    source: 'jina-reader-none',
    error:
      'Prezzo non trovato neanche nel fallback Jina Reader. Il sito potrebbe nascondere il prezzo o bloccare anche il proxy reader.'
  };
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  try {
    const direct = await fetchDirectHtml(url);

    if (direct.ok && direct.text) {
      const directResult = extractPriceFromHtml(direct.text);

      if (directResult.price !== null) {
        return directResult;
      }

      const readerAfterNoPrice = await fetchViaJinaReader(url);

      if (readerAfterNoPrice.ok && readerAfterNoPrice.text) {
        const readerResult = extractPriceFromReaderText(readerAfterNoPrice.text);

        if (readerResult.price !== null) {
          return readerResult;
        }
      }

      return directResult;
    }

    const reader = await fetchViaJinaReader(url);

    if (reader.ok && reader.text) {
      const readerResult = extractPriceFromReaderText(reader.text);

      if (readerResult.price !== null) {
        return readerResult;
      }

      if (direct.status === 403) {
        return {
          price: null,
          source: 'http-403-jina-none',
          error:
            'HTTP 403 Forbidden dal sito originale. Ho provato anche il fallback Jina Reader, ma non ho trovato un prezzo leggibile.'
        };
      }

      return readerResult;
    }

    if (direct.status === 403) {
      return {
        price: null,
        source: 'http-403',
        error:
          'HTTP 403 Forbidden: il sito ha bloccato la richiesta automatica dal server e anche il fallback Jina Reader non ha restituito contenuto utile.'
      };
    }

    return {
      price: null,
      source: 'http',
      error: `HTTP ${direct.status} ${direct.statusText}. Fallback Jina Reader: HTTP ${reader.status} ${reader.statusText}.`
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

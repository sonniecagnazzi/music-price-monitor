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
  accept: 'text/plain, text/markdown, application/json, */*',
  'x-no-cache': 'true'
};

interface PriceCandidate {
  price: number;
  context: string;
  index: number;
  score: number;
}

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

function isLikelyShippingOrNoise(context: string): boolean {
  const lower = context.toLowerCase();

  const badWords = [
    'livraison gratuite',
    'livraison offerte',
    'frais de livraison',
    'shipping',
    'delivery',
    'spedizione',
    'newsletter',
    'paypal',
    'visa',
    'mastercard',
    'amazon',
    'recommandé pour vous',
    'plus de michael jackson',
    'besoin d’aide',
    'conditions générales',
    'protection des données'
  ];

  return badWords.some((word) => lower.includes(word));
}

function scoreCandidate(price: number, context: string, index: number): number {
  const lower = context.toLowerCase();
  let score = 0;

  if (price > 0 && price < 300) score += 10;
  if (lower.includes('en stock')) score += 40;
  if (lower.includes('tva incluse')) score += 35;
  if (lower.includes('ajouter au panier')) score += 35;
  if (lower.includes('choisissez l')) score += 30;
  if (lower.includes('très bon état')) score += 25;
  if (lower.includes('bon état')) score += 20;
  if (lower.includes('état')) score += 15;
  if (lower.includes('prix')) score += 15;
  if (lower.includes('price')) score += 15;
  if (lower.includes('offer')) score += 10;

  if (isLikelyShippingOrNoise(context)) score -= 80;

  // Leggero bonus ai prezzi che compaiono prima delle sezioni footer/recommendation,
  // ma non troppo forte perché molti siti caricano dati in fondo.
  if (index < 10000) score += 5;

  return score;
}

function extractSmartPriceFromText(text: string): number | null {
  const normalizedText = text.replace(/\u00a0/g, ' ');
  const priceRegex = /(?:€\s*)?(\d{1,4}(?:[.,]\d{2}))\s*€/g;
  const candidates: PriceCandidate[] = [];

  for (const match of normalizedText.matchAll(priceRegex)) {
    const rawPrice = match[1];
    const price = normalizePrice(rawPrice);

    if (price === null) continue;

    const index = match.index || 0;
    const start = Math.max(0, index - 220);
    const end = Math.min(normalizedText.length, index + 220);
    const context = normalizedText.slice(start, end);
    const score = scoreCandidate(price, context, index);

    candidates.push({
      price,
      context,
      index,
      score
    });
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -30)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return valid[0]?.price || null;
}

function extractWithRegex(text: string): number | null {
  const structuredPatterns = [
    /"price"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /"lowPrice"\s*:\s*"?(\\d{1,4}(?:[.,]\\d{2}))"?/i,
    /(?:price|preis|prix|prezzo|price current|prix actuel|actuel)[^0-9]{0,160}(\\d{1,4}(?:[.,]\\d{2}))/i
  ];

  for (const pattern of structuredPatterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const price = normalizePrice(match[1]);
      if (price !== null) return price;
    }
  }

  return extractSmartPriceFromText(text);
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

function buildJinaSearchUrl(url: string): string {
  return `https://s.jina.ai/?q=${encodeURIComponent(url)}`;
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

async function fetchViaJinaSearch(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
}> {
  const searchUrl = buildJinaSearchUrl(url);

  const response = await fetch(searchUrl, {
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

function extractPriceFromText(text: string, source: string): ScrapeResult {
  const price = extractWithRegex(text);

  if (price !== null) {
    return {
      price,
      source,
      error: null
    };
  }

  return {
    price: null,
    source: `${source}-none`,
    error: `Prezzo non trovato nel fallback ${source}.`
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
    }

    const reader = await fetchViaJinaReader(url);

    if (reader.ok && reader.text) {
      const readerResult = extractPriceFromText(reader.text, 'jina-reader');

      if (readerResult.price !== null) {
        return readerResult;
      }
    }

    const search = await fetchViaJinaSearch(url);

    if (search.ok && search.text) {
      const searchResult = extractPriceFromText(search.text, 'jina-search');

      if (searchResult.price !== null) {
        return searchResult;
      }
    }

    if (direct.status === 403) {
      return {
        price: null,
        source: 'http-403-all-fallbacks-failed',
        error:
          'HTTP 403 Forbidden dal sito originale. Ho provato anche Jina Reader e Jina Search, ma non ho trovato un prezzo leggibile.'
      };
    }

    return {
      price: null,
      source: 'all-fallbacks-failed',
      error: `Prezzo non trovato. HTTP diretto: ${direct.status} ${direct.statusText}. Reader: ${reader.status} ${reader.statusText}. Search: ${search.status} ${search.statusText}.`
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

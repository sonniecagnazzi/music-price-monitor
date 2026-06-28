import * as cheerio from 'cheerio';

export interface ScrapeResult {
  price: number | null;
  source: string;
  error: string | null;
  condition?: string | null;
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
  'accept-language':
    'de-DE,de;q=0.9,fr-FR,fr;q=0.8,it-IT,it;q=0.7,en-US;q=0.6,en;q=0.5',
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
  condition: string | null;
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

function cleanContext(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 500);
}

function makeSource(source: string, context?: string): string {
  if (!context) return source;

  return `${source} | contesto: ${cleanContext(context)}`;
}

function normalizeCondition(value: string): string | null {
  const lower = value.toLowerCase();

  if (
    lower.includes('sehr gut') ||
    lower.includes('sehr guter zustand') ||
    lower.includes('très bon état') ||
    lower.includes('tres bon etat') ||
    lower.includes('very good') ||
    lower.includes('ottime condizioni') ||
    lower.includes('ottimo stato')
  ) {
    return 'Sehr gut';
  }

  if (
    lower.includes('wie neu') ||
    lower.includes('comme neuf') ||
    lower.includes('like new') ||
    lower.includes('come nuovo')
  ) {
    return 'Wie neu';
  }

  if (
    lower.includes('akzeptabel') ||
    lower.includes('acceptable') ||
    lower.includes('accettabile')
  ) {
    return 'Akzeptabel';
  }

  if (
    lower.includes('gut') ||
    lower.includes('guter zustand') ||
    lower.includes('bon état') ||
    lower.includes('bon etat') ||
    lower.includes('good condition') ||
    lower.includes('buono stato') ||
    lower.includes('buone condizioni')
  ) {
    return 'Gut';
  }

  return null;
}

function extractConditionFromContext(context: string): string | null {
  const cleaned = cleanContext(context);

  return normalizeCondition(cleaned);
}

function extractFromJsonLd($: cheerio.CheerioAPI): ScrapeResult | null {
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const script of scripts) {
    const raw = $(script).contents().text();

    try {
      const parsed: unknown = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of candidates) {
        const result = findOfferPrice(item, raw);

        if (result.price !== null) return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findOfferPrice(value: unknown, context = ''): ScrapeResult {
  if (!value || typeof value !== 'object') {
    return { price: null, source: 'json-ld-none', error: null, condition: null };
  }

  const record = value as Record<string, unknown>;

  if (typeof record.price === 'string' || typeof record.price === 'number') {
    const price = normalizePrice(String(record.price));

    if (price !== null) {
      const condition =
        extractConditionFromContext(context || JSON.stringify(record)) ||
        extractConditionFromJsonLdRecord(record);

      return {
        price,
        condition,
        source: makeSource('json-ld-price', context || JSON.stringify(record)),
        error: null
      };
    }
  }

  const offers = record.offers;

  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const result = findOfferPrice(offer, context || JSON.stringify(offer));

      if (result.price !== null) return result;
    }
  } else if (offers && typeof offers === 'object') {
    const result = findOfferPrice(offers, context || JSON.stringify(offers));

    if (result.price !== null) return result;
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const result = findOfferPrice(nested, context);

      if (result.price !== null) return result;
    }
  }

  return { price: null, source: 'json-ld-none', error: null, condition: null };
}

function extractConditionFromJsonLdRecord(
  record: Record<string, unknown>
): string | null {
  const possibleValues = [
    record.itemCondition,
    record.condition,
    record.availability,
    record.description,
    record.name
  ];

  for (const value of possibleValues) {
    if (typeof value === 'string') {
      const condition = normalizeCondition(value);

      if (condition) return condition;
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
    'frais de port',
    'port offert',
    'shipping',
    'delivery',
    'free shipping',
    'spedizione',
    'spedizione gratuita',
    'spese di spedizione',
    'versand',
    'kostenloser versand',
    'versandkostenfrei',
    'versandkosten',
    'gratisversand',
    'kostenlose lieferung',
    'ab 19',
    'ab 19€',
    'ab 19 €',
    'dès 19',
    'dès 19€',
    'dès 19 €',
    'da 19',
    'da 19€',
    'da 19 €',
    'newsletter',
    'paypal',
    'visa',
    'mastercard',
    'amazon',
    'recommandé pour vous',
    'empfohlen',
    'mehr von',
    'plus de',
    'besoin d’aide',
    'conditions générales',
    'protection des données',
    'datenschutz',
    'widerruf',
    'agb',
    'impressum'
  ];

  return badWords.some((word) => lower.includes(word));
}

function hasPrimaryProductSignals(context: string): boolean {
  const lower = context.toLowerCase();

  const signals = [
    'en stock',
    'auf lager',
    'in stock',
    'disponibile',
    'sofort lieferbar',
    'tva incluse',
    'iva inclusa',
    'inkl. mwst',
    'inklusive mwst',
    'hors frais de livraison',
    'ajouter au panier',
    'in den warenkorb',
    'aggiungi al carrello'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function hasVeryGoodConditionSignal(context: string): boolean {
  const lower = context.toLowerCase();

  const signals = [
    'très bon état',
    'tres bon etat',
    'sehr gut',
    'sehr guter zustand',
    'very good',
    'ottime condizioni',
    'ottimo stato'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function hasPlainGoodConditionSignal(context: string): boolean {
  const lower = context.toLowerCase();

  const signals = [
    ' bon état',
    'bon etat',
    'guter zustand',
    'good condition',
    'buono stato',
    'buone condizioni'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function scoreCandidate(price: number, context: string, index: number): number {
  const lower = context.toLowerCase();
  let score = 0;

  if (price > 0 && price < 300) score += 10;

  if (lower.includes('in stock')) score += 60;
  if (lower.includes('en stock')) score += 60;
  if (lower.includes('auf lager')) score += 60;
  if (lower.includes('disponibile')) score += 60;
  if (lower.includes('sofort lieferbar')) score += 60;

  if (lower.includes('inkl. mwst')) score += 45;
  if (lower.includes('inklusive mwst')) score += 45;
  if (lower.includes('tva incluse')) score += 45;
  if (lower.includes('iva inclusa')) score += 45;
  if (lower.includes('hors frais de livraison')) score += 45;

  if (lower.includes('warenkorb')) score += 35;
  if (lower.includes('in den warenkorb')) score += 35;
  if (lower.includes('ajouter au panier')) score += 35;
  if (lower.includes('aggiungi al carrello')) score += 35;

  if (hasVeryGoodConditionSignal(context)) score += 90;

  if (hasPlainGoodConditionSignal(context) && !hasVeryGoodConditionSignal(context)) {
    score -= 80;
  }

  if (lower.includes('choisissez l’état')) score += 10;
  if (lower.includes("choisissez l'état")) score += 10;
  if (lower.includes('zustand wählen')) score += 10;
  if (lower.includes('choose condition')) score += 10;

  if (lower.includes('prix')) score += 15;
  if (lower.includes('preis')) score += 15;
  if (lower.includes('prezzo')) score += 15;
  if (lower.includes('price')) score += 15;

  if (isLikelyShippingOrNoise(context) && !hasPrimaryProductSignals(context)) {
    score -= 140;
  }

  if (price === 19 || price === 19.0) score -= 60;

  if (index < 12000) score += 5;

  return score;
}

function findBestPriceAfterMarker(
  text: string,
  marker: string
): ScrapeResult | null {
  const normalizedText = text.replace(/\u00a0/g, ' ');
  const lower = normalizedText.toLowerCase();
  const markerIndex = lower.indexOf(marker.toLowerCase());

  if (markerIndex < 0) return null;

  const afterText = normalizedText.slice(markerIndex, markerIndex + 900);
  const priceRegex = /(?:€\s*)?(\d{1,4}(?:[.,]\d{2}))\s*€/g;

  let match = priceRegex.exec(afterText);

  while (match !== null) {
    const price = normalizePrice(match[1]);

    if (price !== null && price < 300) {
      const globalIndex = markerIndex + match.index;
      const contextStart = Math.max(0, globalIndex - 500);
      const contextEnd = Math.min(normalizedText.length, globalIndex + 500);
      const context = normalizedText.slice(contextStart, contextEnd);
      const condition = extractConditionFromContext(context);

      return {
        price,
        condition,
        source: makeSource(`regex-after-marker:${marker}`, context),
        error: null
      };
    }

    match = priceRegex.exec(afterText);
  }

  return null;
}

function findBestPriceNearPrimaryBlock(text: string): ScrapeResult | null {
  const markers = [
    'sehr gut',
    'auf lager',
    'inkl. mwst',
    'inklusive mwst',
    'en stock',
    'tva incluse',
    'hors frais de livraison',
    'in stock',
    'disponibile',
    'iva inclusa'
  ];

  for (const marker of markers) {
    const result = findBestPriceAfterMarker(text, marker);

    if (result !== null) return result;
  }

  return null;
}

function extractSmartPriceFromText(text: string): ScrapeResult | null {
  const primaryBlockResult = findBestPriceNearPrimaryBlock(text);

  if (primaryBlockResult !== null) {
    return primaryBlockResult;
  }

  const normalizedText = text.replace(/\u00a0/g, ' ');
  const priceRegex = /(?:€\s*)?(\d{1,4}(?:[.,]\d{2}))\s*€/g;
  const candidates: PriceCandidate[] = [];

  let match = priceRegex.exec(normalizedText);

  while (match !== null) {
    const rawPrice = match[1];
    const price = normalizePrice(rawPrice);

    if (price !== null) {
      const index = match.index;
      const start = Math.max(0, index - 500);
      const end = Math.min(normalizedText.length, index + 500);
      const context = normalizedText.slice(start, end);
      const score = scoreCandidate(price, context, index);
      const condition = extractConditionFromContext(context);

      candidates.push({
        price,
        context,
        index,
        score,
        condition
      });
    }

    match = priceRegex.exec(normalizedText);
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -80)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) return null;

  return {
    price: best.price,
    condition: best.condition,
    source: makeSource(`regex-smart score=${best.score}`, best.context),
    error: null
  };
}

function extractWithRegex(text: string): ScrapeResult | null {
  const smart = extractSmartPriceFromText(text);

  if (smart !== null) return smart;

  const structuredPatterns = [
    {
      name: 'structured-price',
      pattern: /"price"\s*:\s*"?(\d{1,4}(?:[.,]\d{2}))"?/i
    },
    {
      name: 'label-price',
      pattern:
        /(?:price|preis|prix|prezzo|actuel|aktuell)[^0-9]{0,160}(\d{1,4}(?:[.,]\d{2}))/i
    }
  ];

  for (const item of structuredPatterns) {
    const match = text.match(item.pattern);

    if (match?.[1]) {
      const price = normalizePrice(match[1]);

      if (price !== null && price < 300) {
        const index = match.index || 0;
        const context = text.slice(
          Math.max(0, index - 500),
          Math.min(text.length, index + 500)
        );
        const condition = extractConditionFromContext(context);

        return {
          price,
          condition,
          source: makeSource(item.name, context),
          error: null
        };
      }
    }
  }

  return null;
}

function extractWithSelectors($: cheerio.CheerioAPI): ScrapeResult | null {
  const candidates: PriceCandidate[] = [];

  for (const selector of PRICE_SELECTORS) {
    const nodes = $(selector).toArray().slice(0, 80);

    for (const node of nodes) {
      const element = $(node);
      const content =
        element.attr('content') ||
        element.attr('value') ||
        element.attr('data-price') ||
        element.attr('aria-label') ||
        element.text();

      const price = normalizePrice(content);

      if (price !== null && price < 300) {
        const parentContext =
          element.parent().text() ||
          element.closest('section, article, div').text() ||
          content;

        const context = parentContext || content;
        const condition = extractConditionFromContext(context);

        candidates.push({
          price,
          context,
          index: 0,
          score: scoreCandidate(price, context, 0),
          condition
        });
      }
    }
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -80)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) return null;

  return {
    price: best.price,
    condition: best.condition,
    source: makeSource(`css-smart score=${best.score}`, best.context),
    error: null
  };
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
  const regex = extractWithRegex(html);

  if (regex !== null) return { ...regex, source: `html:${regex.source}` };

  const selected = extractWithSelectors(cheerio.load(html));

  if (selected !== null) return selected;

  const jsonLd = extractFromJsonLd(cheerio.load(html));

  if (jsonLd !== null) return jsonLd;

  return {
    price: null,
    condition: null,
    source: 'html-none',
    error: 'Prezzo non trovato nell’HTML della pagina.'
  };
}

function extractPriceFromText(text: string, source: string): ScrapeResult {
  const result = extractWithRegex(text);

  if (result !== null) {
    return {
      price: result.price,
      condition: result.condition ?? null,
      source: `${source}:${result.source}`,
      error: null
    };
  }

  return {
    price: null,
    condition: null,
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
        condition: null,
        source: 'http-403-all-fallbacks-failed',
        error:
          'HTTP 403 Forbidden dal sito originale. Ho provato anche Jina Reader e Jina Search, ma non ho trovato un prezzo leggibile.'
      };
    }

    return {
      price: null,
      condition: null,
      source: 'all-fallbacks-failed',
      error: `Prezzo non trovato. HTTP diretto: ${direct.status} ${direct.statusText}. Reader e Search non hanno trovato prezzi validi.`
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante scraping';

    return {
      price: null,
      condition: null,
      source: 'exception',
      error: message
    };
  }
}

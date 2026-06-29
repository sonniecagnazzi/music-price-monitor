// Scraper compatibility version: 2026-06-29

import * as cheerio from 'cheerio';

export type StoreName = 'Medimops' | 'Momox';

export type ScrapeResult = {
  price: number | null;
  condition?: string | null;
  status?: 'ok' | 'not_found' | 'error';
  message?: string;
  source: string;
  error: string | null;
};

type Candidate = {
  price: number | null;
  condition: string | null;
  score: number;
  source: string;
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const REQUEST_TIMEOUT_MS = 30000;

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();

  setTimeout(() => controller.abort(), ms);

  return controller.signal;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForSearch(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parsePrice(value: string): number | null {
  const normalized = normalizeText(value);

  const matches = normalized.match(
    /(?:€\s*)?([0-9]{1,4}(?:[.,][0-9]{2}))(?:\s*€)?/g
  );

  if (!matches || matches.length === 0) return null;

  const prices = matches
    .map((match) => {
      const cleaned = match
        .replace('€', '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

      const parsed = Number(cleaned);

      if (!Number.isFinite(parsed) || parsed <= 0) return null;

      return Math.round(parsed * 100) / 100;
    })
    .filter((price): price is number => price !== null)
    .filter((price) => price >= 0.5 && price <= 9999);

  if (prices.length === 0) return null;

  return prices[0];
}

/**
 * Compatibilità con amazon-scraper.ts.
 * Non tocca la logica Amazon: espone solo la normalizzazione prezzo già usata prima.
 */
export function normalizePrice(value: string): number | null {
  return parsePrice(value);
}

function extractJsonLdText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text();

    if (text) parts.push(text);
  });

  return parts.join('\n');
}

function extractVisibleText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, svg').remove();

  return normalizeText($.root().text());
}

function normalizeCondition(value: string, store: StoreName): string | null {
  const text = normalizeForSearch(value);

  if (!text) return null;

  const nearMintSignals =
    store === 'Medimops'
      ? ['wie neu', 'zustand wie neu', 'artikelzustand wie neu']
      : ['comme neuf', 'etat comme neuf', 'article comme neuf'];

  if (nearMintSignals.some((signal) => text.includes(signal))) {
    return 'NM';
  }

  const excellentSignals =
    store === 'Medimops'
      ? [
          'sehr gut',
          'sehr guter zustand',
          'artikelzustand sehr gut',
          'very good',
          'ottime condizioni',
          'ottimo stato'
        ]
      : [
          'tres bon etat',
          'tres bon',
          'tres bon état',
          'très bon état',
          'très bon',
          'very good',
          'ottime condizioni',
          'ottimo stato'
        ];

  if (excellentSignals.some((signal) => text.includes(signal))) {
    return 'EX';
  }

  const veryGoodSignals =
    store === 'Medimops'
      ? [
          'gut',
          'guter zustand',
          'artikelzustand gut',
          'good condition',
          'buono stato',
          'buone condizioni'
        ]
      : [
          'bon etat',
          'bon état',
          'bon',
          'good condition',
          'buono stato',
          'buone condizioni'
        ];

  if (veryGoodSignals.some((signal) => text.includes(signal))) {
    return 'VG';
  }

  const goodSignals =
    store === 'Medimops'
      ? ['akzeptabel', 'acceptable', 'accettabile']
      : ['acceptable', 'accettabile', 'akzeptabel'];

  if (goodSignals.some((signal) => text.includes(signal))) {
    return 'G';
  }

  return null;
}

function conditionScore(condition: string | null): number {
  if (condition === 'NM') return 50;
  if (condition === 'EX') return 40;
  if (condition === 'VG') return 20;
  if (condition === 'G') return 10;

  return 0;
}

function getStoreFromUrl(url: string): StoreName {
  const lower = url.toLowerCase();

  if (lower.includes('momox-shop')) return 'Momox';

  return 'Medimops';
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'it-IT,it;q=0.9,en;q=0.8,de;q=0.7,fr;q=0.7',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': USER_AGENT
    },
    signal: timeoutSignal(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchViaJinaReader(url: string): Promise<string> {
  const normalizedUrl = url.replace(/^https?:\/\//, '');
  const readerUrl = `https://r.jina.ai/http://${normalizedUrl}`;

  const response = await fetch(readerUrl, {
    headers: {
      accept: 'text/plain,text/markdown,*/*',
      'user-agent': USER_AGENT
    },
    signal: timeoutSignal(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Jina Reader HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchViaJinaSearch(_url: string): Promise<string> {
  throw new Error('Jina Search non disponibile per questo URL.');
}

function extractCandidatesFromHtml(html: string, store: StoreName): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];

  const jsonLdText = extractJsonLdText($);

  if (jsonLdText) {
    const jsonLdPrice = parsePrice(jsonLdText);
    const jsonLdCondition = normalizeCondition(jsonLdText, store);

    if (jsonLdPrice !== null) {
      candidates.push({
        price: jsonLdPrice,
        condition: jsonLdCondition,
        score: 100 + conditionScore(jsonLdCondition),
        source: 'json-ld'
      });
    }
  }

  const metaPriceSelectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    '[itemprop="price"]'
  ];

  for (const selector of metaPriceSelectors) {
    const value =
      $(selector).attr('content') ||
      $(selector).attr('value') ||
      $(selector).text();

    const price = parsePrice(value || '');

    if (price !== null) {
      const localText = normalizeText(
        [
          $(selector).closest('section').text(),
          $(selector).closest('div').text(),
          $(selector).parent().text()
        ].join(' ')
      );

      const condition = normalizeCondition(localText, store);

      candidates.push({
        price,
        condition,
        score: 95 + conditionScore(condition),
        source: selector
      });
    }
  }

  const priceSelectors = [
    '[data-testid*="price"]',
    '[class*="price"]',
    '[class*="Price"]',
    '[id*="price"]',
    '[id*="Price"]',
    '.product-price',
    '.price',
    '.sales-price',
    '.product__price'
  ];

  for (const selector of priceSelectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      const text = normalizeText(node.text());
      const price = parsePrice(text);

      if (price === null) return;

      const context = normalizeText(
        [
          text,
          node.parent().text(),
          node.closest('section').text(),
          node.closest('article').text(),
          node.closest('div').text()
        ].join(' ')
      );

      const condition = normalizeCondition(context, store);

      candidates.push({
        price,
        condition,
        score: 80 + conditionScore(condition),
        source: selector
      });
    });
  }

  const visibleText = extractVisibleText($);
  const visiblePrice = parsePrice(visibleText);
  const visibleCondition = normalizeCondition(visibleText, store);

  if (visiblePrice !== null) {
    candidates.push({
      price: visiblePrice,
      condition: visibleCondition,
      score: 40 + conditionScore(visibleCondition),
      source: 'visible-text'
    });
  }

  return candidates;
}

function extractCandidatesFromText(text: string, store: StoreName): Candidate[] {
  const normalized = normalizeText(text);
  const candidates: Candidate[] = [];

  const condition = normalizeCondition(normalized, store);
  const price = parsePrice(normalized);

  if (price !== null) {
    candidates.push({
      price,
      condition,
      score: 40 + conditionScore(condition),
      source: 'text'
    });
  }

  const lines = normalized
    .split(/(?:\n| {2,})/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const priceInLine = parsePrice(line);

    if (priceInLine === null) continue;

    const context = [
      lines[index - 3] || '',
      lines[index - 2] || '',
      lines[index - 1] || '',
      line,
      lines[index + 1] || '',
      lines[index + 2] || '',
      lines[index + 3] || ''
    ].join(' ');

    const localCondition = normalizeCondition(context, store);

    candidates.push({
      price: priceInLine,
      condition: localCondition,
      score: 60 + conditionScore(localCondition),
      source: 'text-lines'
    });
  }

  return candidates;
}

function pickBestCandidate(candidates: Candidate[]): Candidate | null {
  const valid = candidates.filter((candidate) => candidate.price !== null);

  if (valid.length === 0) return null;

  return [...valid].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    if (a.price !== null && b.price !== null) {
      return a.price - b.price;
    }

    return 0;
  })[0];
}

function resultFromCandidate(
  candidate: Candidate | null,
  sourceLabel: string
): ScrapeResult {
  if (!candidate || candidate.price === null) {
    return {
      price: null,
      condition: null,
      status: 'not_found',
      message: `Prezzo non trovato (${sourceLabel}).`,
      source: sourceLabel,
      error: null
    };
  }

  return {
    price: candidate.price,
    condition: candidate.condition,
    status: 'ok',
    message: candidate.condition
      ? `Prezzo trovato: ${candidate.price.toFixed(2)} €, condizione ${candidate.condition}.`
      : `Prezzo trovato: ${candidate.price.toFixed(2)} €, condizione non trovata.`,
    source: `${sourceLabel}:${candidate.source}`,
    error: null
  };
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  const trimmedUrl = String(url || '').trim();

  if (!trimmedUrl) {
    return {
      price: null,
      condition: null,
      status: 'not_found',
      message: 'URL mancante.',
      source: 'scraper',
      error: 'URL mancante.'
    };
  }

  const store = getStoreFromUrl(trimmedUrl);

  try {
    const html = await fetchText(trimmedUrl);
    const candidates = extractCandidatesFromHtml(html, store);
    const best = pickBestCandidate(candidates);

    if (best) {
      return resultFromCandidate(best, 'direct');
    }
  } catch (error) {
    const directMessage =
      error instanceof Error ? error.message : 'errore diretto sconosciuto';

    try {
      const readerText = await fetchViaJinaReader(trimmedUrl);
      const candidates = extractCandidatesFromText(readerText, store);
      const best = pickBestCandidate(candidates);

      if (best) {
        return resultFromCandidate(best, `jina-reader dopo ${directMessage}`);
      }
    } catch (readerError) {
      const readerMessage =
        readerError instanceof Error
          ? readerError.message
          : 'errore Jina Reader sconosciuto';

      try {
        const searchText = await fetchViaJinaSearch(trimmedUrl);
        const candidates = extractCandidatesFromText(searchText, store);
        const best = pickBestCandidate(candidates);

        if (best) {
          return resultFromCandidate(best, `jina-search dopo ${readerMessage}`);
        }
      } catch {
        return {
          price: null,
          condition: null,
          status: 'error',
          message: `Errore scraping: direct=${directMessage}; reader=${readerMessage}`,
          source: 'scraper',
          error: `direct=${directMessage}; reader=${readerMessage}`
        };
      }
    }

    return {
      price: null,
      condition: null,
      status: 'not_found',
      message: `Prezzo non trovato dopo fallback. Direct: ${directMessage}`,
      source: 'scraper',
      error: directMessage
    };
  }

  try {
    const readerText = await fetchViaJinaReader(trimmedUrl);
    const candidates = extractCandidatesFromText(readerText, store);
    const best = pickBestCandidate(candidates);

    if (best) {
      return resultFromCandidate(best, 'jina-reader');
    }
  } catch {
    // Continua verso not_found.
  }

  return {
    price: null,
    condition: null,
    status: 'not_found',
    message: 'Prezzo non trovato.',
    source: 'scraper',
    error: 'Prezzo non trovato.'
  };
}
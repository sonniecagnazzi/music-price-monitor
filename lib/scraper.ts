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
      ? [
          'wie neu',
          'zustand wie neu',
          'artikelzustand wie neu',
          'neuwertig',
          'neuwertiger zustand',
          'artikelzustand neuwertig'
        ]
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCandidatePrice(value: string): number | null {
  const normalized = normalizeText(value);
  const match = normalized.match(/([0-9]{1,4}(?:[.,][0-9]{2}))\s*€/);

  if (!match) return null;

  const raw = match[1].replace('.', '').replace(',', '.');
  const price = Number(raw);

  if (!Number.isFinite(price) || price <= 0) return null;

  return Math.round(price * 100) / 100;
}

function getConditionSearchTerms(store: StoreName): Array<{
  condition: string;
  terms: string[];
}> {
  if (store === 'Medimops') {
    return [
      {
        condition: 'NM',
        terms: [
          'wie neu',
          'zustand wie neu',
          'artikelzustand wie neu',
          'neuwertig',
          'neuwertiger zustand',
          'artikelzustand neuwertig'
        ]
      },
      {
        condition: 'EX',
        terms: ['sehr gut', 'zustand sehr gut', 'artikelzustand sehr gut']
      },
      {
        condition: 'VG',
        terms: ['gut', 'zustand gut', 'artikelzustand gut']
      },
      {
        condition: 'G',
        terms: ['akzeptabel', 'zustand akzeptabel', 'artikelzustand akzeptabel']
      }
    ];
  }

  return [
    {
      condition: 'NM',
      terms: ['comme neuf', 'etat comme neuf']
    },
    {
      condition: 'EX',
      terms: ['tres bon etat', 'très bon état']
    },
    {
      condition: 'VG',
      terms: ['bon etat', 'bon état']
    },
    {
      condition: 'G',
      terms: ['acceptable']
    }
  ];
}

function extractConditionPriceCandidates(
  value: string,
  store: StoreName,
  source: string
): Candidate[] {
  const normalized = normalizeText(value);
  const searchable = normalizeForSearch(normalized);
  const candidates: Candidate[] = [];

  for (const group of getConditionSearchTerms(store)) {
    for (const term of group.terms) {
      const searchableTerm = normalizeForSearch(term);
      const termRegex = new RegExp(escapeRegExp(searchableTerm), 'g');

      let match: RegExpExecArray | null;

      while ((match = termRegex.exec(searchable)) !== null) {
        const index = match.index;
        const before = normalized.slice(Math.max(0, index - 90), index);
        const after = normalized.slice(
          index,
          Math.min(normalized.length, index + searchableTerm.length + 120)
        );

        const afterPrice = parseCandidatePrice(after);
        const beforePrice = parseCandidatePrice(before);
        const price = afterPrice ?? beforePrice;

        if (price === null) continue;

        candidates.push({
          price,
          condition: group.condition,
          score: 1000 + conditionScore(group.condition),
          source: `${source}:condition-price:${searchableTerm}`
        });
      }
    }
  }

  return candidates;
}


function conditionScore(condition: string | null): number {
  if (condition === 'NM') return 120;
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

function buildBrowserLikeHeaders(url: string): Record<string, string> {
  const isMedimops = url.includes('medimops.de');
  const isMomox = url.includes('momox-shop.fr');

  const acceptLanguage = isMedimops
    ? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    : isMomox
      ? 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      : 'en-US,en;q=0.9';

  const referer = isMedimops
    ? 'https://www.medimops.de/'
    : isMomox
      ? 'https://www.momox-shop.fr/'
      : 'https://www.google.com/';

  return {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': acceptLanguage,
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    referer,
    'upgrade-insecure-requests': '1'
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: buildBrowserLikeHeaders(url)
  });

  const body = await response.text();

  if (!response.ok) {
    const sample = body
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);

    console.log(
      `[scraper-http-debug] url=${url} status=${response.status} statusText="${response.statusText}" body="${sample}"`
    );

    throw new Error(`HTTP ${response.status}`);
  }

  return body;
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



function buildFallbackUrlVariants(url: string): string[] {
  const trimmedUrl = url.trim();
  const variants = new Set<string>();

  variants.add(trimmedUrl);
  variants.add(trimmedUrl.toLowerCase());

  if (trimmedUrl.includes('www.medimops.de')) {
    variants.add(trimmedUrl.replace('https://www.medimops.de/', 'https://medimops.de/'));
    variants.add(trimmedUrl.toLowerCase().replace('https://www.medimops.de/', 'https://medimops.de/'));
  }

  if (trimmedUrl.includes('www.momox-shop.fr')) {
    variants.add(trimmedUrl.replace('https://www.momox-shop.fr/', 'https://momox-shop.fr/'));
    variants.add(trimmedUrl.toLowerCase().replace('https://www.momox-shop.fr/', 'https://momox-shop.fr/'));
  }

  return Array.from(variants).filter(Boolean);
}

function buildSearchQueryFromUrl(url: string, store: StoreName): string {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname
      .replace(/\.html$/i, '')
      .replace(/^\/+/, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return `${store} ${slug}`;
  } catch {
    return `${store} ${url}`;
  }
}

async function fetchViaJinaSearch(url: string, store: StoreName): Promise<string> {
  const query = buildSearchQueryFromUrl(url, store);
  const searchUrl = `https://s.jina.ai/?q=${encodeURIComponent(query)}`;

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/plain,text/markdown,*/*',
      'accept-language': store === 'Medimops'
        ? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
        : 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const body = await response.text();

  console.log(
    `[scraper-fallback-debug] ${store} jina-search status=${response.status} url=${url} query="${query}" length=${body.length}`
  );

  if (!response.ok) {
    throw new Error(`Jina Search HTTP ${response.status}`);
  }

  return body;
}

async function fetchViaFallbackReaders(url: string, store: StoreName): Promise<string> {
  const variants = buildFallbackUrlVariants(url);
  const errors: string[] = [];

  for (const variant of variants) {
    try {
      const text = await fetchViaJinaReader(variant);

      console.log(
        `[scraper-fallback-debug] ${store} jina-reader variant="${variant}" length=${text.length} hasWieNeu=${normalizeForSearch(text).includes('wie neu')} hasCommeNeuf=${normalizeForSearch(text).includes('comme neuf')}`
      );

      if (text.trim().length > 0) {
        return text;
      }

      errors.push(`reader empty: ${variant}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'errore sconosciuto';

      console.log(
        `[scraper-fallback-debug] ${store} jina-reader variant="${variant}" error="${message}"`
      );

      errors.push(`reader ${variant}: ${message}`);
    }
  }

  try {
    const searchText = await fetchViaJinaSearch(url, store);

    if (searchText.trim().length > 0) {
      return searchText;
    }

    errors.push('jina-search empty');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'errore sconosciuto';
    errors.push(`jina-search: ${message}`);
  }

  throw new Error(`Fallback non riusciti: ${errors.join(' | ')}`);
}

function extractCandidatesFromHtml(html: string, store: StoreName): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = extractConditionPriceCandidates(
    html,
    store,
    'html-condition-price'
  );

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
          node.closest('main').text(),
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
  const visibleCondition = null;

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
  const candidates: Candidate[] = extractConditionPriceCandidates(
    normalized,
    store,
    'text-condition-price'
  );

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
      lines[index - 10] || '',
      lines[index - 9] || '',
      lines[index - 8] || '',
      lines[index - 7] || '',
      lines[index - 6] || '',
      lines[index - 5] || '',
      lines[index - 4] || '',
      lines[index - 3] || '',
      lines[index - 2] || '',
      lines[index - 1] || '',
      line,
      lines[index + 1] || '',
      lines[index + 2] || '',
      lines[index + 3] || '',
      lines[index + 4] || '',
      lines[index + 5] || '',
      lines[index + 6] || '',
      lines[index + 7] || '',
      lines[index + 8] || '',
      lines[index + 9] || '',
      lines[index + 10] || ''
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


function logScraperDebug(
  url: string,
  store: StoreName,
  label: string,
  candidates: Candidate[],
  rawText: string
) {
  const normalizedRawText = normalizeForSearch(rawText);
  const shouldDebug =
    url.includes('M0B00005USE3') ||
    normalizedRawText.includes('wie neu') ||
    normalizedRawText.includes('neuwertig') ||
    normalizedRawText.includes('comme neuf');

  if (!shouldDebug) return;

  const topCandidates = [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((candidate) => ({
      source: candidate.source,
      price: candidate.price,
      condition: candidate.condition,
      score: candidate.score
    }));

  const signals = {
    hasWieNeu: normalizedRawText.includes('wie neu'),
    hasNeuwertig: normalizedRawText.includes('neuwertig'),
    hasSehrGut: normalizedRawText.includes('sehr gut'),
    hasCommeNeuf: normalizedRawText.includes('comme neuf'),
    hasTresBonEtat: normalizedRawText.includes('tres bon etat')
  };

  const signalTerms = ['wie neu', 'neuwertig', 'sehr gut', 'comme neuf', 'tres bon etat'];
  const excerpts = signalTerms
    .map((term) => {
      const index = normalizedRawText.indexOf(term);

      if (index < 0) return null;

      return {
        term,
        excerpt: normalizedRawText.slice(
          Math.max(0, index - 180),
          Math.min(normalizedRawText.length, index + 220)
        )
      };
    })
    .filter(Boolean);

  console.log(
    `[scraper-debug] ${store} ${label} url=${url} signals=${JSON.stringify(signals)}`
  );

  console.log(
    `[scraper-debug] ${store} ${label} topCandidates=${JSON.stringify(topCandidates)}`
  );

  console.log(
    `[scraper-debug] ${store} ${label} excerpts=${JSON.stringify(excerpts)}`
  );
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
    logScraperDebug(trimmedUrl, store, 'direct-html', candidates, html);
    const best = pickBestCandidate(candidates);

    if (best) {
      return resultFromCandidate(best, 'direct');
    }
  } catch (error) {
    const directMessage =
      error instanceof Error ? error.message : 'errore diretto sconosciuto';

    try {
      const readerText = await fetchViaFallbackReaders(trimmedUrl, store);
      const candidates = extractCandidatesFromText(readerText, store);
      logScraperDebug(trimmedUrl, store, 'jina-reader-after-direct-error', candidates, readerText);
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
        const searchText = await fetchViaJinaSearch(trimmedUrl, store);
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
    const readerText = await fetchViaFallbackReaders(trimmedUrl, store);
    const candidates = extractCandidatesFromText(readerText, store);
    logScraperDebug(trimmedUrl, store, 'jina-reader-after-no-direct-result', candidates, readerText);
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
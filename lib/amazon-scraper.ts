import * as cheerio from 'cheerio';
import { normalizePrice, type ScrapeResult } from '@/lib/scraper';

export type AmazonMarketplace = 'FR' | 'DE' | 'IT';

const AMAZON_DOMAINS: Record<AmazonMarketplace, string> = {
  FR: 'amazon.fr',
  DE: 'amazon.de',
  IT: 'amazon.it'
};

const AMAZON_VAT_RATES: Record<AmazonMarketplace, number> = {
  FR: 0.2,
  DE: 0.19,
  IT: 0.22
};

const BROWSER_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language':
    'it-IT,it;q=0.95,fr-FR,fr;q=0.9,de-DE,de;q=0.8,en-US;q=0.6,en;q=0.5',
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

type PriceCandidateKind = 'offer-listing' | 'core-price';

type PriceCandidate = {
  price: number;
  index: number;
  score: number;
  context: string;
  source: string;
  kind: PriceCandidateKind;
};

type FetchResult = {
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
};

export function buildAmazonUrl(
  asin: string,
  marketplace: AmazonMarketplace
): string {
  return `https://www.${AMAZON_DOMAINS[marketplace]}/dp/${asin}`;
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanContext(value: string, maxLength = 1400): string {
  return cleanText(value).slice(0, maxLength);
}

function buildJinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

function buildJinaSearchUrl(url: string): string {
  return `https://s.jina.ai/?q=${encodeURIComponent(url)}`;
}

function getContext(text: string, index: number, before = 600, after = 900) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function addVat(price: number, marketplace: AmazonMarketplace): number {
  return roundPrice(price * (1 + AMAZON_VAT_RATES[marketplace]));
}

function parseEuroPrice(raw: string): number | null {
  if (!/€/.test(raw)) return null;

  return normalizePrice(raw);
}

function hasUsdPrice(text: string): boolean {
  return /\bUSD\b|\$\s*\d{1,5}(?:[.,]\d{2})|\d{1,5}(?:[.,]\d{2})\s*USD/i.test(
    text
  );
}

function hasEuroPrice(text: string): boolean {
  return /€\s*\d{1,5}(?:[.,]\d{2})|\d{1,5}(?:[.,]\d{2})\s*€/i.test(text);
}

function looksVatExcluded(text: string): boolean {
  const lower = cleanText(text).toLowerCase();

  return (
    lower.includes('united states') ||
    lower.includes('stati uniti') ||
    lower.includes('états-unis') ||
    lower.includes('etats-unis') ||
    lower.includes('vereinigte staaten') ||
    lower.includes('vat may vary') ||
    lower.includes('depending on your delivery address') ||
    lower.includes('iva può variare') ||
    lower.includes('iva puo variare') ||
    lower.includes('tva peut varier')
  );
}

function isOfferListingContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const hasOfferArea =
    lower.includes('other sellers on amazon') ||
    lower.includes('altri venditori') ||
    lower.includes('autres vendeurs') ||
    lower.includes('andere verkäufer') ||
    lower.includes('andere verkaeufer') ||
    lower.includes('offer-listing');

  const hasNewUsed =
    lower.includes('new & used') ||
    lower.includes('new and used') ||
    lower.includes('nuovo e usato') ||
    lower.includes('nuovi e usati') ||
    lower.includes('neuf et occasion') ||
    lower.includes('neuf & occasion') ||
    lower.includes('neu und gebraucht') ||
    lower.includes('neu & gebraucht');

  const hasFrom =
    lower.includes('from€') ||
    lower.includes('from €') ||
    lower.includes('da€') ||
    lower.includes('da €') ||
    lower.includes('à partir de€') ||
    lower.includes('à partir de €') ||
    lower.includes('ab€') ||
    lower.includes('ab €');

  return (hasOfferArea && hasNewUsed) || (hasNewUsed && hasFrom);
}

function isClearlyBadContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const badSignals = [
    'frequently bought together',
    'spesso comprati insieme',
    'fréquemment achetés ensemble',
    'wird oft zusammen gekauft',
    'this item:',
    'questo articolo:',
    'cet article:',
    'dieser artikel:'
  ];

  return badSignals.some((signal) => lower.includes(signal));
}

function addOfferCandidate(
  candidates: PriceCandidate[],
  fullText: string,
  price: number | null,
  index: number,
  source: string,
  contextOverride?: string
) {
  if (price === null || price <= 0 || price >= 1000) return;

  const context = contextOverride || getContext(fullText, index);

  if (!hasEuroPrice(context)) return;
  if (hasUsdPrice(context) && !hasEuroPrice(context)) return;
  if (!isOfferListingContext(context)) return;
  if (isClearlyBadContext(context)) return;

  let score = 10000;

  if (source.includes('reader')) score += 1000;
  if (source.includes('direct')) score += 700;
  if (source.includes('other-sellers')) score += 700;
  if (source.includes('new-used')) score += 700;
  if (source.includes('from-euro')) score += 500;
  if (source.includes('offer-listing-link')) score += 400;

  candidates.push({
    price,
    index,
    score,
    context,
    source,
    kind: 'offer-listing'
  });
}

function addCoreCandidate(
  candidates: PriceCandidate[],
  fullText: string,
  price: number | null,
  index: number,
  source: string,
  contextOverride?: string
) {
  if (price === null || price <= 0 || price >= 1000) return;

  const context = contextOverride || getContext(fullText, index);

  if (!hasEuroPrice(context)) return;
  if (hasUsdPrice(context) && !hasEuroPrice(context)) return;
  if (isClearlyBadContext(context)) return;

  let score = 100;

  if (source.includes('corePrice_feature_div')) score += 600;
  if (source.includes('corePriceDisplay_desktop_feature_div')) score += 500;
  if (source.includes('priceToPay')) score += 450;
  if (source.includes('apex_desktop')) score += 350;

  candidates.push({
    price,
    index,
    score,
    context,
    source,
    kind: 'core-price'
  });
}

function extractOfferListingCandidates(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  const patterns = [
    {
      source: 'other-sellers-new-used-from-euro-prefix',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?|Andere Verkaeufer(?:\s+bei\s+Amazon)?)[\s\S]{0,2200}?(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,500}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'other-sellers-new-used-from-euro-after',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?|Andere Verkaeufer(?:\s+bei\s+Amazon)?)[\s\S]{0,2200}?(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,500}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'new-used-from-euro-prefix',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)\s*\(\d+\)[\s\S]{0,500}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'new-used-from-euro-after',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)\s*\(\d+\)[\s\S]{0,500}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'offer-listing-link-from-euro-prefix',
      pattern:
        /gp\/offer-listing\/[A-Z0-9]{10}[\s\S]{0,1400}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'generic-from-euro-with-new-used',
      pattern:
        /(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))[\s\S]{0,700}?(?:delivery|livraison|consegna|versand)/gi
    }
  ];

  for (const item of patterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const raw = match[1] || '';
      const price = parseEuroPrice(`€${raw}`);
      const context = getContext(normalized, match.index, 900, 900);

      addOfferCandidate(
        candidates,
        normalized,
        price,
        match.index,
        `${sourcePrefix}:${item.source}`,
        context
      );

      match = item.pattern.exec(normalized);
    }
  }

  return candidates;
}

function extractCorePriceCandidatesFromHtml(
  html: string,
  sourcePrefix: string
): PriceCandidate[] {
  const $ = cheerio.load(html);
  const normalizedHtml = html.replace(/\u00a0/g, ' ');
  const pageText = $.root().text().replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  const selectors = [
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '.priceToPay .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '[data-a-color="price"] .a-offscreen'
  ];

  for (const selector of selectors) {
    const nodes = $(selector).toArray().slice(0, 12);

    for (const node of nodes) {
      const element = $(node);
      const raw =
        element.attr('content') ||
        element.attr('value') ||
        element.text() ||
        '';

      const price = parseEuroPrice(raw);

      if (price !== null) {
        const localContext =
          element
            .closest(
              '#corePrice_feature_div, #corePriceDisplay_desktop_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
            )
            .text() || raw;

        const htmlIndex = normalizedHtml.indexOf(raw);

        addCoreCandidate(
          candidates,
          pageText,
          price,
          htmlIndex >= 0 ? htmlIndex : 0,
          `${sourcePrefix}:core-price:${selector}`,
          `${localContext} ${pageText.slice(0, 5000)}`
        );
      }
    }
  }

  $('.a-price').each((index, node) => {
    const element = $(node);
    const whole = cleanText(element.find('.a-price-whole').first().text());
    const fraction = cleanText(
      element.find('.a-price-fraction').first().text()
    );

    if (!whole || !fraction) return;

    const raw = `${whole},${fraction}`;
    const price = parseEuroPrice(`${raw} €`);

    if (price !== null) {
      const localContext =
        element
          .closest(
            '#corePrice_feature_div, #corePriceDisplay_desktop_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
          )
          .text() || element.text();

      addCoreCandidate(
        candidates,
        pageText,
        price,
        index,
        `${sourcePrefix}:core-price-split`,
        `${localContext} ${pageText.slice(0, 5000)}`
      );
    }
  });

  return candidates;
}

function extractCandidatesFromAmazonHtml(
  html: string,
  sourcePrefix: string
): PriceCandidate[] {
  const pageText = cheerio.load(html).root().text().replace(/\u00a0/g, ' ');

  return [
    ...extractOfferListingCandidates(pageText, sourcePrefix),
    ...extractCorePriceCandidatesFromHtml(html, sourcePrefix)
  ];
}

function extractCandidatesFromAmazonText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');

  return extractOfferListingCandidates(normalized, sourcePrefix);
}

function chooseBestCandidate(
  candidates: PriceCandidate[]
): PriceCandidate | null {
  const offerCandidates = candidates
    .filter((candidate) => candidate.kind === 'offer-listing')
    .filter((candidate) => {
      if (candidate.price <= 0) return false;
      if (candidate.price >= 1000) return false;
      if (!hasEuroPrice(candidate.context)) return false;
      if (!isOfferListingContext(candidate.context)) return false;
      if (isClearlyBadContext(candidate.context)) return false;

      return true;
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (offerCandidates[0]) {
    return offerCandidates[0];
  }

  const coreCandidates = candidates
    .filter((candidate) => candidate.kind === 'core-price')
    .filter((candidate) => {
      if (candidate.price <= 0) return false;
      if (candidate.price >= 1000) return false;
      if (!hasEuroPrice(candidate.context)) return false;
      if (hasUsdPrice(candidate.context) && !hasEuroPrice(candidate.context)) {
        return false;
      }
      if (isClearlyBadContext(candidate.context)) return false;

      return true;
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return coreCandidates[0] || null;
}

function applyMarketplaceVatIfNeeded(
  candidate: PriceCandidate,
  marketplace: AmazonMarketplace,
  pageContext: string
): {
  price: number;
  vatApplied: boolean;
} {
  if (candidate.kind === 'offer-listing') {
    return {
      price: candidate.price,
      vatApplied: false
    };
  }

  const combinedContext = `${candidate.context} ${pageContext}`;

  if (!looksVatExcluded(combinedContext)) {
    return {
      price: candidate.price,
      vatApplied: false
    };
  }

  return {
    price: addVat(candidate.price, marketplace),
    vatApplied: true
  };
}

function getCorePriceTexts($: cheerio.CheerioAPI): string[] {
  const selectors = [
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '.priceToPay .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '[data-a-color="price"] .a-offscreen'
  ];

  const values: string[] = [];

  for (const selector of selectors) {
    $(selector)
      .toArray()
      .slice(0, 8)
      .forEach((node) => {
        const element = $(node);
        const raw =
          element.attr('content') ||
          element.attr('value') ||
          element.text() ||
          '';

        const cleaned = cleanText(raw);

        if (cleaned) {
          values.push(`${selector} => ${cleaned}`);
        }
      });
  }

  return values;
}

function extractAllEuroPricesWithContext(text: string): string[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const priceRegex = /€\s*(\d{1,5}(?:[.,]\d{2}))|(\d{1,5}(?:[.,]\d{2}))\s*€/gi;
  const results: string[] = [];

  let match = priceRegex.exec(normalized);

  while (match !== null && results.length < 20) {
    const raw = match[1] || match[2] || '';
    const price = parseEuroPrice(`€${raw}`);
    const context = cleanContext(
      getContext(normalized, match.index, 220, 300),
      620
    );

    results.push(
      `${results.length + 1}) prezzo=${price ?? raw} | contesto=${context}`
    );

    match = priceRegex.exec(normalized);
  }

  return results;
}

function findKeywordSnippets(text: string): string[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const lower = normalized.toLowerCase();

  const keywords = [
    'other sellers on amazon',
    'new & used',
    'new and used',
    'altri venditori',
    'nuovo e usato',
    'nuovi e usati',
    'autres vendeurs',
    'neuf et occasion',
    'andere verkäufer',
    'neu und gebraucht',
    'offer-listing',
    'from€',
    'from €',
    'da€',
    'da €',
    'à partir de',
    'ab€',
    'depending on your delivery address',
    'vat may vary',
    'iva può variare',
    'united states',
    'stati uniti',
    'états-unis',
    'vereinigte staaten',
    'usd',
    '€'
  ];

  const snippets: string[] = [];

  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());

    if (index >= 0) {
      snippets.push(
        `${keyword}: ${cleanContext(getContext(normalized, index, 320, 620), 950)}`
      );
    }

    if (snippets.length >= 18) break;
  }

  return snippets;
}

function buildDebugSource(input: {
  marketplace: AmazonMarketplace;
  asin: string;
  url: string;
  direct: FetchResult;
  reader?: FetchResult | null;
  search?: FetchResult | null;
  directText?: string | null;
  readerText?: string | null;
  searchText?: string | null;
  candidates?: PriceCandidate[];
}) {
  const directText = input.directText || '';
  const readerText = input.readerText || '';
  const searchText = input.searchText || '';

  let corePrices: string[] = [];

  if (directText) {
    const $ = cheerio.load(directText);
    corePrices = getCorePriceTexts($);
  }

  const directPlainText = directText
    ? cleanContext(cheerio.load(directText).root().text(), 14000)
    : '';

  const readerPlainText = readerText ? cleanContext(readerText, 14000) : '';
  const searchPlainText = searchText ? cleanContext(searchText, 14000) : '';

  const directKeywordSnippets = findKeywordSnippets(directPlainText);
  const readerKeywordSnippets = findKeywordSnippets(readerPlainText);
  const searchKeywordSnippets = findKeywordSnippets(searchPlainText);

  const directPrices = extractAllEuroPricesWithContext(directPlainText);
  const readerPrices = extractAllEuroPricesWithContext(readerPlainText);
  const searchPrices = extractAllEuroPricesWithContext(searchPlainText);

  const candidates = (input.candidates || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 28)
    .map(
      (candidate, index) =>
        `${index + 1}) kind=${candidate.kind} price=${candidate.price} score=${candidate.score} source=${candidate.source} context=${cleanContext(candidate.context, 1000)}`
    );

  return [
    `AMAZON_DEBUG marketplace=${input.marketplace} asin=${input.asin}`,
    `url=${input.url}`,
    `direct=${input.direct.status} ${input.direct.statusText} ok=${input.direct.ok} textLength=${directText.length}`,
    `reader=${input.reader ? `${input.reader.status} ${input.reader.statusText} ok=${input.reader.ok} textLength=${readerText.length}` : 'not-run'}`,
    `search=${input.search ? `${input.search.status} ${input.search.statusText} ok=${input.search.ok} textLength=${searchText.length}` : 'not-run'}`,
    `corePriceTexts=${corePrices.length > 0 ? corePrices.join(' || ') : '-'}`,
    `candidates=${candidates.length > 0 ? candidates.join(' || ') : '-'}`,
    `directKeywordSnippets=${directKeywordSnippets.length > 0 ? directKeywordSnippets.join(' || ') : '-'}`,
    `readerKeywordSnippets=${readerKeywordSnippets.length > 0 ? readerKeywordSnippets.join(' || ') : '-'}`,
    `searchKeywordSnippets=${searchKeywordSnippets.length > 0 ? searchKeywordSnippets.join(' || ') : '-'}`,
    `directPrices=${directPrices.length > 0 ? directPrices.join(' || ') : '-'}`,
    `readerPrices=${readerPrices.length > 0 ? readerPrices.join(' || ') : '-'}`,
    `searchPrices=${searchPrices.length > 0 ? searchPrices.join(' || ') : '-'}`
  ].join(' | ');
}

async function fetchText(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
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

async function fetchJinaReader(url: string): Promise<FetchResult> {
  const response = await fetch(buildJinaReaderUrl(url), {
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

async function fetchJinaSearch(url: string): Promise<FetchResult> {
  const response = await fetch(buildJinaSearchUrl(url), {
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

export async function scrapeAmazonPrice(
  asin: string,
  marketplace: AmazonMarketplace
): Promise<ScrapeResult & { url: string; marketplace: AmazonMarketplace }> {
  const cleanedAsin = asin.trim().toUpperCase();
  const url = buildAmazonUrl(cleanedAsin, marketplace);

  try {
    const direct = await fetchText(url);
    let reader: FetchResult | null = null;
    let search: FetchResult | null = null;

    let allCandidates: PriceCandidate[] = [];

    if (direct.ok && direct.text) {
      allCandidates = [
        ...allCandidates,
        ...extractCandidatesFromAmazonHtml(direct.text, 'direct')
      ];
    }

    reader = await fetchJinaReader(url);

    if (reader.ok && reader.text) {
      allCandidates = [
        ...allCandidates,
        ...extractCandidatesFromAmazonText(reader.text, 'reader')
      ];
    }

    search = await fetchJinaSearch(url);

    if (search.ok && search.text) {
      allCandidates = [
        ...allCandidates,
        ...extractCandidatesFromAmazonText(search.text, 'search')
      ];
    }

    const best = chooseBestCandidate(allCandidates);
    const pageContext = `${direct.text || ''} ${reader?.text || ''}`;

    if (best) {
      const normalized = applyMarketplaceVatIfNeeded(
        best,
        marketplace,
        pageContext
      );

      return {
        price: normalized.price,
        source: `${marketplace}:${best.source} kind=${best.kind} score=${best.score} vatApplied=${normalized.vatApplied ? 'yes' : 'no'} rawPrice=${best.price} finalPrice=${normalized.price} | contesto: ${cleanContext(
          best.context
        )}`,
        error: null,
        url,
        marketplace
      };
    }

    return {
      price: null,
      source: buildDebugSource({
        marketplace,
        asin: cleanedAsin,
        url,
        direct,
        reader,
        search,
        directText: direct.text,
        readerText: reader?.text || null,
        searchText: search?.text || null,
        candidates: allCandidates
      }),
      error: null,
      url,
      marketplace
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante scraping Amazon';

    return {
      price: null,
      source: `${marketplace}:amazon-exception`,
      error: message,
      url,
      marketplace
    };
  }
}

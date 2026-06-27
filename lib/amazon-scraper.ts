import * as cheerio from 'cheerio';
import { normalizePrice, type ScrapeResult } from '@/lib/scraper';

export type AmazonMarketplace = 'FR' | 'DE' | 'IT';

const AMAZON_DOMAINS: Record<AmazonMarketplace, string> = {
  FR: 'amazon.fr',
  DE: 'amazon.de',
  IT: 'amazon.it'
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

type PriceCandidate = {
  price: number;
  index: number;
  score: number;
  context: string;
  source: string;
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

function cleanContext(value: string, maxLength = 1200): string {
  return cleanText(value).slice(0, maxLength);
}

function buildJinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

function buildJinaSearchUrl(url: string): string {
  return `https://s.jina.ai/?q=${encodeURIComponent(url)}`;
}

function getContext(text: string, index: number, before = 500, after = 700) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function hasUsdPrice(text: string): boolean {
  return /\bUSD\b|\$\s*\d{1,5}(?:[.,]\d{2})|\d{1,5}(?:[.,]\d{2})\s*USD/i.test(
    text
  );
}

function hasEuroPrice(text: string): boolean {
  return /€\s*\d{1,5}(?:[.,]\d{2})|\d{1,5}(?:[.,]\d{2})\s*€/i.test(text);
}

function parseEuroPrice(raw: string): number | null {
  if (!hasEuroPrice(raw)) return null;

  return normalizePrice(raw);
}

function isDeliveryContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'consegna a',
    'consegna prevista',
    'costo di consegna',
    'costi di consegna',
    'spese di spedizione',
    'delivery',
    'delivery fee',
    'shipping',
    'shipping fee',
    'livraison',
    'frais de livraison',
    'livraison à',
    'versand',
    'versandkosten',
    'lieferung',
    'lieferkosten',
    'zustellung'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function isBadSectionContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'spesso comprati insieme',
    'questo articolo:',
    'i clienti che hanno visto',
    'frequently bought together',
    'this item:',
    'customers who viewed',
    'fréquemment achetés ensemble',
    'cet article:',
    'les clients ayant consulté',
    'wird oft zusammen gekauft',
    'dieser artikel:',
    'kunden, die diesen artikel angesehen'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function isOfferListingContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'other sellers on amazon',
    'new & used',
    'new and used',
    'new (',
    'used (',
    'from€',
    'from €',

    'altri venditori',
    'nuovo e usato',
    'nuovi e usati',
    'nuovo (',
    'usato (',
    'da€',
    'da €',

    'autres vendeurs',
    'neuf et occasion',
    'neuf & occasion',
    'neuf (',
    'occasion (',
    'à partir de€',
    'à partir de €',

    'andere verkäufer',
    'andere verkaeufer',
    'neu und gebraucht',
    'neu & gebraucht',
    'neu (',
    'gebraucht (',
    'ab€',
    'ab €'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function isCoreProductPriceContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'amazon choice',
    "amazon's choice",
    'lowest price in last 30 days',
    'was:',
    'free returns',
    'retours gratuits',
    'retournez cet article gratuitement',
    'return this item for free',
    'the prices of products sold on amazon include vat',
    'prices for items sold by amazon include vat',
    'i prezzi dei prodotti venduti su amazon',
    'produits vendus par amazon'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function addCandidate(
  candidates: PriceCandidate[],
  fullText: string,
  price: number | null,
  index: number,
  source: string,
  contextOverride?: string
) {
  if (price === null || price <= 0 || price >= 1000) return;

  const context = contextOverride || getContext(fullText, index);

  if (hasUsdPrice(context) && !hasEuroPrice(context)) return;

  let score = 10;

  /*
    Priorità massima: il prezzo “Other sellers / New & Used from”.
    È quello che dai debug reali vuoi usare per Amazon.
  */
  if (source.includes('offer-listing')) score += 5000;

  /*
    Reader spesso espone meglio “New & Used from”.
  */
  if (source.includes('reader')) score += 700;
  if (source.includes('direct')) score += 300;

  /*
    Il core price è un fallback basso, non deve battere offer-listing.
  */
  if (source.includes('core-price')) score += 50;

  if (isOfferListingContext(context)) score += 2500;
  if (isCoreProductPriceContext(context)) score += 100;

  /*
    La delivery può comparire nello stesso blocco “from €9 + delivery”.
    Non scartiamo subito se il blocco è offer-listing, ma abbassiamo solo
    i core price vicini a delivery.
  */
  if (isDeliveryContext(context) && !source.includes('offer-listing')) {
    score -= 1400;
  }

  if (isBadSectionContext(context)) score -= 900;

  candidates.push({
    price,
    index,
    score,
    context,
    source
  });
}

function extractOfferListingCandidates(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  /*
    Pattern specifici per quello che Vercel/Jina restituisce davvero:

    FR/IT debug:
    Other sellers on Amazon * * * [New & Used (11) from€9.00€9.00+ €10.56 delivery]
    Other sellers on Amazon * * * [New & Used (12) from€8.99€8.99+ €11.66 delivery]
  */
  const patterns = [
    {
      source: 'offer-listing-other-sellers-new-used-from-euro-prefix',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?)[\s\S]{0,1400}?(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,280}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'offer-listing-other-sellers-new-used-euro-after',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?)[\s\S]{0,1400}?(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,280}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'offer-listing-new-used-from-euro-prefix',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)\s*\(\d+\)[\s\S]{0,260}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'offer-listing-new-used-from-euro-after',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)\s*\(\d+\)[\s\S]{0,260}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'offer-listing-link-near-price',
      pattern:
        /gp\/offer-listing\/[A-Z0-9]{10}[\s\S]{0,700}?(?:from|da|à partir de|ab)?\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    }
  ];

  for (const item of patterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const raw = match[1] || '';
      const price = parseEuroPrice(`€${raw}`);
      const context = getContext(normalized, match.index, 320, 520);

      addCandidate(
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
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.priceToPay .a-offscreen',
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
              '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
            )
            .text() || raw;

        const htmlIndex = normalizedHtml.indexOf(raw);

        addCandidate(
          candidates,
          pageText,
          price,
          htmlIndex >= 0 ? htmlIndex : 0,
          `${sourcePrefix}:core-price:${selector}`,
          localContext
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
            '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
          )
          .text() || element.text();

      addCandidate(
        candidates,
        pageText,
        price,
        index,
        `${sourcePrefix}:core-price-split`,
        localContext
      );
    }
  });

  return candidates;
}

function extractCorePriceCandidatesFromText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  const patterns = [
    {
      source: 'core-amazon-choice-price-after',
      pattern:
        /Amazon'?s?\s+Choice[\s\S]{0,520}?€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'core-amazon-choice-price-before',
      pattern:
        /€\s*(\d{1,5}(?:[.,]\d{2}))[\s\S]{0,520}?Amazon'?s?\s+Choice/gi
    },
    {
      source: 'core-price-near-vat',
      pattern:
        /€\s*(\d{1,5}(?:[.,]\d{2}))[\s\S]{0,700}?(?:prices of products sold on Amazon include VAT|prodotti venduti su Amazon|produits vendus par Amazon)/gi
    }
  ];

  for (const item of patterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const price = parseEuroPrice(`€${match[1] || ''}`);
      const context = getContext(normalized, match.index, 260, 520);

      addCandidate(
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

function extractCandidatesFromAmazonHtml(
  html: string,
  sourcePrefix: string
): PriceCandidate[] {
  const pageText = cheerio.load(html).root().text().replace(/\u00a0/g, ' ');

  return [
    ...extractOfferListingCandidates(pageText, sourcePrefix),
    ...extractCorePriceCandidatesFromHtml(html, sourcePrefix),
    ...extractCorePriceCandidatesFromText(pageText, sourcePrefix)
  ];
}

function extractCandidatesFromAmazonText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');

  return [
    ...extractOfferListingCandidates(normalized, sourcePrefix),
    ...extractCorePriceCandidatesFromText(normalized, sourcePrefix)
  ];
}

function chooseBestCandidate(
  candidates: PriceCandidate[]
): PriceCandidate | null {
  const valid = candidates
    .filter((candidate) => {
      if (candidate.price <= 0) return false;
      if (candidate.price >= 1000) return false;
      if (hasUsdPrice(candidate.context) && !hasEuroPrice(candidate.context)) {
        return false;
      }

      return candidate.score > -200;
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return valid[0] || null;
}

function getCorePriceTexts($: cheerio.CheerioAPI): string[] {
  const selectors = [
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.priceToPay .a-offscreen',
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
      getContext(normalized, match.index, 180, 260),
      520
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
    'amazon choice',
    "amazon's choice",
    'sold by',
    'venduto',
    'vendeur',
    'verkauf',
    'usd',
    '€'
  ];

  const snippets: string[] = [];

  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());

    if (index >= 0) {
      snippets.push(
        `${keyword}: ${cleanContext(getContext(normalized, index, 260, 480), 800)}`
      );
    }

    if (snippets.length >= 14) break;
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
    ? cleanContext(cheerio.load(directText).root().text(), 9000)
    : '';

  const readerPlainText = readerText ? cleanContext(readerText, 9000) : '';
  const searchPlainText = searchText ? cleanContext(searchText, 9000) : '';

  const directKeywordSnippets = findKeywordSnippets(directPlainText);
  const readerKeywordSnippets = findKeywordSnippets(readerPlainText);
  const searchKeywordSnippets = findKeywordSnippets(searchPlainText);

  const directPrices = extractAllEuroPricesWithContext(directPlainText);
  const readerPrices = extractAllEuroPricesWithContext(readerPlainText);
  const searchPrices = extractAllEuroPricesWithContext(searchPlainText);

  const candidates = (input.candidates || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(
      (candidate, index) =>
        `${index + 1}) price=${candidate.price} score=${candidate.score} source=${candidate.source} context=${cleanContext(candidate.context, 700)}`
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

    /*
      Importante:
      Non ritorniamo subito il direct core price.
      Prima leggiamo anche Jina Reader, perché lì Amazon espone spesso
      il blocco “Other sellers / New & Used from” che vogliamo preferire.
    */
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

    if (best) {
      return {
        price: best.price,
        source: `${marketplace}:${best.source} score=${best.score} | contesto: ${cleanContext(
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

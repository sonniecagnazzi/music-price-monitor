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

type FetchResult = {
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
};

type PriceCandidate = {
  price: number;
  rawPrice: number;
  source: string;
  context: string;
  index: number;
  kind: 'offer' | 'core';
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

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function withVat(price: number, marketplace: AmazonMarketplace): number {
  return roundPrice(price * (1 + AMAZON_VAT_RATES[marketplace]));
}

function getContext(text: string, index: number, before = 850, after = 950) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

function parseEuroPrice(raw: string): number | null {
  if (!raw.includes('€')) return null;

  return normalizePrice(raw);
}

function hasUsd(text: string): boolean {
  return /\bUSD\b|\$\s*\d{1,5}(?:[.,]\d{2})|\d{1,5}(?:[.,]\d{2})\s*USD/i.test(
    text
  );
}

function hasEuro(text: string): boolean {
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
    lower.includes('depending on your delivery address') ||
    lower.includes('vat may vary') ||
    lower.includes('iva può variare') ||
    lower.includes('iva puo variare') ||
    lower.includes('tva peut varier')
  );
}

function looksLikeBadProductSection(text: string): boolean {
  const lower = cleanText(text).toLowerCase();

  return (
    lower.includes('frequently bought together') ||
    lower.includes('spesso comprati insieme') ||
    lower.includes('fréquemment achetés ensemble') ||
    lower.includes('wird oft zusammen gekauft') ||
    lower.includes('amazon music unlimited') ||
    lower.includes('prime video') ||
    lower.includes('kindle') ||
    lower.includes('audible')
  );
}

function isOfferContext(text: string): boolean {
  const lower = cleanText(text).toLowerCase();

  return (
    lower.includes('new & used') ||
    lower.includes('new and used') ||
    lower.includes('other sellers on amazon') ||
    lower.includes('nuovo e usato') ||
    lower.includes('nuovi e usati') ||
    lower.includes('altri venditori') ||
    lower.includes('neuf et occasion') ||
    lower.includes('neuf & occasion') ||
    lower.includes('autres vendeurs') ||
    lower.includes('neu und gebraucht') ||
    lower.includes('neu & gebraucht') ||
    lower.includes('andere verkäufer') ||
    lower.includes('andere verkaeufer') ||
    lower.includes('offer-listing')
  );
}

function extractOfferCandidatesFromText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = normalizeText(text);
  const candidates: PriceCandidate[] = [];

  const patterns = [
    {
      source: 'new-used-from-euro-prefix',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,900}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'new-used-from-euro-after',
      pattern:
        /(?:New\s*&\s*Used|New\s+and\s+Used|Nuovo\s+e\s+usato|Nuovi\s+e\s+usati|Neuf\s+et\s+occasion|Neuf\s*&\s*occasion|Neu\s+und\s+gebraucht|Neu\s*&\s*Gebraucht)[\s\S]{0,900}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'other-sellers-from-euro-prefix',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?|Andere Verkaeufer(?:\s+bei\s+Amazon)?)[\s\S]{0,2600}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'other-sellers-from-euro-after',
      pattern:
        /(?:Other sellers on Amazon|Altri venditori(?:\s+su\s+Amazon)?|Autres vendeurs(?:\s+sur\s+Amazon)?|Andere Verkäufer(?:\s+bei\s+Amazon)?|Andere Verkaeufer(?:\s+bei\s+Amazon)?)[\s\S]{0,2600}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'offer-listing-link-from-euro-prefix',
      pattern:
        /gp\/offer-listing\/[A-Z0-9]{10}[\s\S]{0,1800}?(?:from|da|à partir de|ab)\s*€\s*(\d{1,5}(?:[.,]\d{2}))/gi
    },
    {
      source: 'offer-listing-link-from-euro-after',
      pattern:
        /gp\/offer-listing\/[A-Z0-9]{10}[\s\S]{0,1800}?(?:from|da|à partir de|ab)\s*(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    }
  ];

  for (const item of patterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const raw = match[1] || '';
      const parsed = parseEuroPrice(`€${raw}`);
      const context = getContext(normalized, match.index, 1000, 1000);

      if (
        parsed !== null &&
        parsed > 0 &&
        parsed < 1000 &&
        hasEuro(context) &&
        !hasUsd(context) &&
        isOfferContext(context) &&
        !looksLikeBadProductSection(context)
      ) {
        candidates.push({
          price: parsed,
          rawPrice: parsed,
          source: `${sourcePrefix}:${item.source}`,
          context,
          index: match.index,
          kind: 'offer'
        });
      }

      match = item.pattern.exec(normalized);
    }
  }

  return candidates;
}

function extractCoreCandidatesFromHtml(
  html: string,
  sourcePrefix: string
): PriceCandidate[] {
  const $ = cheerio.load(html);
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
    const nodes = $(selector).toArray().slice(0, 20);

    for (const node of nodes) {
      const element = $(node);
      const raw =
        element.attr('content') ||
        element.attr('value') ||
        element.text() ||
        '';

      const parsed = parseEuroPrice(raw);

      if (parsed === null || parsed <= 0 || parsed >= 1000) continue;

      const context =
        element
          .closest(
            '#corePrice_feature_div, #corePriceDisplay_desktop_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
          )
          .text() || raw;

      if (hasUsd(context) && !hasEuro(context)) continue;

      candidates.push({
        price: parsed,
        rawPrice: parsed,
        source: `${sourcePrefix}:core:${selector}`,
        context: `${context} ${pageText.slice(0, 8000)}`,
        index: pageText.indexOf(raw),
        kind: 'core'
      });
    }
  }

  $(
    '#corePrice_feature_div .a-price, #corePriceDisplay_desktop_feature_div .a-price, .priceToPay .a-price, #apex_desktop .a-price'
  ).each((index, node) => {
    const element = $(node);
    const whole = cleanText(element.find('.a-price-whole').first().text());
    const fraction = cleanText(
      element.find('.a-price-fraction').first().text()
    );

    if (!whole || !fraction) return;

    const raw = `${whole},${fraction} €`;
    const parsed = parseEuroPrice(raw);

    if (parsed === null || parsed <= 0 || parsed >= 1000) return;

    const context =
      element
        .closest(
          '#corePrice_feature_div, #corePriceDisplay_desktop_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
        )
        .text() || element.text();

    if (hasUsd(context) && !hasEuro(context)) return;

    candidates.push({
      price: parsed,
      rawPrice: parsed,
      source: `${sourcePrefix}:core-split`,
      context: `${context} ${pageText.slice(0, 8000)}`,
      index,
      kind: 'core'
    });
  });

  return candidates;
}

function chooseBestOffer(candidates: PriceCandidate[]): PriceCandidate | null {
  const offers = candidates
    .filter((candidate) => candidate.kind === 'offer')
    .sort((a, b) => a.price - b.price || a.index - b.index);

  return offers[0] || null;
}

function chooseBestCore(
  candidates: PriceCandidate[],
  marketplace: AmazonMarketplace
): PriceCandidate | null {
  if (marketplace === 'DE') {
    return null;
  }

  const cores = candidates
    .filter((candidate) => candidate.kind === 'core')
    .filter((candidate) => {
      /*
        Regola anti-falsi positivi:
        core price sotto 20 € lo ignoriamo.
        Questo evita casi tipo 4,62 € su B07JBCR129.
        B0DVH4P8DB invece ha core 27/32 €, quindi passa.
      */
      if (candidate.price < 20) return false;
      if (hasUsd(candidate.context) && !hasEuro(candidate.context)) return false;

      return true;
    })
    .sort((a, b) => b.price - a.price || a.index - b.index);

  return cores[0] || null;
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
      .slice(0, 12)
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

function findKeywordSnippets(text: string): string[] {
  const normalized = normalizeText(text);
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
        `${keyword}: ${cleanContext(getContext(normalized, index, 350, 650), 1000)}`
      );
    }

    if (snippets.length >= 20) break;
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
    ? cheerio.load(directText).root().text().replace(/\u00a0/g, ' ')
    : '';

  const candidates = (input.candidates || [])
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'offer' ? -1 : 1;
      return b.price - a.price;
    })
    .slice(0, 40)
    .map(
      (candidate, index) =>
        `${index + 1}) kind=${candidate.kind} price=${candidate.price} source=${candidate.source} context=${cleanContext(candidate.context, 900)}`
    );

  return [
    `AMAZON_DEBUG marketplace=${input.marketplace} asin=${input.asin}`,
    `url=${input.url}`,
    `direct=${input.direct.status} ${input.direct.statusText} ok=${input.direct.ok} textLength=${directText.length}`,
    `reader=${input.reader ? `${input.reader.status} ${input.reader.statusText} ok=${input.reader.ok} textLength=${readerText.length}` : 'not-run'}`,
    `search=${input.search ? `${input.search.status} ${input.search.statusText} ok=${input.search.ok} textLength=${searchText.length}` : 'not-run'}`,
    `corePriceTexts=${corePrices.length > 0 ? corePrices.join(' || ') : '-'}`,
    `candidates=${candidates.length > 0 ? candidates.join(' || ') : '-'}`,
    `directKeywordSnippets=${findKeywordSnippets(directPlainText).join(' || ') || '-'}`,
    `readerKeywordSnippets=${findKeywordSnippets(readerText).join(' || ') || '-'}`,
    `searchKeywordSnippets=${findKeywordSnippets(searchText).join(' || ') || '-'}`
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

    let candidates: PriceCandidate[] = [];
    let pageContext = '';

    if (direct.ok && direct.text) {
      const directPlainText = cheerio
        .load(direct.text)
        .root()
        .text()
        .replace(/\u00a0/g, ' ');

      pageContext += directPlainText;

      candidates = [
        ...candidates,
        ...extractOfferCandidatesFromText(directPlainText, 'direct'),
        ...extractCoreCandidatesFromHtml(direct.text, 'direct')
      ];
    }

    reader = await fetchJinaReader(url);

    if (reader.ok && reader.text) {
      pageContext += ` ${reader.text}`;

      candidates = [
        ...candidates,
        ...extractOfferCandidatesFromText(reader.text, 'reader')
      ];
    }

    search = await fetchJinaSearch(url);

    if (search.ok && search.text) {
      pageContext += ` ${search.text}`;

      candidates = [
        ...candidates,
        ...extractOfferCandidatesFromText(search.text, 'search')
      ];
    }

    const offer = chooseBestOffer(candidates);

    if (offer) {
      return {
        price: offer.price,
        source: `${marketplace}:${offer.source} kind=offer rawPrice=${offer.rawPrice} finalPrice=${offer.price} vatApplied=no | contesto: ${cleanContext(
          offer.context
        )}`,
        error: null,
        url,
        marketplace
      };
    }

    const core = chooseBestCore(candidates, marketplace);

    if (core) {
      const mustAddVat = looksVatExcluded(`${core.context} ${pageContext}`);
      const finalPrice = mustAddVat
        ? withVat(core.price, marketplace)
        : core.price;

      return {
        price: finalPrice,
        source: `${marketplace}:${core.source} kind=core rawPrice=${core.rawPrice} finalPrice=${finalPrice} vatApplied=${mustAddVat ? 'yes' : 'no'} | contesto: ${cleanContext(
          core.context
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
        candidates
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

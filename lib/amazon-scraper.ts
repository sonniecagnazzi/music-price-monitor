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

function makeSource(source: string, context?: string): string {
  if (!context) return source;

  return `${source} | contesto: ${cleanContext(context)}`;
}

function buildJinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

function buildJinaSearchUrl(url: string): string {
  return `https://s.jina.ai/?q=${encodeURIComponent(url)}`;
}

function getContext(text: string, index: number, before = 600, after = 1000) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function getNearContext(text: string, index: number, before = 120, after = 160) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function compactText(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9àèéìíîòóùúäöüßçñ]+/gi, ' ');
}

function trimToRelevantAmazonArea(text: string): string {
  const normalized = text.replace(/\u00a0/g, ' ');
  const lower = normalized.toLowerCase();

  const stopMarkers = [
    'spesso comprati insieme',
    'i clienti che hanno visto',
    'prodotti correlati',
    'descrizione prodotto',
    'dettagli prodotto',
    'tracklist',

    'fréquemment achetés ensemble',
    'les clients ayant consulté',
    'description du produit',
    'détails du produit',

    'wird oft zusammen gekauft',
    'kunden, die diesen artikel angesehen',
    'produktbeschreibungen',
    'produktinformation',

    'frequently bought together',
    'customers who viewed',
    'product description',
    'product details'
  ];

  const indexes = stopMarkers
    .map((marker) => lower.indexOf(marker))
    .filter((index) => index > 0)
    .sort((a, b) => a - b);

  if (indexes.length === 0) return normalized;

  return normalized.slice(0, indexes[0]);
}

function hasAmazonSellerSignal(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const sellerPatterns = [
    /speditore\s*\/\s*venditore\s*amazon/i,
    /venditore\s*\/?\s*amazon/i,
    /venduto\s+da\s+amazon/i,
    /venduto\s+e\s+spedito\s+da\s+amazon/i,
    /venduto\s+da\s+amazon\s+eu\s+sarl/i,

    /expéditeur\s*\/\s*vendeur\s*amazon/i,
    /expediteur\s*\/\s*vendeur\s*amazon/i,
    /vendeur\s*\/?\s*amazon/i,
    /vendu\s+par\s+amazon/i,
    /vendu\s+et\s+expédié\s+par\s+amazon/i,
    /vendu\s+et\s+expedie\s+par\s+amazon/i,
    /vendu\s+par\s+amazon\s+eu\s+sarl/i,

    /verkäufer\s*\/?\s*amazon/i,
    /verkaeufer\s*\/?\s*amazon/i,
    /verkauf\s+durch\s+amazon/i,
    /verkauft\s+von\s+amazon/i,
    /verkauf\s+und\s+versand\s+durch\s+amazon/i,
    /verkauft\s+und\s+versendet\s+durch\s+amazon/i,

    /seller\s*\/?\s*amazon/i,
    /sold\s+by\s+amazon/i,
    /sold\s+and\s+shipped\s+by\s+amazon/i,
    /sold\s+and\s+dispatched\s+by\s+amazon/i
  ];

  if (sellerPatterns.some((pattern) => pattern.test(context))) {
    return true;
  }

  const compact = compactText(lower);

  return (
    compact.includes('speditore venditore amazon') ||
    compact.includes('venditore amazon') ||
    compact.includes('expediteur vendeur amazon') ||
    compact.includes('expéditeur vendeur amazon') ||
    compact.includes('vendeur amazon') ||
    compact.includes('verkäufer amazon') ||
    compact.includes('verkaeufer amazon') ||
    compact.includes('seller amazon')
  );
}

function hasAmazonShippingSignal(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  return (
    lower.includes('spedito da amazon') ||
    lower.includes('speditore amazon') ||
    lower.includes('expédié par amazon') ||
    lower.includes('expedie par amazon') ||
    lower.includes('expéditeur amazon') ||
    lower.includes('expediteur amazon') ||
    lower.includes('versand durch amazon') ||
    lower.includes('ships from amazon') ||
    lower.includes('dispatches from amazon')
  );
}

function hasOnlyShippingAmazonSignal(context: string): boolean {
  return hasAmazonShippingSignal(context) && !hasAmazonSellerSignal(context);
}

function hasNewConditionSignal(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  return (
    /\bnuovo\b/i.test(lower) ||
    /\bneuf\b/i.test(lower) ||
    /\bneu\b/i.test(lower) ||
    /\bnew\b/i.test(lower)
  );
}

function hasUsedConditionSignal(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'usato',
    'usata',
    'used',
    "d'occasion",
    'd’occasion',
    'occasion',
    'gebraucht'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function isBadSectionContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const badSignals = [
    'spesso comprati insieme',
    'questo articolo:',
    'i clienti che hanno visto',
    'autorip',
    'descrizione prodotto',
    'dettagli prodotto',

    'fréquemment achetés ensemble',
    'cet article:',
    'les clients ayant consulté',
    'description du produit',
    'détails du produit',

    'wird oft zusammen gekauft',
    'dieser artikel:',
    'kunden, die diesen artikel angesehen',
    'produktbeschreibungen',
    'produktinformation',

    'frequently bought together',
    'this item:',
    'customers who viewed',
    'product description',
    'product details'
  ];

  return badSignals.some((signal) => lower.includes(signal));
}

function isDeliveryPriceNearContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const deliverySignals = [
    'consegna a',
    'consegna prevista',
    'costo di consegna',
    'costi di consegna',
    'spese di spedizione',

    'frais de livraison',
    'livraison à',
    'livraison prévue',

    'delivery fee',
    'shipping fee',

    'versandkosten',
    'lieferkosten',
    'zustellung'
  ];

  return deliverySignals.some((signal) => lower.includes(signal));
}

function isInstallmentOrPromoNearContext(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const badSignals = [
    'mese',
    'mensile',
    'mensili',
    'par mois',
    'monat',
    'monthly',
    'rate',
    'rata',
    'finanziamento',
    'coupon',
    'prime video',
    'kindle',
    'audible',
    'gift card',
    'buono regalo',
    'carte cadeau',
    'geschenkgutschein'
  ];

  return badSignals.some((signal) => lower.includes(signal));
}

function hasUnavailableSignals(context: string): boolean {
  const lower = cleanText(context).toLowerCase();

  const signals = [
    'attualmente non disponibile',
    'non disponibile',
    'momentanément indisponible',
    'indisponible',
    'currently unavailable',
    'derzeit nicht verfügbar',
    'nicht verfügbar'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function isAcceptableSoldByAmazonCandidate(
  context: string,
  nearContext: string,
  requireNewCondition: boolean
): boolean {
  if (!hasAmazonSellerSignal(context)) return false;
  if (requireNewCondition && !hasNewConditionSignal(context)) return false;
  if (hasOnlyShippingAmazonSignal(context)) return false;
  if (hasUnavailableSignals(context)) return false;
  if (hasUsedConditionSignal(nearContext)) return false;
  if (isBadSectionContext(context)) return false;
  if (isDeliveryPriceNearContext(nearContext)) return false;
  if (isInstallmentOrPromoNearContext(nearContext)) return false;

  return true;
}

function scoreAmazonCandidate(
  price: number,
  context: string,
  nearContext: string,
  index: number,
  source: string
): number {
  let score = 0;

  if (price > 0 && price < 1000) score += 10;

  if (source.includes('buybox-container')) score += 900;
  if (source.includes('selector-coreprice')) score += 780;
  if (source.includes('selector-split-a-price')) score += 760;
  if (source.includes('main-buybox-line')) score += 700;
  if (source.includes('strict-sold-by-amazon')) score += 600;

  if (hasAmazonSellerSignal(context)) score += 700;
  if (hasAmazonShippingSignal(context)) score += 80;
  if (hasNewConditionSignal(context)) score += 120;

  if (isBadSectionContext(context)) score -= 1200;
  if (hasOnlyShippingAmazonSignal(context)) score -= 700;
  if (hasUnavailableSignals(context)) score -= 800;
  if (hasUsedConditionSignal(nearContext)) score -= 500;
  if (isDeliveryPriceNearContext(nearContext)) score -= 900;
  if (isInstallmentOrPromoNearContext(nearContext)) score -= 700;
  if (price < 2) score -= 500;

  if (index < 80000) score += 5;

  return score;
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
  const nearContext = getNearContext(fullText, index);

  const score = scoreAmazonCandidate(
    price,
    context,
    nearContext,
    index,
    source
  );

  candidates.push({
    price,
    index,
    context,
    source,
    score
  });
}

function findFirstPriceAfterCondition(block: string): {
  price: number | null;
  index: number;
} {
  const conditionRegex = /\b(Nuovo|Neuf|Neu|New)\b/i;
  const conditionMatch = conditionRegex.exec(block);

  if (!conditionMatch) {
    return {
      price: null,
      index: -1
    };
  }

  const afterCondition = block.slice(conditionMatch.index);
  const searchArea = afterCondition.slice(0, 300);
  const priceRegex = /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/i;
  const priceMatch = priceRegex.exec(searchArea);

  if (!priceMatch) {
    return {
      price: null,
      index: -1
    };
  }

  return {
    price: normalizePrice(priceMatch[1]),
    index: conditionMatch.index + priceMatch.index
  };
}

function extractStrictSoldByAmazonFromText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const relevantText = trimToRelevantAmazonArea(text.replace(/\u00a0/g, ' '));
  const candidates: PriceCandidate[] = [];

  const conditionToSellerPattern =
    /\b(?:Nuovo|Neuf|Neu|New)\b[\s\S]{0,1400}?(?:Speditore\s*\/\s*Venditore\s*Amazon|Venditore\s*Amazon|Venduto\s+da\s+Amazon|Venduto\s+e\s+spedito\s+da\s+Amazon|Expéditeur\s*\/\s*Vendeur\s*Amazon|Expediteur\s*\/\s*Vendeur\s*Amazon|Vendeur\s*Amazon|Vendu\s+par\s+Amazon|Vendu\s+et\s+expédié\s+par\s+Amazon|Verkäufer\s*Amazon|Verkaeufer\s*Amazon|Verkauf\s+durch\s+Amazon|Verkauft\s+von\s+Amazon|Seller\s*Amazon|Sold\s+by\s+Amazon)/gi;

  let blockMatch = conditionToSellerPattern.exec(relevantText);

  while (blockMatch !== null) {
    const block = blockMatch[0];
    const priceResult = findFirstPriceAfterCondition(block);

    if (priceResult.price !== null) {
      addCandidate(
        candidates,
        relevantText,
        priceResult.price,
        blockMatch.index + priceResult.index,
        `${sourcePrefix}:main-buybox-line`,
        block
      );
    }

    blockMatch = conditionToSellerPattern.exec(relevantText);
  }

  const priceRegex = /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/gi;
  let priceMatch = priceRegex.exec(relevantText);

  while (priceMatch !== null) {
    const price = normalizePrice(priceMatch[1] || '');
    const index = priceMatch.index;
    const context = getContext(relevantText, index, 360, 900);
    const nearContext = getNearContext(relevantText, index, 120, 160);

    if (isAcceptableSoldByAmazonCandidate(context, nearContext, true)) {
      addCandidate(
        candidates,
        relevantText,
        price,
        index,
        `${sourcePrefix}:strict-sold-by-amazon`,
        context
      );
    }

    priceMatch = priceRegex.exec(relevantText);
  }

  return candidates;
}

function getBuyBoxText($: cheerio.CheerioAPI): string {
  const selectors = [
    '#desktop_buybox',
    '#buybox',
    '#qualifiedBuybox',
    '#rightCol',
    '#tabular-buybox',
    '#merchant-info',
    '#apex_desktop',
    '#corePriceDisplay_desktop_feature_div',
    '#corePrice_feature_div',
    '#offerDisplayGroup_feature_div',
    '#availability',
    '#shipsFromSoldByInsideBuyBox_feature_div',
    '#sellerProfileTriggerId',
    '#sellerProfileTriggerId_feature_div',
    '#fulfillerInfoFeature_feature_div',
    '#merchantInfoFeature_feature_div',
    '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
    '#deliveryBlockMessage',
    '[data-feature-name="shipsFromSoldByInsideBuyBox"]',
    '[data-feature-name="merchantInfo"]'
  ];

  return selectors
    .map((selector) => $(selector).text())
    .filter(Boolean)
    .join(' ');
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
  const priceRegex = /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/gi;
  const results: string[] = [];

  let match = priceRegex.exec(normalized);

  while (match !== null && results.length < 18) {
    const price = normalizePrice(match[1] || '');
    const context = cleanContext(getContext(normalized, match.index, 160, 220), 430);

    results.push(
      `${results.length + 1}) prezzo=${price ?? match[1]} | contesto=${context}`
    );

    match = priceRegex.exec(normalized);
  }

  return results;
}

function findKeywordSnippets(text: string): string[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const lower = normalized.toLowerCase();

  const keywords = [
    'speditore',
    'venditore',
    'venduto',
    'amazon',
    'vendeur',
    'vendu',
    'expéditeur',
    'expediteur',
    'verkauf',
    'verkäufer',
    'seller',
    'sold by',
    'ships from',
    'nuovo',
    'neuf',
    'neu',
    'new'
  ];

  const snippets: string[] = [];

  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());

    if (index >= 0) {
      snippets.push(
        `${keyword}: ${cleanContext(getContext(normalized, index, 250, 450), 700)}`
      );
    }

    if (snippets.length >= 12) break;
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

  let buyBoxText = '';
  let corePrices: string[] = [];

  if (directText) {
    const $ = cheerio.load(directText);
    buyBoxText = cleanContext(getBuyBoxText($), 1800);
    corePrices = getCorePriceTexts($);
  }

  const directPlainText = directText
    ? cleanContext(cheerio.load(directText).root().text(), 8000)
    : '';

  const directRelevantText = trimToRelevantAmazonArea(directPlainText);
  const readerRelevantText = trimToRelevantAmazonArea(readerText);
  const searchRelevantText = trimToRelevantAmazonArea(searchText);

  const directKeywordSnippets = findKeywordSnippets(directRelevantText);
  const readerKeywordSnippets = findKeywordSnippets(readerRelevantText);
  const searchKeywordSnippets = findKeywordSnippets(searchRelevantText);

  const directPrices = extractAllEuroPricesWithContext(directRelevantText);
  const readerPrices = extractAllEuroPricesWithContext(readerRelevantText);
  const searchPrices = extractAllEuroPricesWithContext(searchRelevantText);

  const candidates = (input.candidates || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(
      (candidate, index) =>
        `${index + 1}) price=${candidate.price} score=${candidate.score} source=${candidate.source} context=${cleanContext(candidate.context, 600)}`
    );

  return [
    `AMAZON_DEBUG marketplace=${input.marketplace} asin=${input.asin}`,
    `url=${input.url}`,
    `direct=${input.direct.status} ${input.direct.statusText} ok=${input.direct.ok} textLength=${directText.length}`,
    `reader=${input.reader ? `${input.reader.status} ${input.reader.statusText} ok=${input.reader.ok} textLength=${readerText.length}` : 'not-run'}`,
    `search=${input.search ? `${input.search.status} ${input.search.statusText} ok=${input.search.ok} textLength=${searchText.length}` : 'not-run'}`,
    `direct_hasSellerSignal=${hasAmazonSellerSignal(directPlainText)}`,
    `direct_hasShippingSignal=${hasAmazonShippingSignal(directPlainText)}`,
    `buyBox_hasSellerSignal=${hasAmazonSellerSignal(buyBoxText)}`,
    `buyBox_hasShippingSignal=${hasAmazonShippingSignal(buyBoxText)}`,
    `buyBoxText=${buyBoxText || '-'}`,
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

function extractPriceFromAmazonHtml(html: string): ScrapeResult & {
  candidates: PriceCandidate[];
} {
  const $ = cheerio.load(html);
  const normalizedHtml = html.replace(/\u00a0/g, ' ');
  const pageText = $.root().text().replace(/\u00a0/g, ' ');
  const relevantPageText = trimToRelevantAmazonArea(pageText);
  const buyBoxText = getBuyBoxText($);
  const candidates: PriceCandidate[] = [];

  candidates.push(
    ...extractStrictSoldByAmazonFromText(relevantPageText, 'html-page-text')
  );

  if (
    buyBoxText &&
    hasAmazonSellerSignal(buyBoxText) &&
    !hasUnavailableSignals(buyBoxText) &&
    !isBadSectionContext(buyBoxText)
  ) {
    const buyBoxPrice = findFirstPriceAfterCondition(buyBoxText);

    if (buyBoxPrice.price !== null) {
      addCandidate(
        candidates,
        relevantPageText,
        buyBoxPrice.price,
        buyBoxPrice.index >= 0 ? buyBoxPrice.index : 0,
        'buybox-container-condition-price',
        buyBoxText
      );
    }

    const coreSelectors = [
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox',
      '.priceToPay .a-offscreen',
      '[data-a-color="price"] .a-offscreen'
    ];

    for (const selector of coreSelectors) {
      const nodes = $(selector).toArray().slice(0, 12);

      for (const node of nodes) {
        const element = $(node);
        const raw =
          element.attr('content') ||
          element.attr('value') ||
          element.text() ||
          '';

        const price = normalizePrice(raw);

        if (price !== null) {
          const localContext =
            element
              .closest(
                '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, div'
              )
              .text() || raw;

          const context = `${localContext} ${buyBoxText}`;
          const htmlIndex = normalizedHtml.indexOf(raw);

          addCandidate(
            candidates,
            relevantPageText,
            price,
            htmlIndex >= 0 ? htmlIndex : 0,
            'selector-coreprice-sold-by-amazon',
            context
          );
        }
      }
    }

    $(
      '#corePriceDisplay_desktop_feature_div .a-price, #corePrice_feature_div .a-price, #apex_desktop .a-price, .priceToPay .a-price'
    ).each((index, node) => {
      const element = $(node);
      const whole = cleanText(element.find('.a-price-whole').first().text());
      const fraction = cleanText(
        element.find('.a-price-fraction').first().text()
      );

      if (!whole || !fraction) return;

      const raw = `${whole},${fraction}`;
      const price = normalizePrice(raw);

      const localContext =
        element
          .closest(
            '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, div'
          )
          .text() || element.text();

      const context = `${localContext} ${buyBoxText}`;

      addCandidate(
        candidates,
        relevantPageText,
        price,
        index,
        'selector-split-a-price-sold-by-amazon',
        context
      );
    });
  }

  const valid = candidates
    .filter((candidate) => {
      const nearContext = getNearContext(
        relevantPageText,
        candidate.index,
        120,
        160
      );

      const requiresNew =
        candidate.source.includes('main-buybox-line') ||
        candidate.source.includes('strict-sold-by-amazon');

      return (
        candidate.score > 0 &&
        isAcceptableSoldByAmazonCandidate(
          candidate.context,
          nearContext,
          requiresNew
        )
      );
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-sold-by-amazon-price-not-visible',
      error: null,
      candidates
    };
  }

  return {
    price: best.price,
    source: makeSource(`${best.source} score=${best.score}`, best.context),
    error: null,
    candidates
  };
}

function extractPriceFromAmazonText(text: string): ScrapeResult & {
  candidates: PriceCandidate[];
} {
  const relevantText = trimToRelevantAmazonArea(text.replace(/\u00a0/g, ' '));
  const candidates = extractStrictSoldByAmazonFromText(
    relevantText,
    'reader-text'
  );

  const valid = candidates
    .filter((candidate) => {
      const nearContext = getNearContext(relevantText, candidate.index, 120, 160);

      return (
        candidate.score > 0 &&
        isAcceptableSoldByAmazonCandidate(
          candidate.context,
          nearContext,
          true
        )
      );
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-reader-sold-by-amazon-price-not-visible',
      error: null,
      candidates
    };
  }

  return {
    price: best.price,
    source: makeSource(`${best.source} score=${best.score}`, best.context),
    error: null,
    candidates
  };
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
      const result = extractPriceFromAmazonHtml(direct.text);

      allCandidates = [...allCandidates, ...result.candidates];

      if (result.price !== null) {
        return {
          ...result,
          source: `${marketplace}:direct:${result.source}`,
          url,
          marketplace
        };
      }
    }

    reader = await fetchJinaReader(url);

    if (reader.ok && reader.text) {
      const result = extractPriceFromAmazonText(reader.text);

      allCandidates = [...allCandidates, ...result.candidates];

      if (result.price !== null) {
        return {
          ...result,
          source: `${marketplace}:jina-reader:${result.source}`,
          url,
          marketplace
        };
      }
    }

    search = await fetchJinaSearch(url);

    if (search.ok && search.text) {
      const result = extractPriceFromAmazonText(search.text);

      allCandidates = [...allCandidates, ...result.candidates];

      if (result.price !== null) {
        return {
          ...result,
          source: `${marketplace}:jina-search:${result.source}`,
          url,
          marketplace
        };
      }
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
        readerText: reader.text,
        searchText: search.text,
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

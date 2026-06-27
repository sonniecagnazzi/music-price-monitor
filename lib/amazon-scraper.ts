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

export function buildAmazonUrl(
  asin: string,
  marketplace: AmazonMarketplace
): string {
  return `https://www.${AMAZON_DOMAINS[marketplace]}/dp/${asin}`;
}

function cleanContext(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 900);
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

function getContext(text: string, index: number, before = 700, after = 900) {
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

function hasAmazonSellerSignal(context: string): boolean {
  const lower = context.toLowerCase();

  const signals = [
    'venditore amazon',
    'venduto da amazon',
    'venduto e spedito da amazon',
    'venduto e spedito da amazon eu sarl',
    'venduto da amazon eu sarl',

    'vendeur amazon',
    'vendu par amazon',
    'vendu et expédié par amazon',
    'vendu par amazon eu sarl',

    'verkauf durch amazon',
    'verkauft von amazon',
    'verkauf und versand durch amazon',
    'verkauft und versendet durch amazon',
    'amazon eu s.à r.l',

    'sold by amazon',
    'sold and dispatched by amazon',
    'sold and shipped by amazon',
    'sold by amazon eu sarl'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function hasOnlyShippingAmazonSignal(context: string): boolean {
  const lower = context.toLowerCase();

  const shippingSignals = [
    'spedito da amazon',
    'expédié par amazon',
    'versand durch amazon',
    'ships from amazon',
    'dispatches from amazon'
  ];

  return (
    shippingSignals.some((signal) => lower.includes(signal)) &&
    !hasAmazonSellerSignal(context)
  );
}

function isDeliveryPriceContext(context: string): boolean {
  const lower = context.toLowerCase();

  const deliverySignals = [
    'consegna a',
    'consegna prevista',
    'costo di consegna',
    'costi di consegna',
    'spedizione',
    'spese di spedizione',

    'livraison',
    'frais de livraison',
    'livré',
    'livré entre',
    'expédition',

    'delivery',
    'shipping',
    'delivery fee',
    'shipping fee',

    'versand',
    'lieferung',
    'versandkosten',
    'zustellung'
  ];

  return deliverySignals.some((signal) => lower.includes(signal));
}

function isInstallmentOrPromoContext(context: string): boolean {
  const lower = context.toLowerCase();

  const badSignals = [
    'mese',
    'mensile',
    'mensili',
    'mensual',
    'par mois',
    'monat',
    'monthly',
    'rate',
    'rata',
    'finanziamento',
    'coupon',
    'risparmia',
    'save',
    'économisez',
    'sparen',
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
  const lower = context.toLowerCase();

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

function hasNewConditionSignal(context: string): boolean {
  const lower = context.toLowerCase();

  const signals = ['nuovo', 'neuf', 'neu', 'new'];

  return signals.some((signal) => lower.includes(signal));
}

function hasUsedConditionSignal(context: string): boolean {
  const lower = context.toLowerCase();

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

function isProbablyWrongAmazonPriceContext(
  context: string,
  nearContext: string
): boolean {
  if (hasUnavailableSignals(context)) return true;
  if (isInstallmentOrPromoContext(nearContext)) return true;
  if (hasUsedConditionSignal(nearContext)) return true;

  /*
    Se il prezzo è proprio nel pezzetto "Consegna a 11,51 €",
    lo scartiamo sempre.
    Il prezzo prodotto può avere consegna nel contesto più ampio,
    ma non nel contesto vicino al prezzo.
  */
  if (isDeliveryPriceContext(nearContext)) return true;

  return false;
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

  if (source.includes('strict-text-buybox')) score += 500;
  if (source.includes('strict-html-buybox')) score += 450;
  if (source.includes('selector-coreprice')) score += 260;
  if (source.includes('selector-split-a-price')) score += 220;

  if (hasAmazonSellerSignal(context)) score += 400;
  if (hasOnlyShippingAmazonSignal(context)) score -= 250;

  if (hasNewConditionSignal(context)) score += 120;

  if (source.includes('json')) score += 40;

  if (isProbablyWrongAmazonPriceContext(context, nearContext)) score -= 800;

  if (hasUsedConditionSignal(context)) score -= 120;
  if (price < 2) score -= 300;

  if (index < 100000) score += 5;

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

function firstPriceAfterCondition(block: string): {
  price: number | null;
  raw: string | null;
  index: number;
} {
  const conditionRegex = /(Nuovo|Neuf|Neu|New)/i;
  const conditionMatch = conditionRegex.exec(block);

  if (!conditionMatch) {
    return {
      price: null,
      raw: null,
      index: -1
    };
  }

  const afterCondition = block.slice(conditionMatch.index);
  const priceRegex = /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/i;
  const priceMatch = priceRegex.exec(afterCondition);

  if (!priceMatch) {
    return {
      price: null,
      raw: null,
      index: -1
    };
  }

  return {
    price: normalizePrice(priceMatch[1]),
    raw: priceMatch[1],
    index: conditionMatch.index + priceMatch.index
  };
}

function extractStrictSoldByAmazonFromText(
  text: string,
  sourcePrefix: string
): PriceCandidate[] {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  /*
    Questa è la regola principale:
    prendiamo il primo prezzo dopo Nuovo/Neuf/Neu/New
    SOLO se nello stesso blocco c'è un segnale chiaro di venditore Amazon.
    Questo evita di prendere:
    - consegna
    - offerte usate
    - prodotti consigliati
    - bundle
    - prezzi di terzi
  */
  const blocks = [
    /(?:Nuovo|Neuf|Neu|New)[\s\S]{0,1500}?(?:Venditore\s+Amazon|Venduto\s+da\s+Amazon|Venduto\s+e\s+spedito\s+da\s+Amazon|Vendu\s+par\s+Amazon|Vendu\s+et\s+expédié\s+par\s+Amazon|Verkauf\s+durch\s+Amazon|Verkauft\s+von\s+Amazon|Verkauf\s+und\s+Versand\s+durch\s+Amazon|Verkauft\s+und\s+versendet\s+durch\s+Amazon|Sold\s+by\s+Amazon|Sold\s+and\s+shipped\s+by\s+Amazon|Sold\s+and\s+dispatched\s+by\s+Amazon)/gi,
    /(?:Venditore\s+Amazon|Venduto\s+da\s+Amazon|Venduto\s+e\s+spedito\s+da\s+Amazon|Vendu\s+par\s+Amazon|Vendu\s+et\s+expédié\s+par\s+Amazon|Verkauf\s+durch\s+Amazon|Verkauft\s+von\s+Amazon|Verkauf\s+und\s+Versand\s+durch\s+Amazon|Verkauft\s+und\s+versendet\s+durch\s+Amazon|Sold\s+by\s+Amazon|Sold\s+and\s+shipped\s+by\s+Amazon|Sold\s+and\s+dispatched\s+by\s+Amazon)[\s\S]{0,1500}?(?:Nuovo|Neuf|Neu|New)[\s\S]{0,300}?\d{1,5}(?:[.,]\d{2})\s*€/gi
  ];

  for (const pattern of blocks) {
    let match = pattern.exec(normalized);

    while (match !== null) {
      const block = match[0];
      const priceResult = firstPriceAfterCondition(block);

      if (priceResult.price !== null) {
        addCandidate(
          candidates,
          normalized,
          priceResult.price,
          match.index + priceResult.index,
          `${sourcePrefix}:strict-text-buybox`,
          block
        );
      }

      match = pattern.exec(normalized);
    }
  }

  return candidates;
}

function getAmazonOwnedBuyBoxText($: cheerio.CheerioAPI): string {
  const selectors = [
    '#desktop_buybox',
    '#buybox',
    '#qualifiedBuybox',
    '#rightCol',
    '#centerCol',
    '#apex_desktop',
    '#corePriceDisplay_desktop_feature_div',
    '#corePrice_feature_div',
    '#merchant-info',
    '#tabular-buybox'
  ];

  return selectors
    .map((selector) => $(selector).text())
    .filter(Boolean)
    .join(' ');
}

function extractPriceFromAmazonHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const normalizedHtml = html.replace(/\u00a0/g, ' ');
  const pageText = $.root().text().replace(/\u00a0/g, ' ');
  const buyBoxText = getAmazonOwnedBuyBoxText($);
  const candidates: PriceCandidate[] = [];

  /*
    Prima prova: testo pagina, regola stretta venduto da Amazon.
  */
  candidates.push(
    ...extractStrictSoldByAmazonFromText(pageText, 'html-page-text')
  );

  /*
    Seconda prova: blocco buybox HTML, sempre strettissimo.
  */
  if (hasAmazonSellerSignal(buyBoxText)) {
    const buyBoxPrice = firstPriceAfterCondition(buyBoxText);

    if (buyBoxPrice.price !== null) {
      addCandidate(
        candidates,
        pageText,
        buyBoxPrice.price,
        buyBoxPrice.index >= 0 ? buyBoxPrice.index : 0,
        'strict-html-buybox',
        buyBoxText
      );
    }
  }

  /*
    Terza prova: selector prezzo ufficiale.
    Lo accettiamo SOLO se la pagina/buybox conferma venditore Amazon.
  */
  if (hasAmazonSellerSignal(buyBoxText) && !hasUnavailableSignals(buyBoxText)) {
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
                '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
              )
              .text() || raw;

          const context = `${localContext} ${buyBoxText}`;
          const htmlIndex = normalizedHtml.indexOf(raw);

          addCandidate(
            candidates,
            pageText,
            price,
            htmlIndex >= 0 ? htmlIndex : 0,
            'selector-coreprice-sold-by-amazon',
            context
          );
        }
      }
    }

    /*
      Prezzo spezzato:
      .a-price-whole = 39
      .a-price-fraction = 90
    */
    $('#corePriceDisplay_desktop_feature_div .a-price, #corePrice_feature_div .a-price, #apex_desktop .a-price, .priceToPay .a-price')
      .each((index, node) => {
        const element = $(node);
        const whole = element.find('.a-price-whole').first().text();
        const fraction = element.find('.a-price-fraction').first().text();

        if (!whole || !fraction) return;

        const raw = `${whole},${fraction}`;
        const price = normalizePrice(raw);

        const localContext =
          element
            .closest(
              '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #desktop_buybox, #buybox, #rightCol, #centerCol, div'
            )
            .text() || element.text();

        const context = `${localContext} ${buyBoxText}`;

        addCandidate(
          candidates,
          pageText,
          price,
          index,
          'selector-split-a-price-sold-by-amazon',
          context
        );
      });
  }

  /*
    JSON fallback, ma sempre con vincolo venditore Amazon nel contesto.
  */
  const jsonPatterns = [
    {
      source: 'json-priceToPay',
      pattern:
        /"priceToPay"[\s\S]{0,900}?"amount"\s*:\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi
    },
    {
      source: 'json-buyingPrice',
      pattern:
        /"buyingPrice"[\s\S]{0,900}?"amount"\s*:\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi
    },
    {
      source: 'json-displayPrice',
      pattern:
        /"displayPrice"\s*:\s*"([^"]*?\d{1,5}(?:[.,]\d{2})\s*€)"/gi
    }
  ];

  for (const item of jsonPatterns) {
    let match = item.pattern.exec(normalizedHtml);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');
      const context = getContext(normalizedHtml, match.index, 900, 1300);

      if (hasAmazonSellerSignal(`${context} ${buyBoxText}`)) {
        addCandidate(
          candidates,
          normalizedHtml,
          price,
          match.index,
          `${item.source}-sold-by-amazon`,
          `${context} ${buyBoxText}`
        );
      }

      match = item.pattern.exec(normalizedHtml);
    }
  }

  const valid = candidates
    .filter(
      (candidate) =>
        candidate.score > 0 &&
        hasAmazonSellerSignal(candidate.context) &&
        !hasOnlyShippingAmazonSignal(candidate.context)
    )
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-no-sold-by-amazon-price',
      error: 'Prezzo Amazon venduto da Amazon non trovato.'
    };
  }

  return {
    price: best.price,
    source: makeSource(`${best.source} score=${best.score}`, best.context),
    error: null
  };
}

function extractPriceFromAmazonText(text: string): ScrapeResult {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates = extractStrictSoldByAmazonFromText(
    normalized,
    'reader-text'
  );

  const valid = candidates
    .filter(
      (candidate) =>
        candidate.score > 0 &&
        hasAmazonSellerSignal(candidate.context) &&
        !hasOnlyShippingAmazonSignal(candidate.context)
    )
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-reader-no-sold-by-amazon-price',
      error: 'Prezzo Amazon venduto da Amazon non trovato nel fallback reader.'
    };
  }

  return {
    price: best.price,
    source: makeSource(`${best.source} score=${best.score}`, best.context),
    error: null
  };
}

async function fetchText(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
}> {
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

async function fetchJinaReader(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
}> {
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

async function fetchJinaSearch(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: string | null;
}> {
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

    if (direct.ok && direct.text) {
      const result = extractPriceFromAmazonHtml(direct.text);

      if (result.price !== null) {
        return {
          ...result,
          source: `${marketplace}:direct:${result.source}`,
          url,
          marketplace
        };
      }
    }

    const reader = await fetchJinaReader(url);

    if (reader.ok && reader.text) {
      const result = extractPriceFromAmazonText(reader.text);

      if (result.price !== null) {
        return {
          ...result,
          source: `${marketplace}:jina-reader:${result.source}`,
          url,
          marketplace
        };
      }
    }

    const search = await fetchJinaSearch(url);

    if (search.ok && search.text) {
      const result = extractPriceFromAmazonText(search.text);

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
      source: `${marketplace}:amazon-sold-by-amazon-not-found`,
      error: `Amazon ${marketplace}: nessuna offerta venduta da Amazon trovata. Diretto ${direct.status} ${direct.statusText}.`,
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

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
  return value.replace(/\s+/g, ' ').trim().slice(0, 650);
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

function getContext(text: string, index: number, before = 500, after = 500) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function getNearContext(text: string, index: number, before = 80, after = 80) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after)
  );
}

function isDeliveryPriceContext(context: string) {
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
    'delivery',
    'shipping',
    'delivery fee',
    'versand',
    'lieferung',
    'versandkosten',
    'zustellung'
  ];

  return deliverySignals.some((signal) => lower.includes(signal));
}

function isInstallmentOrPromoContext(context: string) {
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

function hasBuyBoxSignals(context: string) {
  const lower = context.toLowerCase();

  const signals = [
    'nuovo',
    'new',
    'neuf',
    'neu',
    'spedito da amazon',
    'venditore amazon',
    'servizio clienti amazon',
    'ships from amazon',
    'sold by amazon',
    'dispatches from amazon',
    'seller amazon',
    'expédié par amazon',
    'vendu par amazon',
    'service client amazon',
    'versand durch amazon',
    'verkauf durch amazon',
    'kundenservice amazon',
    'amazon',
    'aggiungi al carrello',
    'acquista ora',
    'add to cart',
    'buy now',
    'ajouter au panier',
    'acheter maintenant',
    'in den warenkorb',
    'jetzt kaufen'
  ];

  return signals.some((signal) => lower.includes(signal));
}

function hasUnavailableSignals(context: string) {
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

function scoreAmazonCandidate(
  price: number,
  context: string,
  nearContext: string,
  index: number,
  source: string
) {
  const lower = context.toLowerCase();
  const nearLower = nearContext.toLowerCase();

  let score = 0;

  if (price > 0 && price < 1000) score += 10;

  if (source.includes('buybox')) score += 180;
  if (source.includes('selector')) score += 120;
  if (source.includes('json-price')) score += 40;
  if (source.includes('regex')) score += 10;

  if (nearLower.includes('nuovo')) score += 140;
  if (nearLower.includes('new')) score += 140;
  if (nearLower.includes('neuf')) score += 140;
  if (nearLower.includes('neu')) score += 140;

  if (lower.includes('spedito da amazon')) score += 120;
  if (lower.includes('venditore amazon')) score += 120;
  if (lower.includes('servizio clienti amazon')) score += 80;

  if (lower.includes('ships from amazon')) score += 120;
  if (lower.includes('sold by amazon')) score += 120;
  if (lower.includes('dispatches from amazon')) score += 120;

  if (lower.includes('expédié par amazon')) score += 120;
  if (lower.includes('vendu par amazon')) score += 120;

  if (lower.includes('versand durch amazon')) score += 120;
  if (lower.includes('verkauf durch amazon')) score += 120;

  if (lower.includes('a-price')) score += 50;
  if (lower.includes('a-offscreen')) score += 50;
  if (lower.includes('coreprice')) score += 120;
  if (lower.includes('priceblock')) score += 120;
  if (lower.includes('apex_desktop')) score += 90;

  if (lower.includes('aggiungi al carrello')) score += 60;
  if (lower.includes('acquista ora')) score += 60;
  if (lower.includes('add to cart')) score += 60;
  if (lower.includes('buy now')) score += 60;
  if (lower.includes('ajouter au panier')) score += 60;
  if (lower.includes('acheter maintenant')) score += 60;
  if (lower.includes('in den warenkorb')) score += 60;
  if (lower.includes('jetzt kaufen')) score += 60;

  if (nearLower.includes('consegna a')) score -= 260;
  if (nearLower.includes('frais de livraison')) score -= 260;
  if (nearLower.includes('delivery')) score -= 220;
  if (nearLower.includes('shipping')) score -= 220;
  if (nearLower.includes('versandkosten')) score -= 220;
  if (nearLower.includes('lieferung')) score -= 180;
  if (nearLower.includes('spedizione')) score -= 180;

  if (isDeliveryPriceContext(nearContext) && !nearLower.includes('nuovo')) {
    score -= 260;
  }

  if (isInstallmentOrPromoContext(nearContext)) score -= 180;
  if (hasUnavailableSignals(context)) score -= 250;

  if (lower.includes('usato')) score -= 60;
  if (lower.includes('used')) score -= 60;
  if (lower.includes("d'occasion")) score -= 60;
  if (lower.includes('d’occasion')) score -= 60;
  if (lower.includes('gebraucht')) score -= 60;

  if (price < 2) score -= 200;

  if (index < 80000) score += 5;

  return score;
}

function addCandidate(
  candidates: PriceCandidate[],
  text: string,
  price: number | null,
  index: number,
  source: string,
  contextOverride?: string
) {
  if (price === null || price <= 0 || price >= 1000) return;

  const context = contextOverride || getContext(text, index);
  const nearContext = getNearContext(text, index);

  candidates.push({
    price,
    index,
    context,
    source,
    score: scoreAmazonCandidate(price, context, nearContext, index, source)
  });
}

function extractPriceFromAmazonHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const text = html.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  const selectorGroups = [
    {
      source: 'selector-buybox-coreprice',
      selectors: [
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#corePrice_feature_div .a-price .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#price_inside_buybox',
        '.priceToPay .a-offscreen',
        '[data-a-color="price"] .a-offscreen'
      ]
    },
    {
      source: 'selector-general-price',
      selectors: [
        '.a-price .a-offscreen',
        '[class*="price"] .a-offscreen',
        '[id*="price"] .a-offscreen'
      ]
    }
  ];

  for (const group of selectorGroups) {
    for (const selector of group.selectors) {
      const nodes = $(selector).toArray().slice(0, 30);

      for (const node of nodes) {
        const element = $(node);
        const raw =
          element.attr('content') ||
          element.attr('value') ||
          element.text() ||
          '';

        const price = normalizePrice(raw);

        if (price !== null) {
          const container =
            element
              .closest(
                '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #buybox, #desktop_buybox, #tmmSwatches, #centerCol, div'
              )
              .text() || raw;

          const htmlIndex = text.indexOf(raw);

          addCandidate(
            candidates,
            text,
            price,
            htmlIndex >= 0 ? htmlIndex : 0,
            group.source,
            container
          );
        }
      }
    }
  }

  /*
    Caso Amazon frequente:
    prezzo spezzato in:
    .a-price-whole = 39
    .a-price-fraction = 90
  */
  $('.a-price').each((index, node) => {
    const element = $(node);
    const whole = element.find('.a-price-whole').first().text();
    const fraction = element.find('.a-price-fraction').first().text();

    if (!whole || !fraction) return;

    const raw = `${whole},${fraction}`;
    const price = normalizePrice(raw);

    const container =
      element
        .closest(
          '#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #buybox, #desktop_buybox, #centerCol, div'
        )
        .text() || element.text();

    addCandidate(candidates, text, price, index, 'selector-split-a-price', container);
  });

  const jsonPatterns = [
    {
      source: 'json-priceToPay',
      pattern: /"priceToPay"[\s\S]{0,900}?"amount"\s*:\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi
    },
    {
      source: 'json-buyingPrice',
      pattern: /"buyingPrice"[\s\S]{0,900}?"amount"\s*:\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi
    },
    {
      source: 'json-displayPrice',
      pattern: /"displayPrice"\s*:\s*"([^"]*?\d{1,5}(?:[.,]\d{2})\s*€)"/gi
    },
    {
      source: 'json-price',
      pattern: /"price"\s*:\s*"?(\d{1,5}(?:[.,]\d{2}))"?/gi
    }
  ];

  for (const item of jsonPatterns) {
    let match = item.pattern.exec(text);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');

      addCandidate(candidates, text, price, match.index, item.source);

      match = item.pattern.exec(text);
    }
  }

  const regexPatterns = [
    {
      source: 'regex-euro-decimal',
      pattern: /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'regex-new-block',
      pattern:
        /(?:Nuovo|New|Neuf|Neu)[\s\S]{0,260}?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    }
  ];

  for (const item of regexPatterns) {
    let match = item.pattern.exec(text);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');

      addCandidate(candidates, text, price, match.index, item.source);

      match = item.pattern.exec(text);
    }
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -120)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-no-price',
      error: 'Prezzo Amazon non trovato.'
    };
  }

  return {
    price: best.price,
    source: makeSource(
      `${best.source} score=${best.score}`,
      best.context
    ),
    error: null
  };
}

function extractPriceFromAmazonText(text: string): ScrapeResult {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  /*
    Prima regola forte:
    se Jina o Amazon rendono un blocco tipo:
    Nuovo
    39,90 €
    Spedito da Amazon
    Venditore Amazon
    allora quello è il prezzo giusto del buy box.
  */
  const buyBoxPatterns = [
    {
      source: 'text-buybox-it-new',
      pattern:
        /Nuovo[\s\S]{0,120}?(\d{1,5}(?:[.,]\d{2}))\s*€[\s\S]{0,650}?(?:Spedito da\s+Amazon|Venditore\s+Amazon|Servizio clienti\s+Amazon)/gi
    },
    {
      source: 'text-buybox-fr-new',
      pattern:
        /Neuf[\s\S]{0,120}?(\d{1,5}(?:[.,]\d{2}))\s*€[\s\S]{0,650}?(?:Expédié par\s+Amazon|Vendu par\s+Amazon|Service client\s+Amazon)/gi
    },
    {
      source: 'text-buybox-de-new',
      pattern:
        /Neu[\s\S]{0,120}?(\d{1,5}(?:[.,]\d{2}))\s*€[\s\S]{0,650}?(?:Versand durch\s+Amazon|Verkauf durch\s+Amazon|Kundenservice\s+Amazon)/gi
    },
    {
      source: 'text-buybox-en-new',
      pattern:
        /New[\s\S]{0,120}?(\d{1,5}(?:[.,]\d{2}))\s*€[\s\S]{0,650}?(?:Ships from\s+Amazon|Sold by\s+Amazon|Customer service\s+Amazon|Dispatches from\s+Amazon)/gi
    }
  ];

  for (const item of buyBoxPatterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');

      addCandidate(candidates, normalized, price, match.index, item.source);

      match = item.pattern.exec(normalized);
    }
  }

  const generalPatterns = [
    {
      source: 'text-priceToPay',
      pattern: /price to pay[\s\S]{0,250}?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'text-prix-a-payer',
      pattern: /prix à payer[\s\S]{0,250}?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'text-prezzo',
      pattern: /prezzo[\s\S]{0,250}?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    },
    {
      source: 'text-regex-euro',
      pattern: /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
    }
  ];

  for (const item of generalPatterns) {
    let match = item.pattern.exec(normalized);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');

      addCandidate(candidates, normalized, price, match.index, item.source);

      match = item.pattern.exec(normalized);
    }
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -120)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = valid[0];

  if (!best) {
    return {
      price: null,
      source: 'amazon-no-price',
      error: 'Prezzo Amazon non trovato.'
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
      source: `${marketplace}:amazon-all-fallbacks-failed`,
      error: `Amazon ${marketplace}: prezzo non trovato. Diretto ${direct.status} ${direct.statusText}.`,
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

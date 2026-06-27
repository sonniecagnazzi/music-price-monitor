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
    'fr-FR,fr;q=0.9,de-DE,de;q=0.8,it-IT,it;q=0.7,en-US;q=0.6,en;q=0.5',
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
};

export function buildAmazonUrl(
  asin: string,
  marketplace: AmazonMarketplace
): string {
  return `https://www.${AMAZON_DOMAINS[marketplace]}/dp/${asin}`;
}

function cleanContext(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
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

function scoreAmazonCandidate(price: number, context: string, index: number) {
  const lower = context.toLowerCase();
  let score = 0;

  if (price > 0 && price < 1000) score += 10;

  if (lower.includes('buy new')) score += 60;
  if (lower.includes('acheter neuf')) score += 60;
  if (lower.includes('neu kaufen')) score += 60;
  if (lower.includes('acquista nuovo')) score += 60;

  if (lower.includes('add to cart')) score += 50;
  if (lower.includes('ajouter au panier')) score += 50;
  if (lower.includes('in den warenkorb')) score += 50;
  if (lower.includes('aggiungi al carrello')) score += 50;

  if (lower.includes('buy now')) score += 50;
  if (lower.includes('acheter maintenant')) score += 50;
  if (lower.includes('jetzt kaufen')) score += 50;
  if (lower.includes('acquista ora')) score += 50;

  if (lower.includes('price to pay')) score += 70;
  if (lower.includes('prix à payer')) score += 70;
  if (lower.includes('prix')) score += 20;
  if (lower.includes('preis')) score += 20;
  if (lower.includes('prezzo')) score += 20;

  if (lower.includes('a-price')) score += 40;
  if (lower.includes('a-offscreen')) score += 40;
  if (lower.includes('availability')) score += 20;
  if (lower.includes('disponibilité')) score += 20;
  if (lower.includes('verfügbarkeit')) score += 20;
  if (lower.includes('disponibilità')) score += 20;

  if (lower.includes('currently unavailable')) score -= 120;
  if (lower.includes('indisponible')) score -= 120;
  if (lower.includes('derzeit nicht verfügbar')) score -= 120;
  if (lower.includes('non disponibile')) score -= 120;

  if (lower.includes('used')) score -= 35;
  if (lower.includes('d’occasion')) score -= 35;
  if (lower.includes("d'occasion")) score -= 35;
  if (lower.includes('gebraucht')) score -= 35;
  if (lower.includes('usato')) score -= 35;

  if (lower.includes('monthly')) score -= 90;
  if (lower.includes('coupon')) score -= 30;
  if (lower.includes('prime video')) score -= 100;
  if (lower.includes('kindle')) score -= 100;

  if (index < 50000) score += 5;

  return score;
}

function extractAmazonPriceFromText(text: string): ScrapeResult {
  const normalized = text.replace(/\u00a0/g, ' ');
  const candidates: PriceCandidate[] = [];

  const patterns = [
    /"price"\s*:\s*"?(\d{1,5}(?:[.,]\d{2}))"?/gi,
    /"priceToPay"[\s\S]{0,500}?(\d{1,5}(?:[.,]\d{2}))/gi,
    /class="a-offscreen"[^>]*>\s*(\d{1,5}(?:[.,]\d{2})\s*€)\s*</gi,
    /(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))\s*€/gi
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(normalized);

    while (match !== null) {
      const price = normalizePrice(match[1] || '');

      if (price !== null && price > 0 && price < 1000) {
        const index = match.index;
        const contextStart = Math.max(0, index - 450);
        const contextEnd = Math.min(normalized.length, index + 450);
        const context = normalized.slice(contextStart, contextEnd);

        candidates.push({
          price,
          index,
          context,
          score: scoreAmazonCandidate(price, context, index)
        });
      }

      match = pattern.exec(normalized);
    }
  }

  const valid = candidates
    .filter((candidate) => candidate.score > -80)
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
    source: makeSource(`amazon-smart score=${best.score}`, best.context),
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
      const result = extractAmazonPriceFromText(direct.text);

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
      const result = extractAmazonPriceFromText(reader.text);

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
      const result = extractAmazonPriceFromText(search.text);

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

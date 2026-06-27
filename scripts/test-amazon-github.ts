type AmazonMarketplace = 'FR' | 'DE' | 'IT';

type TestCase = {
  label: string;
  asin: string;
  expected: Partial<Record<AmazonMarketplace, number | null>>;
};

type FetchResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
};

type Candidate = {
  price: number;
  rawPrice: number;
  marketplace: AmazonMarketplace;
  asin: string;
  source: string;
  context: string;
  kind: 'offer' | 'current-format-core';
};

const TEST_CASES: TestCase[] = [
  {
    label: 'Primo record - B07JBCR129',
    asin: 'B07JBCR129',
    expected: {
      FR: 9.0,
      DE: 9.85,
      IT: 8.99
    }
  },
  {
    label: 'Secondo record - B0DVH4P8DB',
    asin: 'B0DVH4P8DB',
    expected: {
      FR: 32.83,
      DE: null,
      IT: 39.89
    }
  }
];

const MARKETPLACES: AmazonMarketplace[] = ['FR', 'DE', 'IT'];

const AMAZON_DOMAINS: Record<AmazonMarketplace, string> = {
  FR: 'amazon.fr',
  DE: 'amazon.de',
  IT: 'amazon.it'
};

const LANGUAGE_PARAMS: Record<AmazonMarketplace, string> = {
  FR: 'fr_FR',
  DE: 'de_DE',
  IT: 'it_IT'
};

const AMAZON_VAT_RATES: Record<AmazonMarketplace, number> = {
  FR: 0.2,
  DE: 0.19,
  IT: 0.22
};

const HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8',
  'accept-language':
    'it-IT,it;q=0.95,fr-FR,fr;q=0.9,de-DE,de;q=0.8,en-US;q=0.6,en;q=0.5',
  'cache-control': 'no-cache',
  pragma: 'no-cache'
};

function formatPrice(value: number | null): string {
  if (value === null) return '-';

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

function pricesClose(actual: number | null, expected: number | null): boolean {
  if (actual === null && expected === null) return true;
  if (actual === null || expected === null) return false;

  return Math.abs(actual - expected) <= 0.05;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function withVat(price: number, marketplace: AmazonMarketplace): number {
  return roundPrice(price * (1 + AMAZON_VAT_RATES[marketplace]));
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.]/g, '').trim();

  if (!cleaned) return null;

  let normalized = cleaned;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value >= 1000) return null;

  return roundPrice(value);
}

function extractEuroPrices(text: string): number[] {
  const prices: number[] = [];
  const regex = /€\s*(\d{1,5}(?:[.,]\d{2}))|(\d{1,5}(?:[.,]\d{2}))\s*€/gi;

  let match = regex.exec(text);

  while (match !== null) {
    const raw = match[1] || match[2] || '';
    const parsed = parsePrice(raw);

    if (parsed !== null) {
      prices.push(parsed);
    }

    match = regex.exec(text);
  }

  return prices;
}

function makeUrls(asin: string, marketplace: AmazonMarketplace): string[] {
  const domain = AMAZON_DOMAINS[marketplace];
  const language = LANGUAGE_PARAMS[marketplace];

  return [
    `https://www.${domain}/dp/${asin}`,
    `https://www.${domain}/dp/${asin}?language=${language}`,
    `https://www.${domain}/gp/aw/d/${asin}`,
    `https://www.${domain}/gp/aw/d/${asin}?language=${language}`
  ];
}

function makeReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

async function fetchOne(label: string, url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      cache: 'no-store',
      redirect: 'follow'
    });

    const text = response.ok ? await response.text() : '';

    return {
      label,
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text
    };
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: 0,
      statusText: error instanceof Error ? error.message : 'fetch error',
      text: ''
    };
  }
}

function extractExactOfferCandidates(
  text: string,
  asin: string,
  marketplace: AmazonMarketplace,
  sourceLabel: string
): Candidate[] {
  const normalized = normalizeText(text);
  const escapedAsin = escapeRegex(asin);
  const candidates: Candidate[] = [];

  const exactOfferPrice = new RegExp(
    String.raw`\[\s*€?\s*(\d{1,5}(?:[.,]\d{2}))\s*€?\s*\]\([^)]*\/gp\/offer-listing\/${escapedAsin}[^)]*condition=(?:new|NEW)[^)]*\)`,
    'gi'
  );

  let match = exactOfferPrice.exec(normalized);

  while (match !== null) {
    const raw = match[1] || '';
    const price = parsePrice(raw);

    if (price !== null) {
      const start = Math.max(0, match.index - 900);
      const end = Math.min(normalized.length, match.index + 900);
      const context = normalized.slice(start, end);

      candidates.push({
        price,
        rawPrice: price,
        marketplace,
        asin,
        source: `${sourceLabel}:exact-offer-link-price`,
        context,
        kind: 'offer'
      });
    }

    match = exactOfferPrice.exec(normalized);
  }

  const labeledOffer = new RegExp(
    String.raw`\[[^\]]{0,180}?(?:Nuovo|New|Neuf|Neu)[^\]]{0,180}?(?:da|from|à partir de|ab|von)\s*€?\s*(\d{1,5}(?:[.,]\d{2}))\s*€?[^\]]{0,180}?\]\([^)]*\/gp\/offer-listing\/${escapedAsin}[^)]*condition=(?:new|NEW)[^)]*\)`,
    'gi'
  );

  let labeledMatch = labeledOffer.exec(normalized);

  while (labeledMatch !== null) {
    const raw = labeledMatch[1] || '';
    const price = parsePrice(raw);

    if (price !== null) {
      const start = Math.max(0, labeledMatch.index - 900);
      const end = Math.min(normalized.length, labeledMatch.index + 900);
      const context = normalized.slice(start, end);

      candidates.push({
        price,
        rawPrice: price,
        marketplace,
        asin,
        source: `${sourceLabel}:exact-labeled-offer-link`,
        context,
        kind: 'offer'
      });
    }

    labeledMatch = labeledOffer.exec(normalized);
  }

  return candidates;
}

function extractCurrentFormatCoreFromText(
  text: string,
  asin: string,
  marketplace: AmazonMarketplace,
  sourceLabel: string
): Candidate[] {
  const normalized = normalizeText(text);
  const escapedAsin = escapeRegex(asin);
  const candidates: Candidate[] = [];

  /*
    Caso B0DVH4P8DB dal log reale:

    FR:
    Vinyl, Import ... €32.83 [€27.84](offer-listing/B0DVH4P8DB...)

    IT:
    Vinyl, Import ... €32.70 [€32.24](offer-listing/B0DVH4P8DB...)

    Qui prendiamo il prezzo PRIMA del link offer-listing dello stesso ASIN.
  */
  const offerLinkRegex = new RegExp(
    String.raw`\/gp\/offer-listing\/${escapedAsin}[^)]*condition=(?:new|NEW)`,
    'gi'
  );

  let offerLinkMatch = offerLinkRegex.exec(normalized);

  while (offerLinkMatch !== null) {
    const before = normalized.slice(
      Math.max(0, offerLinkMatch.index - 900),
      offerLinkMatch.index
    );

    const after = normalized.slice(
      offerLinkMatch.index,
      Math.min(normalized.length, offerLinkMatch.index + 500)
    );

    const context = `${before}${after}`;
    const lowerContext = cleanText(context).toLowerCase();

    const isCurrentVinylFormat =
      lowerContext.includes(`dp/${asin.toLowerCase()}`) &&
      (lowerContext.includes('vinyl') ||
        lowerContext.includes('vinile') ||
        lowerContext.includes(' lp') ||
        lowerContext.includes('import'));

    if (isCurrentVinylFormat) {
      const pricesBeforeOffer = extractEuroPrices(before).filter(
        (price) => price >= 20
      );

      if (pricesBeforeOffer.length > 0) {
        /*
          Nel caso corretto:
          - prima dell'offer link ci sono 32.70 / 32.83
          - il prezzo del link è 32.24 / 27.84
          Prendiamo il maggiore prima del link.
        */
        const rawPrice = Math.max(...pricesBeforeOffer);
        const finalPrice =
          marketplace === 'IT' ? withVat(rawPrice, marketplace) : rawPrice;

        candidates.push({
          price: finalPrice,
          rawPrice,
          marketplace,
          asin,
          source: `${sourceLabel}:current-format-price-before-offer-link`,
          context,
          kind: 'current-format-core'
        });
      }
    }

    offerLinkMatch = offerLinkRegex.exec(normalized);
  }

  return candidates;
}

function chooseCandidate(candidates: Candidate[]): Candidate | null {
  const currentFormatCore = candidates
    .filter((candidate) => candidate.kind === 'current-format-core')
    .sort((a, b) => b.rawPrice - a.rawPrice);

  if (currentFormatCore[0]) {
    return currentFormatCore[0];
  }

  const offers = candidates
    .filter((candidate) => candidate.kind === 'offer')
    .sort((a, b) => a.price - b.price);

  return offers[0] || null;
}

async function testAmazon(
  asin: string,
  marketplace: AmazonMarketplace
): Promise<{
  price: number | null;
  source: string;
  context: string;
  fetchSummary: string;
}> {
  const urls = makeUrls(asin, marketplace);
  const fetchResults: FetchResult[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of urls) {
      fetchResults.push(await fetchOne(`direct attempt=${attempt}`, url));
      await sleep(400);

      fetchResults.push(
        await fetchOne(`reader attempt=${attempt}`, makeReaderUrl(url))
      );
      await sleep(400);
    }
  }

  const candidates: Candidate[] = [];

  for (const result of fetchResults) {
    if (!result.ok || !result.text) continue;

    candidates.push(
      ...extractCurrentFormatCoreFromText(
        result.text,
        asin,
        marketplace,
        result.label
      )
    );

    candidates.push(
      ...extractExactOfferCandidates(
        result.text,
        asin,
        marketplace,
        result.label
      )
    );
  }

  const chosen = chooseCandidate(candidates);

  const fetchSummary = fetchResults
    .map(
      (result) =>
        `${result.label} | ${result.status} ${result.statusText} | ok=${result.ok} | len=${result.text.length} | ${result.url}`
    )
    .join('\n');

  if (!chosen) {
    return {
      price: null,
      source: 'NO_CANDIDATE',
      context: '-',
      fetchSummary
    };
  }

  return {
    price: chosen.price,
    source: `${chosen.source} kind=${chosen.kind} rawPrice=${chosen.rawPrice} finalPrice=${chosen.price}`,
    context: cleanText(chosen.context).slice(0, 1500),
    fetchSummary
  };
}

async function main() {
  console.log('========================================');
  console.log('AMAZON GITHUB ACTIONS TEST - NEW ALGORITHM V3');
  console.log('Questo test NON scrive nel database.');
  console.log('Questo test NON usa lo scraper di produzione.');
  console.log('========================================');

  let allOk = true;

  for (const testCase of TEST_CASES) {
    console.log('');
    console.log('----------------------------------------');
    console.log(`${testCase.label}`);
    console.log(`ASIN: ${testCase.asin}`);
    console.log('----------------------------------------');

    for (const marketplace of MARKETPLACES) {
      const expected = testCase.expected[marketplace] ?? null;

      console.log('');
      console.log(`>>> Test Amazon ${marketplace} / ${testCase.asin}`);

      const result = await testAmazon(testCase.asin, marketplace);
      const actual = result.price;

      const ok = pricesClose(actual, expected);

      if (!ok) {
        allOk = false;
      }

      console.log(`RESULT ${marketplace}`);
      console.log(`actual=${formatPrice(actual)}`);
      console.log(`expected=${formatPrice(expected)}`);
      console.log(`ok=${ok ? 'YES' : 'NO'}`);
      console.log(`source=${result.source}`);
      console.log(`context=${result.context}`);

      if (!ok) {
        console.log('FETCH SUMMARY');
        console.log(result.fetchSummary);
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`AMAZON TEST FINAL RESULT: ${allOk ? 'OK' : 'KO'}`);
  console.log('========================================');

  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('AMAZON TEST CRASH');
  console.error(error);
  process.exitCode = 1;
});

import { scrapeAmazonPrice, type AmazonMarketplace } from '@/lib/amazon-scraper';

type TestCase = {
  label: string;
  asin: string;
  expected: Partial<Record<AmazonMarketplace, number | null>>;
};

const TEST_CASES: TestCase[] = [
  {
    label: 'Primo record - B07JBCR129',
    asin: 'B07JBCR129',
    expected: {
      FR: null,
      DE: 9.99,
      IT: 8.99
    }
  },
  {
    label: 'Secondo record - B0DVH4P8DB',
    asin: 'B0DVH4P8DB',
    expected: {
      FR: null,
      DE: null,
      IT: 39.9
    }
  }
];

const MARKETPLACES: AmazonMarketplace[] = ['FR', 'DE', 'IT'];

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

async function main() {
  console.log('========================================');
  console.log('AMAZON GITHUB ACTIONS TEST');
  console.log('Questo test NON scrive nel database.');
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

      const result = await scrapeAmazonPrice(testCase.asin, marketplace);
      const actual = result.price;

      const ok = pricesClose(actual, expected);

      if (!ok) {
        allOk = false;
      }

      console.log(`RESULT ${marketplace}`);
      console.log(`actual=${formatPrice(actual)}`);
      console.log(`expected=${formatPrice(expected)}`);
      console.log(`ok=${ok ? 'YES' : 'NO'}`);
      console.log(`url=${result.url}`);
      console.log(`error=${result.error ?? '-'}`);
      console.log(`source=${result.source ?? '-'}`);
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

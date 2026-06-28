import { scrapePrice } from '../lib/scraper';

type ScraperConditionTest = {
  name: string;
  url: string;
  expectedPrice: number;
  expectedCondition: string;
};

const TESTS: ScraperConditionTest[] = [
  {
    name: 'Test 1 Base - una sola condizione',
    url: 'https://www.medimops.de/screaming-trees-anthology-sst-years-85-89-audio-cd-M0B000000M67.html',
    expectedPrice: 15.59,
    expectedCondition: 'Sehr gut'
  },
  {
    name: 'Test 2 - più condizioni/prezzi',
    url: 'https://www.medimops.de/ozzy-osbourne-ozzmosis-audio-cd-M0B000002B3Q.html',
    expectedPrice: 8.59,
    expectedCondition: 'Sehr gut'
  }
];

function normalizeConditionForCompare(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function priceMatches(actual: number | null, expected: number): boolean {
  if (actual === null) return false;

  return Math.abs(actual - expected) < 0.01;
}

async function main() {
  console.log('[scraper-condition-test] Avvio test Medimops');
  console.log('');

  let failed = 0;

  for (const test of TESTS) {
    console.log(`--- ${test.name} ---`);
    console.log(`URL: ${test.url}`);
    console.log(`Atteso prezzo: ${test.expectedPrice}`);
    console.log(`Attesa condizione: ${test.expectedCondition}`);

    const result = await scrapePrice(test.url);

    const actualPrice = result.price;
    const actualCondition = result.condition || null;

    const okPrice = priceMatches(actualPrice, test.expectedPrice);
    const okCondition =
      normalizeConditionForCompare(actualCondition) ===
      normalizeConditionForCompare(test.expectedCondition);

    console.log(`Trovato prezzo: ${actualPrice ?? '-'}`);
    console.log(`Trovata condizione: ${actualCondition ?? '-'}`);
    console.log(`Fonte: ${result.source}`);
    console.log(`Errore: ${result.error || '-'}`);

    if (okPrice && okCondition) {
      console.log('Esito: OK');
    } else {
      failed += 1;
      console.log('Esito: KO');

      if (!okPrice) {
        console.log(
          `Motivo: prezzo diverso. Atteso ${test.expectedPrice}, trovato ${actualPrice ?? '-'}`
        );
      }

      if (!okCondition) {
        console.log(
          `Motivo: condizione diversa. Attesa ${test.expectedCondition}, trovata ${actualCondition ?? '-'}`
        );
      }
    }

    console.log('');
  }

  if (failed > 0) {
    console.error(`[scraper-condition-test] Test falliti: ${failed}`);
    process.exit(1);
  }

  console.log('[scraper-condition-test] Tutti i test sono OK');
}

main().catch((error: unknown) => {
  console.error(
    '[scraper-condition-test] Errore fatale',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});

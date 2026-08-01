import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Uso: yarn tsx scripts/test-local-browser-scrape.ts <url1> <url2> ...');
  process.exit(1);
}

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForSearch(value: string): string {
  return normalize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractPrices(text: string): string[] {
  const matches = text.match(/(?:€\s*)?[0-9]{1,4}(?:[.,][0-9]{2})(?:\s*€)?/g) || [];
  return Array.from(new Set(matches.map((item) => normalize(item))));
}

function extractConditions(text: string): string[] {
  const searchable = normalizeForSearch(text);

  const signals = [
    'wie neu',
    'sehr gut',
    'gut',
    'akzeptabel',
    'comme neuf',
    'tres bon etat',
    'très bon état',
    'bon etat',
    'bon état',
    'acceptable'
  ];

  return signals.filter((signal) => searchable.includes(normalizeForSearch(signal)));
}

function isBlocked(text: string, title: string): boolean {
  const searchable = normalizeForSearch(`${title}\n${text}`);

  return (
    searchable.includes('just a moment') ||
    searchable.includes('cloudflare') ||
    searchable.includes('attention required') ||
    searchable.includes('captcha') ||
    searchable.includes('verify you are human')
  );
}

function safeName(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 120);
}

async function tryClickCookies(page: any): Promise<void> {
  const labels = [
    /alle akzeptieren/i,
    /akzeptieren/i,
    /accept all/i,
    /accept/i,
    /tout accepter/i,
    /accepter/i,
    /j'accepte/i
  ];

  for (const label of labels) {
    try {
      await page.getByRole('button', { name: label }).click({ timeout: 1500 });
      return;
    } catch {
      // continua
    }
  }
}

async function readPage(page: any): Promise<{ title: string; text: string }> {
  const title = await page.title().catch(() => '');
  const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');

  return { title, text };
}

async function main() {
  const outDir = path.resolve('.scraper-debug');
  await fs.mkdir(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext(
    path.resolve('.local-browser-profile'),
    {
      headless: false,
      viewport: { width: 1400, height: 900 },
      locale: 'de-DE',
      timezoneId: 'Europe/Rome'
    }
  );

  const page = await context.newPage();

  for (const url of urls) {
    console.log('\n============================================================');
    console.log(`URL: ${url}`);

    const startedAt = Date.now();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await tryClickCookies(page);
      await page.waitForTimeout(8000);

      let { title, text } = await readPage(page);
      let blocked = isBlocked(text, title);

      if (blocked) {
        console.log('Pagina sembra bloccata/challenge. Se vedi una verifica nel browser, completala. Attendo 45 secondi...');
        await page.waitForTimeout(45000);
        await tryClickCookies(page);
        ({ title, text } = await readPage(page));
        blocked = isBlocked(text, title);
      }

      const prices = extractPrices(text);
      const conditions = extractConditions(text);
      const elapsed = Math.round((Date.now() - startedAt) / 1000);

      const name = safeName(url);
      const textPath = path.join(outDir, `${name}.txt`);
      const screenshotPath = path.join(outDir, `${name}.png`);

      await fs.writeFile(textPath, text, 'utf8');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

      console.log(`Titolo: ${title}`);
      console.log(`Bloccata: ${blocked ? 'SI' : 'NO'}`);
      console.log(`Lunghezza testo: ${text.length}`);
      console.log(`Prezzi trovati: ${prices.slice(0, 20).join(' | ') || 'nessuno'}`);
      console.log(`Condizioni trovate: ${conditions.join(' | ') || 'nessuna'}`);
      console.log(`Tempo: ${elapsed}s`);
      console.log(`Testo salvato: ${textPath}`);
      console.log(`Screenshot salvato: ${screenshotPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'errore sconosciuto';
      console.log(`ERRORE: ${message}`);
    }
  }

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export type ScrapeResult = {
  price: number | null;
  condition?: string | null;
  status?: 'ok' | 'not_found' | 'error';
  message?: string;
  source: string;
  error: string | null;
};

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePrice(value: string): number | null {
  const normalized = normalizeText(value);

  const matches = normalized.match(
    /(?:€\s*)?([0-9]{1,4}(?:[.,][0-9]{2}))(?:\s*€)?/g
  );

  if (!matches || matches.length === 0) {
    return null;
  }

  const prices = matches
    .map((match) => {
      const cleaned = match
        .replace('€', '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

      const parsed = Number(cleaned);

      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }

      return Math.round(parsed * 100) / 100;
    })
    .filter(
      (price): price is number =>
        price !== null &&
        price >= 0.5 &&
        price <= 9999
    );

  return prices[0] ?? null;
}

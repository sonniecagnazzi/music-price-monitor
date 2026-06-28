export function buildMomoxUrlFromMedimopsUrl(value: string | null | undefined): string {
  const url = String(value || '').trim();

  if (!url) return '';

  return url
    .replace('https://www.medimops.de/', 'https://www.momox-shop.fr/')
    .replace('http://www.medimops.de/', 'https://www.momox-shop.fr/')
    .replace('https://medimops.de/', 'https://www.momox-shop.fr/')
    .replace('http://medimops.de/', 'https://www.momox-shop.fr/');
}

export function isMedimopsUrl(value: string | null | undefined): boolean {
  const url = String(value || '').trim().toLowerCase();

  return (
    url.startsWith('https://www.medimops.de/') ||
    url.startsWith('http://www.medimops.de/') ||
    url.startsWith('https://medimops.de/') ||
    url.startsWith('http://medimops.de/')
  );
}
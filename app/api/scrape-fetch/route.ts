import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

function buildBrowserLikeHeaders(url: string): Record<string, string> {
  const isMedimops = url.includes('medimops.de');
  const isMomox = url.includes('momox-shop.fr');

  const acceptLanguage = isMedimops
    ? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    : isMomox
      ? 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      : 'en-US,en;q=0.9';

  const referer = isMedimops
    ? 'https://www.medimops.de/'
    : isMomox
      ? 'https://www.momox-shop.fr/'
      : 'https://www.google.com/';

  return {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': acceptLanguage,
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    referer,
    'upgrade-insecure-requests': '1'
  };
}

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      (url.hostname === 'www.medimops.de' ||
        url.hostname === 'medimops.de' ||
        url.hostname === 'www.momox-shop.fr' ||
        url.hostname === 'momox-shop.fr')
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const expected = `Bearer ${env.cronSecret()}`;

    if (authHeader !== expected) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Non autorizzato.'
        },
        {
          status: 401
        }
      );
    }

    const body = (await request.json()) as {
      url?: string;
    };

    const url = String(body.url || '').trim();

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'URL non consentito.'
        },
        {
          status: 400
        }
      );
    }

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: buildBrowserLikeHeaders(url)
    });

    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: text.slice(0, 600000)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto.'
      },
      {
        status: 500
      }
    );
  }
}
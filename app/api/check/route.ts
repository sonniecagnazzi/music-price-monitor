import { NextResponse } from 'next/server';
import { runMonitor } from '@/lib/monitor-runner';
import { env } from '@/lib/env';

function isAuthorized(request: Request): boolean {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || new URL(request.url).searchParams.get('secret');
  return token === env.cronSecret();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  try {
    const summary = await runMonitor({ onlyActive: true });
    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore controllo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

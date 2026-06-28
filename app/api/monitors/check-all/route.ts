import { NextRequest, NextResponse } from 'next/server';
import { dispatchMonitorWorkflow } from '@/lib/github-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const result = await dispatchMonitorWorkflow({
      mode: 'all'
    });

    return NextResponse.json({
      ok: true,
      message:
        'Controllo completo avviato su GitHub Actions. Aggiorna la dashboard tra qualche minuto.',
      result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante avvio GitHub Actions.';

    console.error('[api/monitors/check-all] Errore', message);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

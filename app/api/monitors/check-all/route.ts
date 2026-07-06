import { NextRequest, NextResponse } from 'next/server';
import { dispatchMonitorWorkflow } from '@/lib/github-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let ids: string[] = [];

    try {
      const body = (await request.json()) as {
        ids?: unknown;
      };

      if (Array.isArray(body.ids)) {
        ids = body.ids
          .map((id) => String(id || '').trim())
          .filter(Boolean);
      }
    } catch {
      ids = [];
    }

    const result = await dispatchMonitorWorkflow(
      ids.length > 0
        ? {
            mode: 'selected',
            monitorIds: ids
          }
        : {
            mode: 'all'
          }
    );

    return NextResponse.json({
      ok: true,
      message:
        ids.length > 0
          ? `Controllo selezionati avviato su GitHub Actions (${ids.length} record). Aggiorna la dashboard tra qualche minuto.`
          : 'Controllo completo avviato su GitHub Actions. Aggiorna la dashboard tra qualche minuto.',
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

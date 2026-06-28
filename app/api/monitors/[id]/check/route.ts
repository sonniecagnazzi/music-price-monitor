import { NextRequest, NextResponse } from 'next/server';
import { dispatchMonitorWorkflow } from '@/lib/github-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ID monitor mancante.'
        },
        { status: 400 }
      );
    }

    const result = await dispatchMonitorWorkflow({
      mode: 'single',
      monitorId: id
    });

    return NextResponse.json({
      ok: true,
      message:
        'Controllo singolo avviato su GitHub Actions. Aggiorna la dashboard tra 1-2 minuti.',
      result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante avvio GitHub Actions.';

    console.error('[api/monitors/[id]/check] Errore', message);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

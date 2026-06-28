import { NextRequest, NextResponse } from 'next/server';
import { runMonitor } from '@/lib/monitor-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const summary = await runMonitor({
      monitorId: id,
      onlyActive: false
    });

    const detail = summary.details[0] || null;

    return NextResponse.json({
      ok: true,
      summary,
      detail,
      message:
        detail?.message ||
        `Controllo completato. Record controllati: ${summary.checked}.`
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante controllo singolo.';

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

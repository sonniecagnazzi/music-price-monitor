import { NextRequest, NextResponse } from 'next/server';
import { enqueueMacMonitorJob } from '@/lib/mac-monitor-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: {
    params: {
      id: string;
    };
  }
) {
  try {
    const id = context.params.id;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ID monitor mancante.'
        },
        {
          status: 400
        }
      );
    }

    const result = await enqueueMacMonitorJob({
      mode: 'single',
      monitorId: id
    });

    return NextResponse.json({
      ok: true,
      message:
        'Controllo singolo accodato al Mac runner.',
      result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante la creazione del job Mac.';

    console.error(
      '[api/monitors/[id]/check] Errore',
      message
    );

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      {
        status: 500
      }
    );
  }
}

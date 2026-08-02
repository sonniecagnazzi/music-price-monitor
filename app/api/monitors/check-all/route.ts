import { NextRequest, NextResponse } from 'next/server';
import { enqueueMacMonitorJob } from '@/lib/mac-monitor-jobs';

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

    const result = await enqueueMacMonitorJob(
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
          ? `Controllo di ${ids.length} record accodato al Mac runner.`
          : 'Controllo completo accodato al Mac runner.',
      result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante la creazione del job Mac.';

    console.error(
      '[api/monitors/check-all] Errore',
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

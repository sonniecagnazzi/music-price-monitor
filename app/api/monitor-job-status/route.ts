import { NextRequest, NextResponse } from 'next/server';
import {
  getMonitorJobStatus,
  resetMonitorJobStatus
} from '@/lib/monitor-job-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getMonitorJobStatus();

    return NextResponse.json({
      ok: true,
      data: status
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto lettura stato job.';

    console.error('[api/monitor-job-status] GET errore', message);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string;
    } | null;

    if (body?.action !== 'reset') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Azione non valida.'
        },
        { status: 400 }
      );
    }

    await resetMonitorJobStatus();

    const status = await getMonitorJobStatus();

    return NextResponse.json({
      ok: true,
      data: status
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto reset stato job.';

    console.error('[api/monitor-job-status] POST errore', message);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
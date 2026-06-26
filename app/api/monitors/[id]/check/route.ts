import { NextResponse } from 'next/server';
import { runMonitor } from '@/lib/monitor-runner';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const summary = await runMonitor({ monitorId: params.id, onlyActive: false });
    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore controllo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

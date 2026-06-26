import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { cleanMonitorInput } from '@/lib/validation';
import type { Monitor } from '@/lib/types';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = cleanMonitorInput(await request.json());
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('monitors')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single<Monitor>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('monitors').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

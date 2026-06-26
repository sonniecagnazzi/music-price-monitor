import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { cleanMonitorInput } from '@/lib/validation';
import type { Monitor } from '@/lib/types';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('monitors').select('*').order('created_at', { ascending: false }).returns<Monitor[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = cleanMonitorInput(body);
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('monitors').insert(input).select('*').single<Monitor>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

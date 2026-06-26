import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import type { Settings } from '@/lib/types';

const settingsSchema = z.object({ alert_email: z.string().trim().email('Email non valida').nullable().or(z.literal('')) });

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle<Settings>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PUT(request: Request) {
  try {
    const parsed = settingsSchema.parse(await request.json());
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, alert_email: parsed.alert_email || null, updated_at: new Date().toISOString() })
      .select('*')
      .single<Settings>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input non valido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

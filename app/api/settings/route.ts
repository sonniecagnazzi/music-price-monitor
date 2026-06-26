import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import type { Settings } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  alert_email: z.string().trim().email('Email non valida').nullable().or(z.literal(''))
});

function jsonError(message: string, status = 500) {
  return NextResponse.json({ data: null, error: message }, { status });
}

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle<Settings>();

    if (error) {
      return jsonError(error.message, 500);
    }

    if (data) {
      return NextResponse.json({ data, error: null });
    }

    const now = new Date().toISOString();

    const { data: created, error: createError } = await supabase
      .from('settings')
      .insert({
        id: 1,
        alert_email: null,
        created_at: now,
        updated_at: now
      })
      .select('*')
      .single<Settings>();

    if (createError) {
      return jsonError(createError.message, 500);
    }

    return NextResponse.json({ data: created, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto impostazioni';
    return jsonError(message, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = settingsSchema.parse(body);

    const supabase = createServiceClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('settings')
      .upsert(
        {
          id: 1,
          alert_email: parsed.alert_email || null,
          updated_at: now
        },
        {
          onConflict: 'id'
        }
      )
      .select('*')
      .single<Settings>();

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors.map((item) => item.message).join(', '), 400);
    }

    const message = error instanceof Error ? error.message : 'Input impostazioni non valido';
    return jsonError(message, 400);
  }
}

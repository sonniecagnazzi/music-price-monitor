import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type QuickTargetInput = {
  ids?: unknown;
  target?: unknown;
};

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function parseTarget(value: unknown): number | null {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;

  return Math.round(parsed * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuickTargetInput;

    const ids = Array.isArray(body.ids)
      ? body.ids.map((id) => String(id).trim()).filter(Boolean)
      : [];

    const target = parseTarget(body.target);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Nessun record selezionato.' },
        { status: 400 }
      );
    }

    if (target === null) {
      return NextResponse.json(
        {
          error:
            'Prezzo target non valido. Inserisci un numero, per esempio 5 oppure 5,00.'
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('monitors')
      .update({
        medimops_target_price: target,
        momox_target_price: target,
        target_price: target,
        updated_at: now
      })
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      updated: ids.length,
      target,
      message: `Quicktarget applicato a ${ids.length} record.`
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante Quicktarget.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

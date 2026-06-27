import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { monitorInputSchema } from '@/lib/types';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variabili Supabase mancanti.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = monitorInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Dati non validi.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('monitors')
      .update({
        type: parsed.data.type,
        site: parsed.data.site,
        artist: parsed.data.artist,
        album: parsed.data.album,
        edition: parsed.data.edition,
        ean_code: parsed.data.ean_code,
        release_year: parsed.data.release_year,
        country: parsed.data.country,
        url: parsed.data.url,
        target_price: parsed.data.target_price,
        alert_email: parsed.data.alert_email,
        is_active: parsed.data.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', context.params.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore aggiornamento monitor';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('monitors')
      .delete()
      .eq('id', context.params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore eliminazione monitor';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

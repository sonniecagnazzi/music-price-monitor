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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('monitors')
      .select('*')
      .order('artist', { ascending: true })
      .order('album', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore caricamento monitor';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      .insert({
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
        is_active: parsed.data.is_active
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore salvataggio monitor';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

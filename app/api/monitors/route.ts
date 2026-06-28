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

function getLegacyFields(input: {
  medimops_url: string | null;
  medimops_target_price: number | null;
  momox_url: string | null;
  momox_target_price: number | null;
}) {
  if (input.medimops_url && input.medimops_target_price) {
    return {
      site: 'Medimops',
      url: input.medimops_url,
      target_price: input.medimops_target_price
    };
  }

  if (input.momox_url && input.momox_target_price) {
    return {
      site: 'Momox',
      url: input.momox_url,
      target_price: input.momox_target_price
    };
  }

  const fallbackTarget =
    input.medimops_target_price || input.momox_target_price || 1;

  return {
    site: 'Medimops',
    url: '',
    target_price: fallbackTarget
  };
}

async function ensureEanIsNotDuplicated(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eanCode: string | null
) {
  const normalizedEan = String(eanCode || '').trim();

  if (!normalizedEan) return;

  const { data, error } = await supabase
    .from('monitors')
    .select('id, ean_code')
    .eq('ean_code', normalizedEan)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if ((data || []).length > 0) {
    throw new Error(`EAN già presente nel database: ${normalizedEan}.`);
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('monitors')
      .select('*')
      .order('artist', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
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

    await ensureEanIsNotDuplicated(supabase, parsed.data.ean_code);

    const legacy = getLegacyFields(parsed.data);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('monitors')
      .insert({
        genre: parsed.data.genre,
        type: parsed.data.type,
        artist: parsed.data.artist,
        album: parsed.data.album,
        edition: parsed.data.edition,
        ean_code: parsed.data.ean_code,
        release_year: parsed.data.release_year,
        country: parsed.data.country,

        site: legacy.site,
        url: legacy.url,
        target_price: legacy.target_price,
        current_price: null,

        medimops_url: parsed.data.medimops_url,
        medimops_target_price: parsed.data.medimops_target_price,
        medimops_current_price: null,

        momox_url: parsed.data.momox_url,
        momox_target_price: parsed.data.momox_target_price,
        momox_current_price: null,

        amazon_asin: parsed.data.amazon_asin,
        amazon_target_price: parsed.data.amazon_target_price,
        amazon_fr_current_price: null,
        amazon_de_current_price: null,
        amazon_it_current_price: null,

        alert_email: parsed.data.alert_email,
        is_active: parsed.data.is_active,
        alert_sent: false,

        created_at: now,
        updated_at: now
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore creazione monitor';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

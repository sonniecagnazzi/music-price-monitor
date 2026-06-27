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

async function ensureEanIsNotDuplicatedForOtherMonitor(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eanCode: string | null,
  currentId: string
) {
  const normalizedEan = String(eanCode || '').trim();

  if (!normalizedEan) return;

  const { data, error } = await supabase
    .from('monitors')
    .select('id, ean_code')
    .eq('ean_code', normalizedEan)
    .neq('id', currentId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if ((data || []).length > 0) {
    throw new Error(`EAN già presente nel database: ${normalizedEan}.`);
  }
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

    await ensureEanIsNotDuplicatedForOtherMonitor(
      supabase,
      parsed.data.ean_code,
      context.params.id
    );

    const legacy = getLegacyFields(parsed.data);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('monitors')
      .update({
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

        medimops_url: parsed.data.medimops_url,
        medimops_target_price: parsed.data.medimops_target_price,

        momox_url: parsed.data.momox_url,
        momox_target_price: parsed.data.momox_target_price,

        amazon_asin: parsed.data.amazon_asin,
        amazon_target_price: parsed.data.amazon_target_price,

        alert_email: parsed.data.alert_email,
        is_active: parsed.data.is_active,
        updated_at: now
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const body = await request.json();
    if (typeof body?.is_special !== 'boolean') {
      return NextResponse.json({ error: 'is_special deve essere booleano.' }, { status: 400 });
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Configurazione Supabase mancante.');
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from('monitors')
      .update({ is_special: body.is_special, updated_at: new Date().toISOString() })
      .eq('id', context.params.id).select('id, is_special').single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Errore inatteso.' }, { status: 500 });
  }
}

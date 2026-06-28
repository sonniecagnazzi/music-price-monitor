import { createClient } from '@supabase/supabase-js';
import { env } from '../lib/env';
import { runMonitor } from '../lib/monitor-runner';

type TestRow = {
  name: string;
  site: 'Medimops' | 'Momox';
  url: string;
  expectedPrice: number;
  expectedCondition: 'EX' | 'VG' | 'G';
};

const TEST_ROWS: TestRow[] = [
  {
    name: 'Medimops Test 1 Base - una sola condizione',
    site: 'Medimops',
    url: 'https://www.medimops.de/screaming-trees-anthology-sst-years-85-89-audio-cd-M0B000000M67.html',
    expectedPrice: 15.59,
    expectedCondition: 'EX'
  },
  {
    name: 'Medimops Test 2 - più condizioni/prezzi',
    site: 'Medimops',
    url: 'https://www.medimops.de/ozzy-osbourne-ozzmosis-audio-cd-M0B000002B3Q.html',
    expectedPrice: 8.59,
    expectedCondition: 'EX'
  },
  {
    name: 'Momox Test 1 Base - una sola condizione',
    site: 'Momox',
    url: 'https://www.momox-shop.fr/screaming-trees-anthology-sst-years-85-89-audio-cd-M0B000000M67.html',
    expectedPrice: 9.89,
    expectedCondition: 'EX'
  },
  {
    name: 'Momox Test 2 - più condizioni/prezzi',
    site: 'Momox',
    url: 'https://www.momox-shop.fr/ozzy-osbourne-ozzmosis-audio-cd-M0B000002B3Q.html',
    expectedPrice: 8.99,
    expectedCondition: 'EX'
  }
];

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function priceMatches(actual: number | null, expected: number): boolean {
  if (actual === null) return false;

  return Math.abs(actual - expected) < 0.01;
}

async function main() {
  const supabase = getSupabaseAdmin();
  const createdIds: string[] = [];
  const stamp = Date.now();

  console.log('[monitor-condition-db-test] Avvio test DB condizioni');
  console.log('');

  try {
    for (let index = 0; index < TEST_ROWS.length; index += 1) {
      const test = TEST_ROWS[index];
      const isMedimops = test.site === 'Medimops';
      const ean = `999${stamp}${index}`.slice(0, 32);

      console.log(`--- Creo record temporaneo: ${test.name} ---`);

      const insertPayload = {
        genre: 'Rock Pop',
        type: 'CD',
        artist: `TEST CONDITION ${test.site}`,
        album: test.name,
        edition: 'TEST TEMPORANEO',
        ean_code: ean,
        release_year: 1999,
        country: 'DE',

        site: test.site,
        url: test.url,
        target_price: 1,
        current_price: null,

        medimops_url: isMedimops ? test.url : null,
        medimops_target_price: isMedimops ? 1 : null,
        medimops_current_price: null,
        medimops_condition: null,

        momox_url: isMedimops ? null : test.url,
        momox_target_price: isMedimops ? null : 1,
        momox_current_price: null,
        momox_condition: null,

        amazon_asin: null,
        amazon_target_price: null,
        amazon_fr_current_price: null,
        amazon_de_current_price: null,
        amazon_it_current_price: null,

        alert_email: null,
        is_active: false,
        alert_sent: false,

        last_checked_at: null,
        last_status: null,
        last_error: null
      };

      const { data: inserted, error: insertError } = await supabase
        .from('monitors')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Errore insert record temporaneo: ${insertError.message}`);
      }

      const id = inserted.id as string;
      createdIds.push(id);

      console.log(`Record creato: ${id}`);
      console.log(`Eseguo monitor solo su questo record...`);

      const summary = await runMonitor({
        monitorId: id
      });

      console.log(`Monitor checked: ${summary.checked}`);
      console.log(`Monitor errors: ${summary.errors}`);

      for (const detail of summary.details) {
        console.log(
          `[monitor-result] ${detail.status} - ${detail.artist} - ${detail.album}: ${detail.message}`
        );
      }

      const { data: checkedRow, error: selectError } = await supabase
        .from('monitors')
        .select(
          'id, medimops_current_price, medimops_condition, momox_current_price, momox_condition, last_status, last_error'
        )
        .eq('id', id)
        .single();

      if (selectError) {
        throw new Error(`Errore rilettura record temporaneo: ${selectError.message}`);
      }

      const actualPrice = isMedimops
        ? Number(checkedRow.medimops_current_price)
        : Number(checkedRow.momox_current_price);

      const actualCondition = isMedimops
        ? checkedRow.medimops_condition
        : checkedRow.momox_condition;

      const okPrice = priceMatches(actualPrice, test.expectedPrice);
      const okCondition = actualCondition === test.expectedCondition;

      console.log(`Atteso prezzo: ${test.expectedPrice}`);
      console.log(`Trovato prezzo DB: ${Number.isFinite(actualPrice) ? actualPrice : '-'}`);
      console.log(`Attesa condizione DB: ${test.expectedCondition}`);
      console.log(`Trovata condizione DB: ${actualCondition || '-'}`);
      console.log(`Last status: ${checkedRow.last_status || '-'}`);
      console.log(`Last error: ${checkedRow.last_error || '-'}`);

      if (!okPrice || !okCondition) {
        console.log('Esito: KO');

        if (!okPrice) {
          console.log(
            `Motivo: prezzo diverso. Atteso ${test.expectedPrice}, trovato ${
              Number.isFinite(actualPrice) ? actualPrice : '-'
            }`
          );
        }

        if (!okCondition) {
          console.log(
            `Motivo: condizione diversa. Attesa ${test.expectedCondition}, trovata ${
              actualCondition || '-'
            }`
          );
        }

        throw new Error(`Test fallito: ${test.name}`);
      }

      console.log('Esito: OK');
      console.log('');
    }

    console.log('[monitor-condition-db-test] Tutti i test DB sono OK');
  } finally {
    if (createdIds.length > 0) {
      console.log('');
      console.log(
        `[monitor-condition-db-test] Pulizia record temporanei: ${createdIds.length}`
      );

      const { error: deleteError } = await supabase
        .from('monitors')
        .delete()
        .in('id', createdIds);

      if (deleteError) {
        console.error(
          `[monitor-condition-db-test] Errore pulizia record temporanei: ${deleteError.message}`
        );
      } else {
        console.log('[monitor-condition-db-test] Record temporanei eliminati');
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    '[monitor-condition-db-test] Errore fatale',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});

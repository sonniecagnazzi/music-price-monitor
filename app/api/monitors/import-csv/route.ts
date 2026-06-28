import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { MONITOR_GENRES, type MonitorGenre, type MonitorType } from '@/lib/types';
import { buildMomoxUrlFromMedimopsUrl, isMedimopsUrl } from '@/lib/store-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CsvRow = Record<string, string>;

const REQUIRED_HEADERS = [
  'Genere',
  'Tipo',
  'Artista',
  'Album',
  'EAN',
  'Anno - Label',
  'Country',
  'Target',
  'URL Medimops',
  'URL Momox'
];

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV vuoto o senza righe dati.');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `CSV non valido: mancano queste colonne obbligatorie: ${missingHeaders.join(', ')}.`
    );
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    row.__line = String(rowIndex + 2);

    return row;
  });
}

function parseTarget(value: string, line: string): number {
  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!cleaned) {
    throw new Error(`Riga ${line}: Target obbligatorio.`);
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Riga ${line}: Target non valido.`);
  }

  return Math.round(parsed * 100) / 100;
}

function parseYearAndEdition(value: string): {
  release_year: number | null;
  edition: string | null;
} {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      release_year: null,
      edition: null
    };
  }

  const parts = trimmed.split('-');
  const yearPart = parts[0]?.trim() || '';
  const editionPart = parts.slice(1).join('-').trim();

  const parsedYear = Number(yearPart);

  return {
    release_year:
      Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100
        ? Math.trunc(parsedYear)
        : null,
    edition: editionPart || null
  };
}

function normalizeGenre(value: string, line: string): MonitorGenre {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Riga ${line}: Genere obbligatorio.`);
  }

  if (!MONITOR_GENRES.includes(trimmed as MonitorGenre)) {
    throw new Error(
      `Riga ${line}: Genere non valido "${trimmed}". Valori ammessi: ${MONITOR_GENRES.join(', ')}.`
    );
  }

  return trimmed as MonitorGenre;
}

function normalizeType(value: string, line: string): MonitorType {
  const upper = value.trim().toUpperCase();

  if (upper !== 'CD' && upper !== 'LP') {
    throw new Error(`Riga ${line}: Tipo obbligatorio e deve essere CD oppure LP.`);
  }

  return upper as MonitorType;
}

function normalizeRequiredText(value: string, field: string, line: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Riga ${line}: ${field} obbligatorio.`);
  }

  return trimmed;
}

function normalizeEan(value: string, line: string): string {
  const cleaned = value.replace(/\D/g, '').trim();

  if (!cleaned) {
    throw new Error(`Riga ${line}: EAN obbligatorio.`);
  }

  if (!/^[0-9]{1,32}$/.test(cleaned)) {
    throw new Error(`Riga ${line}: EAN non valido, usa solo numeri.`);
  }

  return cleaned;
}

function normalizeCountry(value: string): string | null {
  const trimmed = value.trim().toUpperCase();

  if (!trimmed) return null;

  return trimmed.slice(0, 3);
}

function normalizeUrl(value: string): string {
  return value.trim();
}

function validateMedimopsUrl(value: string, line: string): string {
  const url = normalizeUrl(value);

  if (!url) {
    throw new Error(
      `Riga ${line}: URL Medimops obbligatorio. Import bloccato: nessun record è stato caricato.`
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Riga ${line}: URL Medimops non valido.`);
  }

  if (!isMedimopsUrl(url)) {
    throw new Error(
      `Riga ${line}: URL Medimops deve iniziare con https://www.medimops.de/.`
    );
  }

  return url;
}

async function ensureNoDuplicateEans(eans: string[]) {
  const supabase = getSupabaseAdmin();

  const uniqueEans = Array.from(new Set(eans));

  if (uniqueEans.length !== eans.length) {
    const seen = new Set<string>();
    const duplicate = eans.find((ean) => {
      if (seen.has(ean)) return true;
      seen.add(ean);
      return false;
    });

    throw new Error(
      `CSV non valido: EAN duplicato nel file (${duplicate}). Nessun record è stato caricato.`
    );
  }

  const { data, error } = await supabase
    .from('monitors')
    .select('ean_code')
    .in('ean_code', uniqueEans);

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    const duplicates = data
      .map((row) => row.ean_code)
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `CSV non valido: questi EAN esistono già nel database: ${duplicates}. Nessun record è stato caricato.`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'File CSV mancante.'
        },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CSV senza righe dati.'
        },
        { status: 400 }
      );
    }

    const parsedRows = rows.map((row) => {
      const line = row.__line || '?';

      const genre = normalizeGenre(row.Genere || '', line);
      const type = normalizeType(row.Tipo || '', line);
      const artist = normalizeRequiredText(row.Artista || '', 'Artista', line);
      const album = normalizeRequiredText(row.Album || '', 'Album', line);
      const ean_code = normalizeEan(row.EAN || '', line);
      const target = parseTarget(row.Target || '', line);
      const medimops_url = validateMedimopsUrl(row['URL Medimops'] || '', line);
      const momox_url = buildMomoxUrlFromMedimopsUrl(medimops_url);
      const yearAndEdition = parseYearAndEdition(row['Anno - Label'] || '');

      return {
        genre,
        type,
        artist,
        album,
        edition: yearAndEdition.edition,
        ean_code,
        release_year: yearAndEdition.release_year,
        country: normalizeCountry(row.Country || ''),

        site: 'Medimops',
        url: medimops_url,
        target_price: target,
        current_price: null,

        medimops_url,
        medimops_target_price: target,
        medimops_current_price: null,
        medimops_condition: null,

        momox_url,
        momox_target_price: target,
        momox_current_price: null,
        momox_condition: null,

        amazon_asin: null,
        amazon_target_price: null,
        amazon_fr_current_price: null,
        amazon_de_current_price: null,
        amazon_it_current_price: null,

        alert_email: null,
        is_active: true,
        alert_sent: false,

        last_checked_at: null,
        last_status: null,
        last_error: null
      };
    });

    await ensureNoDuplicateEans(parsedRows.map((row) => row.ean_code));

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('monitors').insert(parsedRows);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      imported: parsedRows.length,
      message: `Import CSV completato: ${parsedRows.length} righe caricate. URL Momox generato automaticamente da URL Medimops.`
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante import CSV.';

    console.error('[api/monitors/import-csv] Errore', message);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 400 }
    );
  }
}
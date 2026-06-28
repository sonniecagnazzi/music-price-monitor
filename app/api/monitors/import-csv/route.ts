import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { MonitorGenre } from '@/lib/types';

type CsvRow = Record<string, string>;

type ImportMonitorRow = {
  genre: MonitorGenre;
  type: 'CD' | 'LP';
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string;
  release_year: number | null;
  country: string | null;

  medimops_url: string | null;
  medimops_target_price: number;
  medimops_current_price: null;

  momox_url: string | null;
  momox_target_price: number;
  momox_current_price: null;

  amazon_asin: null;
  amazon_target_price: null;
  amazon_fr_current_price: null;
  amazon_de_current_price: null;
  amazon_it_current_price: null;

  alert_email: null;
  is_active: boolean;
  alert_sent: boolean;

  site: 'Medimops' | 'Momox';
  url: string;
  target_price: number;
  current_price: null;
};

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

const ALLOWED_GENRES: MonitorGenre[] = ['Alt', 'Jazz', 'H&M', 'Rock Pop'];

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '');
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeEan(value: string): string {
  return value.replace(/\D/g, '').trim();
}

function normalizeCountry(value: string): string | null {
  const cleaned = value.trim().toUpperCase();

  if (!cleaned) return null;

  return cleaned.slice(0, 3);
}

function normalizeGenre(value: string): MonitorGenre | null {
  const cleaned = value.trim();

  const exactMatch = ALLOWED_GENRES.find((genre) => genre === cleaned);

  if (exactMatch) return exactMatch;

  const lower = cleaned.toLowerCase();

  const relaxedMatch = ALLOWED_GENRES.find(
    (genre) => genre.toLowerCase() === lower
  );

  return relaxedMatch || null;
}

function parseTarget(value: string): number | null {
  const cleaned = value
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

function parseYearAndLabel(value: string): {
  release_year: number | null;
  edition: string | null;
} {
  const cleaned = value.trim();

  if (!cleaned) {
    return {
      release_year: null,
      edition: null
    };
  }

  const separatorIndex = cleaned.indexOf('-');

  const yearPart =
    separatorIndex >= 0 ? cleaned.slice(0, separatorIndex).trim() : cleaned;

  const labelPart =
    separatorIndex >= 0 ? cleaned.slice(separatorIndex + 1).trim() : '';

  const yearMatch = yearPart.match(/\d{4}/);
  const releaseYear = yearMatch ? Number(yearMatch[0]) : null;

  return {
    release_year:
      releaseYear !== null &&
      Number.isFinite(releaseYear) &&
      releaseYear >= 1900 &&
      releaseYear <= 2100
        ? releaseYear
        : null,
    edition: labelPart || null
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);

  return result;
}

function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Il file CSV è vuoto.');
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Colonna obbligatoria mancante: "${requiredHeader}".`);
    }
  }

  const rows: CsvRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const row: CsvRow = {};

    headers.forEach((header, headerIndex) => {
      row[header] = normalizeText(values[headerIndex] ?? '');
    });

    rows.push(row);
  }

  return rows;
}

function validateAndMapRows(rows: CsvRow[]): ImportMonitorRow[] {
  if (rows.length === 0) {
    throw new Error('Il CSV contiene solo intestazioni ma nessuna riga dati.');
  }

  const seenEans = new Map<string, number>();
  const mappedRows: ImportMonitorRow[] = [];

  rows.forEach((row, index) => {
    const csvLineNumber = index + 2;

    const genre = normalizeGenre(row['Genere'] || '');
    const type = normalizeText(row['Tipo']).toUpperCase();
    const artist = normalizeText(row['Artista']);
    const album = normalizeText(row['Album']);
    const ean = normalizeEan(row['EAN'] || '');
    const target = parseTarget(row['Target'] || '');
    const country = normalizeCountry(row['Country'] || '');
    const medimopsUrl = normalizeText(row['URL Medimops']) || null;
    const momoxUrl = normalizeText(row['URL Momox']) || null;
    const yearAndLabel = parseYearAndLabel(row['Anno - Label'] || '');

    if (!genre) {
      throw new Error(
        `Riga ${csvLineNumber}: Genere mancante o non valido. Valori ammessi: Alt, Jazz, H&M, Rock Pop.`
      );
    }

    if (type !== 'CD' && type !== 'LP') {
      throw new Error(
        `Riga ${csvLineNumber}: Tipo non valido. Valori ammessi: CD o LP.`
      );
    }

    if (!artist) {
      throw new Error(`Riga ${csvLineNumber}: Artista mancante.`);
    }

    if (!album) {
      throw new Error(`Riga ${csvLineNumber}: Album mancante.`);
    }

    if (!ean) {
      throw new Error(`Riga ${csvLineNumber}: EAN mancante.`);
    }

    if (seenEans.has(ean)) {
      throw new Error(
        `Riga ${csvLineNumber}: EAN duplicato nel CSV. Era già presente alla riga ${seenEans.get(
          ean
        )}. EAN: ${ean}.`
      );
    }

    seenEans.set(ean, csvLineNumber);

    if (target === null) {
      throw new Error(
        `Riga ${csvLineNumber}: Target mancante o non valido. Esempio valido: 5 oppure 5,00.`
      );
    }

    const legacySite: 'Medimops' | 'Momox' = medimopsUrl ? 'Medimops' : 'Momox';
    const legacyUrl = medimopsUrl || momoxUrl || '';

    mappedRows.push({
      genre,
      type,
      artist,
      album,
      edition: yearAndLabel.edition,
      ean_code: ean,
      release_year: yearAndLabel.release_year,
      country,

      medimops_url: medimopsUrl,
      medimops_target_price: target,
      medimops_current_price: null,

      momox_url: momoxUrl,
      momox_target_price: target,
      momox_current_price: null,

      amazon_asin: null,
      amazon_target_price: null,
      amazon_fr_current_price: null,
      amazon_de_current_price: null,
      amazon_it_current_price: null,

      alert_email: null,
      is_active: true,
      alert_sent: false,

      site: legacySite,
      url: legacyUrl,
      target_price: target,
      current_price: null
    });
  });

  return mappedRows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: 'Nessun file CSV ricevuto.'
        },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const parsedRows = parseCsv(csvText);
    const rowsToInsert = validateAndMapRows(parsedRows);

    const eans = rowsToInsert.map((row) => row.ean_code);

    const supabase = getSupabaseAdmin();

    const { data: existingRows, error: existingError } = await supabase
      .from('monitors')
      .select('ean_code')
      .in('ean_code', eans);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingEans = new Set(
      (existingRows || [])
        .map((row) => String(row.ean_code || '').trim())
        .filter(Boolean)
    );

    const duplicatedExistingEan = eans.find((ean) => existingEans.has(ean));

    if (duplicatedExistingEan) {
      const rowIndex = rowsToInsert.findIndex(
        (row) => row.ean_code === duplicatedExistingEan
      );

      throw new Error(
        `Riga ${rowIndex + 2}: EAN già presente nel database. EAN: ${duplicatedExistingEan}.`
      );
    }

    const now = new Date().toISOString();

    const rowsWithTimestamps = rowsToInsert.map((row) => ({
      ...row,
      created_at: now,
      updated_at: now
    }));

    const { error: insertError } = await supabase
      .from('monitors')
      .insert(rowsWithTimestamps);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      ok: true,
      imported: rowsToInsert.length,
      message: `Import completato: ${rowsToInsert.length} righe caricate.`
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante import CSV.';

    return NextResponse.json(
      {
        error: `${message} Nessuna riga è stata importata.`
      },
      { status: 400 }
    );
  }
}

import { z } from 'zod';

export type MonitorType = 'CD' | 'LP';

export type MonitorSite = 'Momox' | 'Medimops';

export type LastStatus = 'ok' | 'below_target' | 'error';

export type Monitor = {
  id: string;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string | null;
  release_year: number | null;
  country: string | null;

  site: MonitorSite;
  url: string;
  target_price: number;
  current_price: number | null;

  medimops_url: string | null;
  medimops_target_price: number | null;
  medimops_current_price: number | null;

  momox_url: string | null;
  momox_target_price: number | null;
  momox_current_price: number | null;

  amazon_asin: string | null;
  amazon_target_price: number | null;
  amazon_fr_current_price: number | null;
  amazon_de_current_price: number | null;
  amazon_it_current_price: number | null;

  last_checked_at: string | null;
  last_status: LastStatus | null;
  last_error: string | null;
  alert_email: string | null;
  alert_sent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MonitorInput = {
  type: MonitorType;
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string | null;
  release_year: number | null;
  country: string | null;

  medimops_url: string | null;
  medimops_target_price: number | null;

  momox_url: string | null;
  momox_target_price: number | null;

  amazon_asin: string | null;
  amazon_target_price: number | null;

  alert_email: string | null;
  is_active: boolean;
};

export type PriceCheck = {
  id: string;
  monitor_id: string;
  checked_at: string;
  price: number | null;
  status: LastStatus;
  error_message: string | null;
  source: string | null;
};

export type Settings = {
  id: number;
  global_alert_email: string | null;
  created_at: string;
  updated_at: string;
};

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  });

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    {
      message: 'Email non valida.'
    }
  );

const optionalCountry = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const cleaned = value.trim().toUpperCase();

    return cleaned.length === 0 ? null : cleaned;
  })
  .refine((value) => value === null || value.length <= 3, {
    message: 'Country deve essere al massimo di 3 lettere.'
  });

const optionalEanCode = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const cleaned = value.replace(/\D/g, '').trim();

    return cleaned.length === 0 ? null : cleaned;
  })
  .refine((value) => value === null || value.length <= 32, {
    message: 'EAN CODE deve essere al massimo di 32 cifre.'
  })
  .refine((value) => value === null || /^[0-9]+$/.test(value), {
    message: 'EAN CODE deve contenere solo numeri.'
  });

const optionalReleaseYear = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;

    const numberValue =
      typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isFinite(numberValue)) return null;

    return Math.trunc(numberValue);
  })
  .refine(
    (value) =>
      value === null ||
      (Number.isInteger(value) && value >= 1900 && value <= 2100),
    {
      message: 'Anno deve essere compreso tra 1900 e 2100.'
    }
  );

const optionalUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((value) => value === null || /^https?:\/\/.+/i.test(value), {
    message: 'URL non valido.'
  });

const optionalTargetPrice = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    return value;
  })
  .refine((value) => value === null || value > 0, {
    message: 'Prezzo target non valido.'
  });

const optionalAmazonAsin = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const cleaned = value.trim().toUpperCase();

    return cleaned.length === 0 ? null : cleaned;
  })
  .refine((value) => value === null || /^[A-Z0-9]{10}$/.test(value), {
    message: 'ASIN Amazon non valido. Deve contenere 10 caratteri.'
  });

export const monitorInputSchema = z
  .object({
    type: z.enum(['CD', 'LP']),
    artist: z.string().trim().min(1, 'Artista obbligatorio.'),
    album: z.string().trim().min(1, 'Album obbligatorio.'),
    edition: optionalText,
    ean_code: optionalEanCode,
    release_year: optionalReleaseYear,
    country: optionalCountry,

    medimops_url: optionalUrl,
    medimops_target_price: optionalTargetPrice,

    momox_url: optionalUrl,
    momox_target_price: optionalTargetPrice,

    amazon_asin: optionalAmazonAsin,
    amazon_target_price: optionalTargetPrice,

    alert_email: optionalEmail,
    is_active: z.boolean()
  })
  .refine(
    (value) =>
      Boolean(value.medimops_url && value.medimops_target_price) ||
      Boolean(value.momox_url && value.momox_target_price) ||
      Boolean(value.amazon_asin && value.amazon_target_price),
    {
      message:
        'Inserisci almeno un controllo tra Medimops, Momox o Amazon.'
    }
  )
  .refine(
    (value) =>
      !value.medimops_url ||
      Boolean(value.medimops_target_price && value.medimops_target_price > 0),
    {
      message: 'Inserisci il prezzo target Medimops.'
    }
  )
  .refine(
    (value) => !value.medimops_target_price || Boolean(value.medimops_url),
    {
      message: 'Inserisci l’URL Medimops.'
    }
  )
  .refine(
    (value) =>
      !value.momox_url ||
      Boolean(value.momox_target_price && value.momox_target_price > 0),
    {
      message: 'Inserisci il prezzo target Momox.'
    }
  )
  .refine(
    (value) => !value.momox_target_price || Boolean(value.momox_url),
    {
      message: 'Inserisci l’URL Momox.'
    }
  )
  .refine(
    (value) =>
      !value.amazon_asin ||
      Boolean(value.amazon_target_price && value.amazon_target_price > 0),
    {
      message: 'Inserisci il prezzo target Amazon.'
    }
  )
  .refine(
    (value) => !value.amazon_target_price || Boolean(value.amazon_asin),
    {
      message: 'Inserisci l’ASIN Amazon.'
    }
  );

export const settingsInputSchema = z.object({
  global_alert_email: z
    .string()
    .trim()
    .email('Email non valida.')
    .nullable()
    .optional()
});

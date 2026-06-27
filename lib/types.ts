import { z } from 'zod';

export type MonitorType = 'CD' | 'LP';

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

  site: string;
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

  alert_email: string | null;
  is_active: boolean;
  alert_sent: boolean;

  last_checked_at: string | null;
  last_status: LastStatus | null;
  last_error: string | null;

  created_at: string | null;
  updated_at: string | null;
};

export type Settings = {
  id: number;
  global_alert_email: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function emptyStringToNull(value: unknown) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function normalizeOptionalString(maxLength?: number) {
  let schema = z.preprocess(
    emptyStringToNull,
    z.string().trim().nullable().optional()
  );

  if (maxLength) {
    schema = z.preprocess(
      emptyStringToNull,
      z
        .string()
        .trim()
        .max(maxLength, `Massimo ${maxLength} caratteri.`)
        .nullable()
        .optional()
    );
  }

  return schema.transform((value) => value ?? null);
}

function normalizeOptionalUrl() {
  return z
    .preprocess(
      emptyStringToNull,
      z
        .string()
        .trim()
        .url('URL non valido.')
        .nullable()
        .optional()
    )
    .transform((value) => value ?? null);
}

function normalizeOptionalNumber() {
  return z
    .preprocess((value) => {
      if (value === null || value === undefined || value === '') return null;

      if (typeof value === 'number') return value;

      if (typeof value === 'string') {
        const cleaned = value
          .trim()
          .replace(/\s/g, '')
          .replace('€', '')
          .replace(/\./g, '')
          .replace(',', '.');

        if (!cleaned) return null;

        return Number(cleaned);
      }

      return value;
    }, z.number().positive('Il prezzo deve essere maggiore di zero.').nullable().optional())
    .transform((value) => value ?? null);
}

const optionalEmailSchema = z
  .preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .email('Email non valida.')
      .nullable()
      .optional()
  )
  .transform((value) => value ?? null);

const optionalYearSchema = z
  .preprocess((value) => {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') return Math.trunc(value);

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (!trimmed) return null;

      const parsed = Number(trimmed);

      if (!Number.isFinite(parsed)) return value;

      return Math.trunc(parsed);
    }

    return value;
  }, z.number().int().min(1900).max(2100).nullable().optional())
  .transform((value) => value ?? null);

const optionalEanSchema = z
  .preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .regex(/^[0-9]{1,32}$/, 'EAN non valido: usa solo numeri.')
      .nullable()
      .optional()
  )
  .transform((value) => value ?? null);

const optionalCountrySchema = z
  .preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .max(3, 'Country massimo 3 caratteri.')
      .nullable()
      .optional()
  )
  .transform((value) => (value ? value.toUpperCase().slice(0, 3) : null));

const optionalAsinSchema = z
  .preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{10}$/, 'ASIN non valido.')
      .nullable()
      .optional()
  )
  .transform((value) => (value ? value.toUpperCase() : null));

export const monitorInputSchema = z
  .object({
    type: z.enum(['CD', 'LP'], {
      errorMap: () => ({ message: 'Tipo obbligatorio: CD o LP.' })
    }),

    artist: z
      .string()
      .trim()
      .min(1, 'Artista obbligatorio.'),

    album: z
      .string()
      .trim()
      .min(1, 'Album obbligatorio.'),

    edition: normalizeOptionalString(255),
    ean_code: optionalEanSchema,
    release_year: optionalYearSchema,
    country: optionalCountrySchema,

    medimops_url: normalizeOptionalUrl(),
    medimops_target_price: normalizeOptionalNumber(),

    momox_url: normalizeOptionalUrl(),
    momox_target_price: normalizeOptionalNumber(),

    amazon_asin: optionalAsinSchema,
    amazon_target_price: normalizeOptionalNumber(),

    alert_email: optionalEmailSchema,

    is_active: z.boolean().default(true)
  })
  .superRefine((data, ctx) => {
    const hasMedimopsUrl = Boolean(data.medimops_url);
    const hasMedimopsTarget = data.medimops_target_price !== null;

    const hasMomoxUrl = Boolean(data.momox_url);
    const hasMomoxTarget = data.momox_target_price !== null;

    const medimopsComplete = hasMedimopsUrl && hasMedimopsTarget;
    const momoxComplete = hasMomoxUrl && hasMomoxTarget;

    const medimopsPartiallyFilled = hasMedimopsUrl || hasMedimopsTarget;
    const momoxPartiallyFilled = hasMomoxUrl || hasMomoxTarget;

    if (!medimopsComplete && !momoxComplete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Inserisci almeno un controllo completo tra Medimops o Momox: URL + prezzo target. Amazon per ora è ignorato.',
        path: ['medimops_url']
      });

      return;
    }

    if (medimopsPartiallyFilled && !medimopsComplete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Medimops incompleto: devi inserire sia URL Medimops sia Prezzo Target Medimops.',
        path: ['medimops_url']
      });
    }

    if (momoxPartiallyFilled && !momoxComplete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Momox incompleto: devi inserire sia URL Momox sia Prezzo Target Momox.',
        path: ['momox_url']
      });
    }
  });

export type MonitorInput = z.infer<typeof monitorInputSchema>;

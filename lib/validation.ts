import { z } from 'zod';

export const monitorSchema = z.object({
  type: z.enum(['CD', 'LP']),
  artist: z.string().trim().min(1, 'Artista obbligatorio').max(200),
  album: z.string().trim().min(1, 'Album obbligatorio').max(250),
  edition: z.string().trim().max(250).nullable().optional(),
  site: z.enum(['Medimops', 'Momox']),
  url: z.string().trim().url('URL non valido').refine((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host.includes('momox') || host.includes('medimops');
    } catch {
      return false;
    }
  }, 'Inserisci un URL Momox o Medimops'),
  target_price: z.coerce.number().positive('Prezzo target obbligatorio').max(999999.99),
  alert_email: z.string().trim().email('Email non valida').nullable().optional().or(z.literal('')),
  is_active: z.boolean().default(true)
});

export function cleanMonitorInput(input: unknown) {
  const parsed = monitorSchema.parse(input);
  return {
    ...parsed,
    edition: parsed.edition ? parsed.edition : null,
    alert_email: parsed.alert_email ? parsed.alert_email : null,
    target_price: Number(parsed.target_price.toFixed(2))
  };
}

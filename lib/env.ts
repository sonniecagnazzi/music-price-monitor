function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile ambiente mancante: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  resendApiKey: () => process.env.RESEND_API_KEY || '',
  alertFromEmail: () => process.env.ALERT_FROM_EMAIL || 'Music Price Monitor <onboarding@resend.dev>',
  defaultAlertEmail: () => process.env.DEFAULT_ALERT_EMAIL || '',
  cronSecret: () => required('CRON_SECRET'),
  appBaseUrl: () => process.env.APP_BASE_URL || ''
};

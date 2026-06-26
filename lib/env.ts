function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile ambiente mancante: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),

  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  smtpHost: () => required('SMTP_HOST'),

  smtpPort: () => Number(process.env.SMTP_PORT || '465'),

  smtpUser: () => required('SMTP_USER'),

  smtpPassword: () => required('SMTP_PASSWORD'),

  alertFromEmail: () =>
    process.env.ALERT_FROM_EMAIL ||
    `Music Price Monitor <${required('SMTP_USER')}>`,

  defaultAlertEmail: () => process.env.DEFAULT_ALERT_EMAIL || '',

  cronSecret: () => required('CRON_SECRET'),

  appBaseUrl: () => process.env.APP_BASE_URL || ''
};

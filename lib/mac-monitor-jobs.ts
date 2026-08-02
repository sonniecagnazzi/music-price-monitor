import { createClient } from '@supabase/supabase-js';

export type EnqueueMacMonitorJobOptions = {
  mode?: 'all' | 'single' | 'selected';
  monitorId?: string;
  monitorIds?: string[];
};

type MacJobMode = 'all' | 'single' | 'selected';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ''
  );
}

function resolveMode(
  options: EnqueueMacMonitorJobOptions
): MacJobMode {
  if (options.mode) {
    return options.mode;
  }

  if (options.monitorId) {
    return 'single';
  }

  if (options.monitorIds?.length) {
    return 'selected';
  }

  return 'all';
}

function resolveMonitorIds(
  options: EnqueueMacMonitorJobOptions
): string[] {
  if (options.monitorId) {
    return [options.monitorId];
  }

  return (options.monitorIds || [])
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function enqueueMacMonitorJob(
  options: EnqueueMacMonitorJobOptions = {}
) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey =
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error(
      'Missing required env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL'
    );
  }

  const mode = resolveMode(options);
  const monitorIds = resolveMonitorIds(options);

  if (mode === 'single' && monitorIds.length !== 1) {
    throw new Error(
      'Il job single richiede esattamente un monitor ID.'
    );
  }

  if (mode === 'selected' && monitorIds.length === 0) {
    throw new Error(
      'Il job selected richiede almeno un monitor ID.'
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase
    .from('mac_monitor_jobs')
    .insert({
      mode,
      monitor_ids: monitorIds,
      status: 'pending',
      requested_by: 'dashboard'
    })
    .select(
      'id, mode, monitor_ids, status, created_at'
    )
    .single();

  if (error) {
    throw new Error(
      `Errore creazione job Mac: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      'Il job Mac è stato creato senza restituire dati.'
    );
  }

  return {
    ok: true,
    provider: 'mac-runner',
    jobId: data.id,
    mode: data.mode,
    monitorIds: data.monitor_ids,
    status: data.status,
    createdAt: data.created_at
  };
}

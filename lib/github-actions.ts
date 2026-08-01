import { createClient } from '@supabase/supabase-js';

export type TriggerMonitorWorkflowOptions = {
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

function resolveMode(options: TriggerMonitorWorkflowOptions): MacJobMode {
  if (options.mode) {
    return options.mode;
  }

  if (options.monitorId) {
    return 'single';
  }

  if (options.monitorIds && options.monitorIds.length > 0) {
    return 'selected';
  }

  return 'all';
}

function resolveMonitorIds(options: TriggerMonitorWorkflowOptions): string[] {
  if (options.monitorId) {
    return [options.monitorId];
  }

  if (options.monitorIds) {
    return options.monitorIds
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Nome legacy mantenuto apposta:
 * prima questa funzione lanciava GitHub Actions.
 * Ora i bottoni della dashboard creano job per il Mac runner locale.
 */
export async function triggerMonitorWorkflow(options: TriggerMonitorWorkflowOptions = {}) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }

  const mode = resolveMode(options);
  const monitorIds = resolveMonitorIds(options);

  if (mode === 'single' && monitorIds.length !== 1) {
    throw new Error('Mac job single richiede esattamente un monitor ID.');
  }

  if (mode === 'selected' && monitorIds.length === 0) {
    throw new Error('Mac job selected richiede almeno un monitor ID.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabase
    .from('mac_monitor_jobs')
    .insert({
      mode,
      monitor_ids: monitorIds,
      status: 'pending',
      requested_by: 'dashboard'
    })
    .select('id, mode, monitor_ids, status, created_at')
    .single();

  if (error) {
    throw new Error(`Errore creazione Mac job: ${error.message}`);
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

export const triggerGitHubWorkflow = triggerMonitorWorkflow;
export const dispatchGitHubWorkflow = triggerMonitorWorkflow;

export const dispatchMonitorWorkflow = triggerMonitorWorkflow;

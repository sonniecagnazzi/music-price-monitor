import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export type MonitorJobStatusValue = 0 | 1 | 2;

export type MonitorJobStatus = {
  id: number;
  status: MonitorJobStatusValue;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  last_message: string | null;
};

function getSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false
    }
  });
}

export async function getMonitorJobStatus(): Promise<MonitorJobStatus> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('monitor_job_status')
    .select('*')
    .eq('id', 1)
    .single<MonitorJobStatus>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function setMonitorJobRunning(message: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('monitor_job_status')
    .update({
      status: 1,
      started_at: now,
      finished_at: null,
      updated_at: now,
      last_message: message
    })
    .eq('id', 1);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setMonitorJobFinished(message: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('monitor_job_status')
    .update({
      status: 2,
      finished_at: now,
      updated_at: now,
      last_message: message
    })
    .eq('id', 1);

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetMonitorJobStatus(message = 'Dashboard aggiornata.') {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('monitor_job_status')
    .update({
      status: 0,
      updated_at: now,
      last_message: message
    })
    .eq('id', 1);

  if (error) {
    throw new Error(error.message);
  }
}
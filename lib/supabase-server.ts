import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export function createServiceClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

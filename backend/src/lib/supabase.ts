import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Use new secret key if available, fallback to old service role key for backward compatibility
const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error('No Supabase admin key found. Please provide either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

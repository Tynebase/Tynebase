import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Use new secret key for admin operations (bypasses RLS)
const supabaseKey = env.SUPABASE_SECRET_KEY;

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
    global: {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  }
);

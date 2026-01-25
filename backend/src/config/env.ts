import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SUPABASE_URL: z.string().url(),
  
  // New Supabase API keys (preferred)
  SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_').optional(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_').optional(),
  
  // Old Supabase keys (deprecated, optional during transition)
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_GLOBAL: z.string().default('100'),
  RATE_LIMIT_WINDOW_GLOBAL: z.string().default('600000'),
  RATE_LIMIT_AI: z.string().default('10'),
  RATE_LIMIT_WINDOW_AI: z.string().default('60000'),
}).refine(
  (data) => {
    // Ensure either new keys or old keys are provided
    const hasNewKeys = data.SUPABASE_SECRET_KEY && data.SUPABASE_PUBLISHABLE_KEY;
    const hasOldKeys = data.SUPABASE_SERVICE_ROLE_KEY && data.SUPABASE_ANON_KEY;
    return hasNewKeys || hasOldKeys;
  },
  {
    message: 'Either new Supabase keys (SUPABASE_SECRET_KEY + SUPABASE_PUBLISHABLE_KEY) or old keys (SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY) must be provided',
  }
);

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

export const env = parseEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

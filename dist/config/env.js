"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = exports.isProd = exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
(0, dotenv_1.config)();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('8080'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SUPABASE_URL: zod_1.z.string().url(),
    // New Supabase API keys (preferred)
    SUPABASE_PUBLISHABLE_KEY: zod_1.z.string().startsWith('sb_publishable_').optional(),
    SUPABASE_SECRET_KEY: zod_1.z.string().startsWith('sb_secret_').optional(),
    // Old Supabase keys (deprecated, optional during transition)
    SUPABASE_ANON_KEY: zod_1.z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().optional(),
    ALLOWED_ORIGINS: zod_1.z.string().default('http://localhost:3000'),
    RATE_LIMIT_GLOBAL: zod_1.z.string().default('100'),
    RATE_LIMIT_WINDOW_GLOBAL: zod_1.z.string().default('600000'),
    RATE_LIMIT_AI: zod_1.z.string().default('10'),
    RATE_LIMIT_WINDOW_AI: zod_1.z.string().default('60000'),
    // Stripe billing
    STRIPE_SECRET_KEY: zod_1.z.string().optional(),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().optional(),
    FRONTEND_URL: zod_1.z.string().url().optional(),
    // Axiom logging configuration (optional)
    AXIOM_DATASET: zod_1.z.string().optional(),
    AXIOM_TOKEN: zod_1.z.string().optional(),
}).refine((data) => {
    // Ensure either new keys or old keys are provided
    const hasNewKeys = data.SUPABASE_SECRET_KEY && data.SUPABASE_PUBLISHABLE_KEY;
    const hasOldKeys = data.SUPABASE_SERVICE_ROLE_KEY && data.SUPABASE_ANON_KEY;
    return hasNewKeys || hasOldKeys;
}, {
    message: 'Either new Supabase keys (SUPABASE_SECRET_KEY + SUPABASE_PUBLISHABLE_KEY) or old keys (SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY) must be provided',
});
const parseEnv = () => {
    try {
        return envSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const missingVars = error.errors.map(err => err.path.join('.')).join(', ');
            throw new Error(`Missing or invalid environment variables: ${missingVars}`);
        }
        throw error;
    }
};
exports.env = parseEnv();
exports.isProd = exports.env.NODE_ENV === 'production';
exports.isDev = exports.env.NODE_ENV === 'development';
//# sourceMappingURL=env.js.map
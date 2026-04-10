"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
// Use new secret key for admin operations (bypasses RLS)
const supabaseKey = env_1.env.SUPABASE_SECRET_KEY;
if (!supabaseKey) {
    throw new Error('No Supabase admin key found. Please provide either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    global: {
        headers: {
            Authorization: `Bearer ${supabaseKey}`,
        },
    },
});
//# sourceMappingURL=supabase.js.map
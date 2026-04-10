"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditGuardMiddleware = creditGuardMiddleware;
const supabase_1 = require("../lib/supabase");
/** Monthly credits allocated per tier — must stay in sync with auth.ts */
const TIER_MONTHLY_CREDITS = {
    free: 10,
    base: 100,
    pro: 500,
    enterprise: 1000,
};
/**
 * Credit Guard Middleware
 *
 * Protects AI endpoints by verifying the tenant has sufficient credits.
 * Uses an atomic DB query to check the balance and prevent race conditions.
 *
 * Auto-initialises a monthly credit pool if one doesn't exist yet for the
 * current calendar month (e.g. first AI operation in a new month).
 *
 * @param request - Fastify request (requires request.tenant to be set by
 *                  tenantContextMiddleware)
 * @param reply   - Fastify reply
 */
async function creditGuardMiddleware(request, reply) {
    const tenant = request.tenant;
    if (!tenant?.id) {
        request.log.error('Credit guard called without tenant context');
        return reply.status(500).send({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Tenant context not available',
            },
        });
    }
    const tenantId = tenant.id;
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    try {
        // ── 1. Fetch balance ──────────────────────────────────────────────────
        const { data, error } = await supabase_1.supabaseAdmin.rpc('get_credit_balance', {
            p_tenant_id: tenantId,
            p_month_year: currentMonth,
        });
        if (error) {
            request.log.error({ tenantId, error: error.message }, 'Failed to check credit balance');
            return reply.status(500).send({
                error: {
                    code: 'CREDIT_CHECK_FAILED',
                    message: 'Unable to verify credit balance',
                },
            });
        }
        // ── 2. Auto-initialise pool if first operation of the month ──────────
        if (!data || data.length === 0) {
            const tierCredits = TIER_MONTHLY_CREDITS[tenant.tier ?? 'free'] ?? 10;
            request.log.info({ tenantId, month: currentMonth, tier: tenant.tier, credits: tierCredits }, 'Auto-initialising monthly credit pool');
            const { error: insertError } = await supabase_1.supabaseAdmin
                .from('credit_pools')
                .insert({
                tenant_id: tenantId,
                month_year: currentMonth,
                total_credits: tierCredits,
                used_credits: 0,
            });
            if (insertError) {
                // Unique-constraint violation means another concurrent request already
                // created the pool — that is fine, just continue.
                if (insertError.code !== '23505') {
                    request.log.error({ tenantId, error: insertError.message }, 'Failed to auto-initialise credit pool');
                    return reply.status(500).send({
                        error: {
                            code: 'CREDIT_POOL_INIT_FAILED',
                            message: 'Unable to initialise credit pool for this month',
                        },
                    });
                }
                // Race condition: pool already exists — fall through to re-read below
                request.log.debug({ tenantId }, 'Credit pool already exists (race condition on init) — continuing');
            }
            // Pool just created (or already existed via race) — expose balance and
            // proceed.  We conservatively assume full allocation is available; the
            // actual deduction at the route level will enforce the real balance.
            request.creditBalance = {
                total: tierCredits,
                used: 0,
                available: tierCredits,
            };
            return; // allow the request through
        }
        // ── 3. Check available credits ────────────────────────────────────────
        const balance = data[0];
        const availableCredits = Number(balance.available_credits);
        if (availableCredits <= 0) {
            request.log.warn({
                tenantId,
                totalCredits: balance.total_credits,
                usedCredits: balance.used_credits,
                availableCredits,
            }, 'Insufficient credits for AI operation');
            return reply.status(403).send({
                error: {
                    code: 'INSUFFICIENT_CREDITS',
                    message: `You have no credits remaining. Used ${balance.used_credits} of ${balance.total_credits} credits this month.`,
                    details: {
                        total: Number(balance.total_credits),
                        used: Number(balance.used_credits),
                        available: availableCredits,
                    },
                },
            });
        }
        request.log.debug({
            tenantId,
            availableCredits,
            totalCredits: balance.total_credits,
            usedCredits: balance.used_credits,
        }, 'Credit check passed');
        request.creditBalance = {
            total: Number(balance.total_credits),
            used: Number(balance.used_credits),
            available: availableCredits,
        };
    }
    catch (err) {
        request.log.error({
            tenantId,
            error: err instanceof Error ? err.message : 'Unknown error',
        }, 'Exception during credit check');
        return reply.status(500).send({
            error: {
                code: 'CREDIT_CHECK_ERROR',
                message: 'An error occurred while checking credits',
            },
        });
    }
}
//# sourceMappingURL=creditGuard.js.map
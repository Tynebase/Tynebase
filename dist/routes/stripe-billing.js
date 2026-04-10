"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = stripeBillingRoutes;
const stripe_1 = __importDefault(require("stripe"));
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const rateLimit_1 = require("../middleware/rateLimit");
const auditLog_1 = require("../lib/auditLog");
// ---------------------------------------------------------------------------
// Credit allocations per tier (must match auth.ts and frontend TIER_CONFIG)
// ---------------------------------------------------------------------------
const TIER_CREDITS = {
    free: 10,
    base: 100,
    pro: 500,
    enterprise: 1000,
};
// ---------------------------------------------------------------------------
// Stripe price mapping — create these in your Stripe dashboard (or via API)
// Map each tier to its monthly & yearly Stripe Price ID
// ---------------------------------------------------------------------------
const STRIPE_PRICES = {
    base: { monthly: process.env.STRIPE_PRICE_BASE_MONTHLY || '', yearly: process.env.STRIPE_PRICE_BASE_YEARLY || '' },
    pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '', yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '' },
    enterprise: { monthly: process.env.STRIPE_PRICE_ENT_MONTHLY || '', yearly: process.env.STRIPE_PRICE_ENT_YEARLY || '' },
};
const TIER_ORDER = { free: 0, base: 1, pro: 2, enterprise: 3 };
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key)
        return null;
    return new stripe_1.default(key, { apiVersion: '2025-04-30.basil' });
}
// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const checkoutSchema = zod_1.z.object({
    target_tier: zod_1.z.enum(['base', 'pro', 'enterprise']),
    billing_cycle: zod_1.z.enum(['monthly', 'yearly']).default('monthly'),
});
// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function stripeBillingRoutes(fastify) {
    // =========================================================================
    // POST /api/billing/checkout — create a Stripe Checkout Session
    // =========================================================================
    fastify.post('/api/billing/checkout', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        const stripe = getStripe();
        if (!stripe) {
            return reply.code(503).send({
                error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' },
            });
        }
        const tenant = request.tenant;
        const user = request.user;
        if (user.role !== 'admin' && !user.is_super_admin) {
            return reply.code(403).send({
                error: { code: 'FORBIDDEN', message: 'Only admins can manage billing' },
            });
        }
        const body = checkoutSchema.parse(request.body);
        const { target_tier, billing_cycle } = body;
        // Prevent same or downgrade
        const currentOrder = TIER_ORDER[tenant.tier] ?? 0;
        const targetOrder = TIER_ORDER[target_tier] ?? 0;
        if (targetOrder <= currentOrder) {
            return reply.code(400).send({
                error: { code: 'INVALID_UPGRADE', message: 'Can only upgrade to a higher tier via checkout' },
            });
        }
        const priceId = STRIPE_PRICES[target_tier]?.[billing_cycle];
        if (!priceId) {
            return reply.code(400).send({
                error: { code: 'PRICE_NOT_FOUND', message: `No Stripe price configured for ${target_tier} (${billing_cycle})` },
            });
        }
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.tynebase.com';
        // Upsert Stripe customer
        let customerId = tenant.settings?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: tenant.name,
                metadata: { tenant_id: tenant.id, subdomain: tenant.subdomain },
            });
            customerId = customer.id;
            // Save customer ID to tenant settings
            const settings = { ...(tenant.settings || {}), stripe_customer_id: customerId };
            await supabase_1.supabaseAdmin
                .from('tenants')
                .update({ settings })
                .eq('id', tenant.id);
        }
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${frontendUrl}/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
            cancel_url: `${frontendUrl}/dashboard/settings/billing?canceled=true`,
            metadata: {
                tenant_id: tenant.id,
                target_tier,
                billing_cycle,
                user_id: user.id,
            },
            subscription_data: {
                metadata: {
                    tenant_id: tenant.id,
                    tier: target_tier,
                },
            },
        });
        fastify.log.info({ tenantId: tenant.id, targetTier: target_tier, sessionId: session.id }, 'Stripe checkout session created');
        return reply.send({ success: true, data: { url: session.url } });
    });
    // =========================================================================
    // POST /api/billing/portal — create a Stripe Customer Portal session
    // =========================================================================
    fastify.post('/api/billing/portal', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        const stripe = getStripe();
        if (!stripe) {
            return reply.code(503).send({
                error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' },
            });
        }
        const tenant = request.tenant;
        const user = request.user;
        if (user.role !== 'admin' && !user.is_super_admin) {
            return reply.code(403).send({
                error: { code: 'FORBIDDEN', message: 'Only admins can manage billing' },
            });
        }
        const customerId = tenant.settings?.stripe_customer_id;
        if (!customerId) {
            return reply.code(400).send({
                error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' },
            });
        }
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.tynebase.com';
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${frontendUrl}/dashboard/settings/billing`,
        });
        return reply.send({ success: true, data: { url: session.url } });
    });
    // =========================================================================
    // POST /api/billing/webhook — Stripe webhook handler
    // Must receive raw body (not parsed JSON)
    // =========================================================================
    fastify.post('/api/billing/webhook', async (request, reply) => {
        const stripe = getStripe();
        if (!stripe) {
            return reply.code(503).send({ error: 'Stripe not configured' });
        }
        const sig = request.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !webhookSecret) {
            return reply.code(400).send({ error: 'Missing signature or webhook secret' });
        }
        let event;
        try {
            // Fastify stores raw body on request.rawBody when configured
            const rawBody = request.rawBody || request.body;
            const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
            event = stripe.webhooks.constructEvent(bodyStr, sig, webhookSecret);
        }
        catch (err) {
            fastify.log.error({ error: err.message }, 'Stripe webhook signature verification failed');
            return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
        }
        fastify.log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');
        switch (event.type) {
            // -------------------------------------------------------------------
            // Checkout completed — upgrade tenant tier
            // -------------------------------------------------------------------
            case 'checkout.session.completed': {
                const session = event.data.object;
                const tenantId = session.metadata?.tenant_id;
                const targetTier = session.metadata?.target_tier;
                if (!tenantId || !targetTier) {
                    fastify.log.warn({ sessionId: session.id }, 'Checkout session missing tenant metadata');
                    break;
                }
                // Get current tenant for audit
                const { data: tenant } = await supabase_1.supabaseAdmin
                    .from('tenants')
                    .select('id, tier, subdomain, name, settings')
                    .eq('id', tenantId)
                    .single();
                if (!tenant) {
                    fastify.log.error({ tenantId }, 'Tenant not found for checkout completion');
                    break;
                }
                const previousTier = tenant.tier;
                // Update tier + store subscription ID
                const settings = {
                    ...(tenant.settings || {}),
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription,
                };
                const { error: updateError } = await supabase_1.supabaseAdmin
                    .from('tenants')
                    .update({ tier: targetTier, settings })
                    .eq('id', tenantId);
                if (updateError) {
                    fastify.log.error({ error: updateError, tenantId }, 'Failed to upgrade tenant after checkout');
                }
                else {
                    fastify.log.info({ tenantId, from: previousTier, to: targetTier }, 'Tenant tier upgraded via Stripe checkout');
                    // Upsert credit pool for the current month with the new tier's credits
                    const newCredits = TIER_CREDITS[targetTier] ?? 10;
                    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
                    const { error: creditError } = await supabase_1.supabaseAdmin
                        .from('credit_pools')
                        .upsert({ tenant_id: tenantId, month_year: monthYear, total_credits: newCredits }, { onConflict: 'tenant_id,month_year', ignoreDuplicates: false });
                    if (creditError) {
                        fastify.log.warn({ error: creditError, tenantId }, 'Failed to upsert credit pool after tier upgrade');
                    }
                    else {
                        fastify.log.info({ tenantId, monthYear, newCredits }, 'Credit pool updated after tier upgrade');
                    }
                    (0, auditLog_1.writeAuditLog)({
                        tenantId,
                        actorId: session.metadata?.user_id || 'stripe',
                        action: 'settings.tier_upgraded',
                        actionType: 'settings',
                        targetName: `${previousTier} → ${targetTier}`,
                        ipAddress: 'stripe-webhook',
                        metadata: { from_tier: previousTier, to_tier: targetTier, stripe_session_id: session.id },
                    });
                }
                break;
            }
            // -------------------------------------------------------------------
            // Subscription updated (e.g. plan change via portal)
            // -------------------------------------------------------------------
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const tenantId = subscription.metadata?.tenant_id;
                const tier = subscription.metadata?.tier;
                if (tenantId && tier) {
                    const { error } = await supabase_1.supabaseAdmin
                        .from('tenants')
                        .update({ tier })
                        .eq('id', tenantId);
                    if (error) {
                        fastify.log.error({ error, tenantId }, 'Failed to update tenant tier from subscription update');
                    }
                    else {
                        fastify.log.info({ tenantId, tier }, 'Tenant tier updated via subscription change');
                    }
                }
                break;
            }
            // -------------------------------------------------------------------
            // Subscription deleted/canceled — downgrade to free
            // -------------------------------------------------------------------
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const tenantId = subscription.metadata?.tenant_id;
                if (tenantId) {
                    const { data: tenant } = await supabase_1.supabaseAdmin
                        .from('tenants')
                        .select('id, tier, settings')
                        .eq('id', tenantId)
                        .single();
                    if (tenant) {
                        const settings = { ...(tenant.settings || {}) };
                        delete settings.stripe_subscription_id;
                        await supabase_1.supabaseAdmin
                            .from('tenants')
                            .update({ tier: 'free', settings })
                            .eq('id', tenantId);
                        fastify.log.info({ tenantId }, 'Tenant downgraded to free after subscription cancellation');
                        (0, auditLog_1.writeAuditLog)({
                            tenantId,
                            actorId: 'stripe',
                            action: 'settings.tier_downgraded',
                            actionType: 'settings',
                            targetName: `${tenant.tier} → free`,
                            ipAddress: 'stripe-webhook',
                            metadata: { from_tier: tenant.tier, to_tier: 'free', reason: 'subscription_canceled' },
                        });
                    }
                }
                break;
            }
            // -------------------------------------------------------------------
            // Payment failed — log warning
            // -------------------------------------------------------------------
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer;
                fastify.log.warn({ customerId, invoiceId: invoice.id }, 'Stripe payment failed');
                break;
            }
            default:
                fastify.log.debug({ eventType: event.type }, 'Unhandled Stripe event');
        }
        return reply.send({ received: true });
    });
}
//# sourceMappingURL=stripe-billing.js.map
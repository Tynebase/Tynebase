import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog } from '../lib/auditLog';

// ---------------------------------------------------------------------------
// Credit pack definitions — keep in sync with landing page pricing
// Stripe price IDs are configured via environment variables
// ---------------------------------------------------------------------------
const CREDIT_PACKS = {
  '100': {
    credits: 100,
    priceGbp: 10,
    label: '100 Credits',
    priceEnvVar: 'STRIPE_PRICE_CREDITS_100',
  },
  '500': {
    credits: 500,
    priceGbp: 40,
    label: '500 Credits',
    priceEnvVar: 'STRIPE_PRICE_CREDITS_500',
  },
  '1000': {
    credits: 1000,
    priceGbp: 70,
    label: '1000 Credits',
    priceEnvVar: 'STRIPE_PRICE_CREDITS_1000',
  },
} as const;

type CreditPackKey = keyof typeof CREDIT_PACKS;

// Credits allocated per tier (must stay in sync with auth.ts and superadmin-change-tier.ts)
const TIER_MONTHLY_CREDITS: Record<string, number> = {
  free: 10,
  base: 100,
  pro: 500,
  enterprise: 1000,
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-04-30.basil' as any });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const purchaseSchema = z.object({
  pack: z.enum(['100', '500', '1000']),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export default async function creditsPurchaseRoutes(fastify: FastifyInstance) {

  // =========================================================================
  // POST /api/credits/purchase — create a one-time Stripe Checkout Session
  // for a credit top-up pack
  // =========================================================================
  fastify.post(
    '/api/credits/purchase',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stripe = getStripe();
      if (!stripe) {
        return reply.code(503).send({
          error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' },
        });
      }

      const tenant = (request as any).tenant;
      const user = (request as any).user;

      // Only admins can purchase credits
      if (user.role !== 'admin' && !user.is_super_admin) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Only workspace admins can purchase credits' },
        });
      }

      // Free tier cannot buy credit top-ups — they must upgrade their plan first
      if (tenant.tier === 'free') {
        return reply.code(403).send({
          error: {
            code: 'UPGRADE_REQUIRED',
            message: 'Credit top-ups are available for Base, Pro and Enterprise plans. Please upgrade your plan first.',
          },
        });
      }

      let body: z.infer<typeof purchaseSchema>;
      try {
        body = purchaseSchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
          });
        }
        throw err;
      }

      const pack = CREDIT_PACKS[body.pack as CreditPackKey];
      const priceId = process.env[pack.priceEnvVar];

      if (!priceId) {
        return reply.code(400).send({
          error: {
            code: 'PRICE_NOT_CONFIGURED',
            message: `The ${pack.label} credit pack is not yet available. Please contact support.`,
          },
        });
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://www.tynebase.com';

      // Upsert Stripe customer so it is linked to the tenant
      let customerId: string = tenant.settings?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: tenant.name,
          metadata: { tenant_id: tenant.id, subdomain: tenant.subdomain },
        });
        customerId = customer.id;

        const settings = { ...(tenant.settings || {}), stripe_customer_id: customerId };
        await supabaseAdmin
          .from('tenants')
          .update({ settings })
          .eq('id', tenant.id);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${frontendUrl}/dashboard/settings/billing?credits_purchased=true&pack=${body.pack}`,
        cancel_url: `${frontendUrl}/dashboard/settings/billing?credits_canceled=true`,
        metadata: {
          // Discriminates this from subscription checkouts in the webhook
          purchase_type: 'credit_pack',
          tenant_id: tenant.id,
          user_id: user.id,
          credits_amount: String(pack.credits),
          pack_key: body.pack,
        },
      });

      fastify.log.info(
        { tenantId: tenant.id, pack: body.pack, credits: pack.credits, sessionId: session.id },
        'Credit pack checkout session created'
      );

      return reply.send({ success: true, data: { url: session.url } });
    }
  );

  // =========================================================================
  // POST /api/credits/webhook — Stripe webhook for credit pack one-time
  // payments.  Configure a separate Stripe webhook pointing at this endpoint,
  // or re-use the same endpoint with STRIPE_CREDITS_WEBHOOK_SECRET env var.
  //
  // Must receive raw body (not parsed JSON) — Fastify rawBody plugin required.
  // =========================================================================
  fastify.post(
    '/api/credits/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stripe = getStripe();
      if (!stripe) {
        return reply.code(503).send({ error: 'Stripe not configured' });
      }

      const sig = request.headers['stripe-signature'] as string;
      // Supports a dedicated webhook secret for credit events; falls back to
      // the main billing webhook secret so a single endpoint can handle both.
      const webhookSecret =
        process.env.STRIPE_CREDITS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        return reply.code(400).send({ error: 'Missing stripe-signature header or webhook secret' });
      }

      let event: Stripe.Event;
      try {
        const rawBody = (request as any).rawBody || (request as any).body;
        const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
        event = stripe.webhooks.constructEvent(bodyStr, sig, webhookSecret);
      } catch (err: any) {
        fastify.log.error({ error: err.message }, 'Credits webhook signature verification failed');
        return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
      }

      fastify.log.info(
        { eventType: event.type, eventId: event.id },
        'Credits webhook received'
      );

      // We only care about completed checkout sessions for credit packs
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        // Skip if this isn't a credit pack purchase (e.g. subscription checkout)
        if (session.metadata?.purchase_type !== 'credit_pack') {
          fastify.log.debug(
            { sessionId: session.id, purchaseType: session.metadata?.purchase_type },
            'Checkout session is not a credit pack purchase — ignoring'
          );
          return reply.send({ received: true });
        }

        const tenantId = session.metadata?.tenant_id;
        const creditsAmount = parseInt(session.metadata?.credits_amount || '0', 10);
        const packKey = session.metadata?.pack_key || 'unknown';
        const userId = session.metadata?.user_id || 'stripe';

        if (!tenantId || creditsAmount <= 0) {
          fastify.log.error(
            { sessionId: session.id, tenantId, creditsAmount },
            'Credit pack session missing required metadata'
          );
          // Return 200 to prevent Stripe from retrying a permanently broken event
          return reply.send({ received: true });
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

        // Look up the current month's credit pool for this tenant
        const { data: existingPool, error: poolFetchError } = await supabaseAdmin
          .from('credit_pools')
          .select('id, total_credits, used_credits')
          .eq('tenant_id', tenantId)
          .eq('month_year', currentMonth)
          .maybeSingle();

        if (poolFetchError) {
          fastify.log.error(
            { error: poolFetchError, tenantId },
            'Failed to fetch credit pool for top-up — cannot add credits'
          );
          return reply.code(500).send({ error: 'Failed to process credit purchase' });
        }

        if (existingPool) {
          // ---------- Add purchased credits to existing pool ------------------
          const newTotal = existingPool.total_credits + creditsAmount;

          const { error: updateError } = await supabaseAdmin
            .from('credit_pools')
            .update({ total_credits: newTotal, updated_at: new Date().toISOString() })
            .eq('id', existingPool.id);

          if (updateError) {
            fastify.log.error(
              { error: updateError, tenantId, creditsAmount },
              'Failed to add purchased credits to existing pool'
            );
            return reply.code(500).send({ error: 'Failed to add credits to pool' });
          }

          fastify.log.info(
            { tenantId, creditsAdded: creditsAmount, previousTotal: existingPool.total_credits, newTotal },
            'Credits added to existing pool via credit pack purchase'
          );
        } else {
          // ---------- No pool yet for this month — create one -----------------
          // Get the tenant tier so we seed the base allocation + purchased credits
          const { data: tenantData } = await supabaseAdmin
            .from('tenants')
            .select('tier')
            .eq('id', tenantId)
            .single();

          const tierCredits = TIER_MONTHLY_CREDITS[tenantData?.tier || 'free'] ?? 0;
          const newTotal = tierCredits + creditsAmount;

          const { error: insertError } = await supabaseAdmin
            .from('credit_pools')
            .insert({
              tenant_id: tenantId,
              month_year: currentMonth,
              total_credits: newTotal,
              used_credits: 0,
            });

          if (insertError) {
            fastify.log.error(
              { error: insertError, tenantId, creditsAmount },
              'Failed to create credit pool with purchased credits'
            );
            return reply.code(500).send({ error: 'Failed to create credit pool' });
          }

          fastify.log.info(
            { tenantId, tierCredits, creditsAdded: creditsAmount, newTotal },
            'Created new credit pool with tier base + purchased credits'
          );
        }

        // Audit log for compliance / billing records
        writeAuditLog({
          tenantId,
          actorId: userId,
          action: 'billing.credits_purchased',
          actionType: 'settings',
          targetName: `${creditsAmount} Credits (Pack ${packKey})`,
          ipAddress: 'stripe-webhook',
          metadata: {
            credits_purchased: creditsAmount,
            pack_key: packKey,
            stripe_session_id: session.id,
            payment_intent: session.payment_intent,
          },
        });
      }

      return reply.send({ received: true });
    }
  );
}

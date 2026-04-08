import { apiPost } from './client';

export type BillingCycle = 'monthly' | 'yearly';
export type CreditPack = '100' | '500' | '1000';

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session for upgrading to a paid subscription plan.
 * Redirects the user to Stripe's hosted checkout page.
 */
export async function createCheckoutSession(
  targetTier: string,
  billingCycle: BillingCycle = 'monthly'
) {
  return apiPost<{ url: string }>('/api/billing/checkout', {
    target_tier: targetTier,
    billing_cycle: billingCycle,
  });
}

/**
 * Create a Stripe Customer Portal session so the user can manage their
 * subscription, update payment methods, download invoices, etc.
 */
export async function createPortalSession() {
  return apiPost<{ url: string }>('/api/billing/portal', {});
}

// ---------------------------------------------------------------------------
// Credit packs (one-time purchases)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session for a one-time credit pack purchase.
 * Available packs: '100' (£10), '500' (£40), '1000' (£70)
 * Only available for paid plan tenants (base, pro, enterprise).
 */
export async function purchaseCredits(pack: CreditPack) {
  return apiPost<{ url: string }>('/api/credits/purchase', { pack });
}

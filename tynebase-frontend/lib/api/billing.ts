import { apiPost } from './client';

export async function createCheckoutSession(targetTier: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
  return apiPost<{ url: string }>('/api/billing/checkout', { target_tier: targetTier, billing_cycle: billingCycle });
}

export async function createPortalSession() {
  return apiPost<{ url: string }>('/api/billing/portal', {});
}

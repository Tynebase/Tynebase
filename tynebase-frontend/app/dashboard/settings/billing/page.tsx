"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CheckCircle,
  ArrowRight,
  Zap,
  CreditCard,
  History,
  Loader2,
  ShoppingCart,
  ExternalLink,
  Crown,
  Building2,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useTenant } from '@/contexts/TenantContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createCheckoutSession,
  createPortalSession,
  purchaseCredits,
  type BillingCycle,
  type CreditPack,
} from '@/lib/api/billing';

// ---------------------------------------------------------------------------
// Static plan definitions — must match landing page pricing
// ---------------------------------------------------------------------------
const PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    credits: 10,
    maxUsers: 1,
    storage: '500 MB',
    features: [
      '1 solo account',
      '100 documents max',
      '10 AI credits / month',
      'Basic search',
      'Community support',
    ],
    icon: null,
    cta: 'Current Plan',
  },
  {
    key: 'base' as const,
    name: 'Base',
    priceMonthly: 29,
    priceYearly: 24,
    credits: 100,
    maxUsers: 10,
    storage: '1 GB',
    features: [
      'Up to 10 users',
      'Unlimited documents',
      '1 GB storage',
      '100 AI credits / month',
      'Full AI capabilities',
      'Version control',
      'Custom domain',
    ],
    icon: Zap,
    cta: 'Upgrade to Base',
    popular: true,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    priceMonthly: 99,
    priceYearly: 79,
    credits: 500,
    maxUsers: 50,
    storage: '10 GB',
    features: [
      'Up to 50 users',
      'Unlimited documents',
      '10 GB storage',
      '500 AI credits / month',
      'White-label branding',
      'Advanced analytics',
      'Custom domain',
      'Priority support',
      'Audit logs',
    ],
    icon: TrendingUp,
    cta: 'Upgrade to Pro',
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    priceMonthly: null,
    priceYearly: null,
    credits: 1000,
    maxUsers: -1,
    storage: 'Unlimited',
    features: [
      'All Pro features',
      'Unlimited users',
      'Unlimited storage',
      'Custom AI credit allocation',
      'Rollover credits',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'On-premise option',
    ],
    icon: Building2,
    cta: 'Upgrade to Enterprise',
  },
];

const TIER_ORDER: Record<string, number> = { free: 0, base: 1, pro: 2, enterprise: 3 };

// ---------------------------------------------------------------------------
// Credit pack options
// ---------------------------------------------------------------------------
const CREDIT_PACKS: Array<{
  pack: CreditPack;
  credits: number;
  price: number;
  pricePer: string;
  popular?: boolean;
}> = [
  { pack: '100', credits: 100, price: 10, pricePer: '£0.10 / credit' },
  { pack: '500', credits: 500, price: 40, pricePer: '£0.08 / credit' },
  { pack: '1000', credits: 1000, price: 70, pricePer: '£0.07 / credit', popular: true },
];

// ---------------------------------------------------------------------------
// Inner component (needs search params — wrapped in Suspense below)
// ---------------------------------------------------------------------------
function BillingPageInner() {
  const { addToast } = useToast();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { creditsRemaining, creditsTotal, isLoading: creditsLoading, refreshCredits } = useCredits();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [upgradingTo, setUpgradingTo] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState<CreditPack | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Handle redirect from Stripe checkout
  useEffect(() => {
    const success = searchParams.get('success');
    const creditsPurchased = searchParams.get('credits_purchased');
    const canceled = searchParams.get('canceled');
    const creditsCanceled = searchParams.get('credits_canceled');

    if (success === 'true') {
      addToast({
        type: 'success',
        title: 'Plan upgraded!',
        description: 'Your plan has been upgraded successfully. Welcome to the next tier!',
      });
      // Clean URL
      router.replace('/dashboard/settings/billing');
    } else if (creditsPurchased === 'true') {
      const pack = searchParams.get('pack');
      const packLabel = pack ? `${pack} credits` : 'credits';
      addToast({
        type: 'success',
        title: 'Credits purchased!',
        description: `${packLabel} have been added to your account.`,
      });
      refreshCredits();
      router.replace('/dashboard/settings/billing');
    } else if (canceled === 'true' || creditsCanceled === 'true') {
      addToast({
        type: 'info',
        title: 'Checkout cancelled',
        description: 'Your checkout was cancelled. No charges were made.',
      });
      router.replace('/dashboard/settings/billing');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTier = (tenant?.tier as string) || 'free';
  const currentOrder = TIER_ORDER[currentTier] ?? 0;
  const currentPlan = PLANS.find((p) => p.key === currentTier) || PLANS[0];
  const isAdmin = user?.role === 'admin' || user?.is_super_admin;
  const hasPaidPlan = currentTier !== 'free';
  const hasStripeCustomer = !!(tenant?.settings as any)?.stripe_customer_id;

  // Plans that are available to upgrade to
  const upgradablePlans = PLANS.filter(
    (p) => TIER_ORDER[p.key] > currentOrder
  );

  const creditUsed = creditsTotal - creditsRemaining;
  const creditPct = creditsTotal > 0 ? Math.min(100, (creditUsed / creditsTotal) * 100) : 0;

  // ---------------------------------------------------------------------------
  const handleUpgrade = async (targetTier: string) => {
    if (!isAdmin) {
      addToast({ type: 'error', title: 'Permission denied', description: 'Only workspace admins can manage billing.' });
      return;
    }
    if (targetTier === 'enterprise') {
      window.location.href = 'mailto:support@tynebase.com?subject=Enterprise Plan Inquiry';
      return;
    }
    setUpgradingTo(targetTier);
    try {
      const result = await createCheckoutSession(targetTier, billingCycle);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Checkout failed',
        description: err.message || 'Could not start the checkout. Please try again.',
      });
    } finally {
      setUpgradingTo(null);
    }
  };

  const handleBuyCredits = async (pack: CreditPack) => {
    if (!isAdmin) {
      addToast({ type: 'error', title: 'Permission denied', description: 'Only workspace admins can purchase credits.' });
      return;
    }
    if (!hasPaidPlan) {
      addToast({
        type: 'info',
        title: 'Upgrade required',
        description: 'Credit top-ups are available on the Base plan and above.',
      });
      return;
    }
    setBuyingPack(pack);
    try {
      const result = await purchaseCredits(pack);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Purchase failed',
        description: err.message || 'Could not start the checkout. Please try again.',
      });
    } finally {
      setBuyingPack(null);
    }
  };

  const handleOpenPortal = async () => {
    if (!isAdmin) {
      addToast({ type: 'error', title: 'Permission denied', description: 'Only workspace admins can access billing settings.' });
      return;
    }
    setOpeningPortal(true);
    try {
      const result = await createPortalSession();
      if (result?.url) {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Could not open billing portal',
        description: err.message || 'Please try again or contact support.',
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Plans</h1>
          <p className="text-muted-foreground">Manage your plan, credits and billing information</p>
        </div>
        {hasPaidPlan && hasStripeCustomer && (
          <Button variant="outline" onClick={handleOpenPortal} disabled={openingPortal}>
            {openingPortal ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30 p-4 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Only workspace admins can upgrade plans or purchase credits. Contact your admin for billing changes.</span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Current Plan                                                          */}
      {/* ------------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[var(--brand)]" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription and entitlements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {currentTier === 'free'
                  ? 'Perfect for getting started with basic features'
                  : currentTier === 'base'
                  ? 'Great for small teams with full AI capabilities'
                  : currentTier === 'pro'
                  ? 'For professionals and growing organisations'
                  : 'Custom enterprise solution'}
              </p>
              <ul className="space-y-1.5">
                {currentPlan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0">
              {currentPlan.priceMonthly === null ? (
                <div className="text-2xl font-bold mb-1">Contact Sales</div>
              ) : (
                <div className="text-3xl font-bold mb-1">
                  £{currentPlan.priceMonthly}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mb-3">{currentPlan.credits} AI credits / month</p>
              {currentTier !== 'enterprise' && upgradablePlans.length > 0 && isAdmin && (
                <Button
                  onClick={() => {
                    const nextPlan = upgradablePlans[0];
                    handleUpgrade(nextPlan.key);
                  }}
                  disabled={!!upgradingTo}
                >
                  {upgradingTo ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Upgrade Plan
                </Button>
              )}
              {currentTier === 'enterprise' && (
                <Badge variant="outline" className="text-[var(--brand)] border-[var(--brand)]">
                  Top Tier
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------- */}
      {/* Credit Balance                                                        */}
      {/* ------------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--brand)]" />
            AI Credits
          </CardTitle>
          <CardDescription>Your credit balance for this billing period</CardDescription>
        </CardHeader>
        <CardContent>
          {creditsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading credit balance…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-4xl font-bold">{creditsRemaining}</span>
                  <span className="text-muted-foreground text-sm ml-1">/ {creditsTotal} credits remaining</span>
                </div>
                <span className="text-sm text-muted-foreground">{creditUsed} used</span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditPct >= 90
                      ? 'bg-red-500'
                      : creditPct >= 70
                      ? 'bg-yellow-500'
                      : 'bg-[var(--brand)]'
                  }`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Resets monthly.{' '}
                  {creditsRemaining <= 0 && (
                    <span className="text-red-500 font-medium">No credits remaining — AI features are paused.</span>
                  )}
                  {creditsRemaining > 0 && creditsRemaining <= Math.max(5, creditsTotal * 0.1) && (
                    <span className="text-yellow-600 font-medium">Credits running low!</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------- */}
      {/* Available Upgrade Plans                                               */}
      {/* ------------------------------------------------------------------- */}
      {upgradablePlans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Available Plans</h2>
            {/* Monthly / Yearly toggle */}
            <div className="inline-flex rounded-full border border-border overflow-hidden text-sm">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 font-medium transition-colors flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Yearly
                <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  −20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {upgradablePlans.map((plan) => {
              const Icon = plan.icon;
              const price =
                billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
              const isUpgrading = upgradingTo === plan.key;

              return (
                <Card
                  key={plan.key}
                  className={`relative ${plan.popular ? 'ring-2 ring-[var(--brand)]' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[var(--brand)] text-white px-3">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className={plan.popular ? 'pt-5' : ''}>
                    <CardTitle className="flex items-center gap-2">
                      {Icon && <Icon className="h-5 w-5 text-[var(--brand)]" />}
                      {plan.name} Plan
                    </CardTitle>
                    <CardDescription>
                      {plan.key === 'base'
                        ? 'For small teams that need full AI power'
                        : plan.key === 'pro'
                        ? 'For growing organisations with advanced needs'
                        : 'Full-scale custom solution for organisations'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      {price === null ? (
                        <div className="text-3xl font-bold">Contact Sales</div>
                      ) : (
                        <>
                          <div className="text-3xl font-bold">
                            £{price}
                            <span className="text-sm font-normal text-muted-foreground">/month</span>
                          </div>
                          {billingCycle === 'yearly' && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Billed annually (£{(price! * 12).toLocaleString()}/year)
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <ul className="space-y-2 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={!!upgradingTo || !isAdmin}
                      variant={plan.popular ? 'primary' : 'outline'}
                    >
                      {isUpgrading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Redirecting to checkout…
                        </>
                      ) : (
                        <>
                          {plan.cta}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}


          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Buy Credits Section                                                   */}
      {/* ------------------------------------------------------------------- */}
      <div id="buy-credits">
        <div className="mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Buy More Credits
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            One-time credit top-ups. Credits are added instantly and expire at the end of the current billing period.
          </p>
        </div>

        {!hasPaidPlan ? (
          /* Free plan — show upsell */
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-[var(--brand)] opacity-60" />
              <h3 className="font-semibold mb-1">Upgrade to buy credit top-ups</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Credit packs are available on the Base plan (£29/mo) and above.
              </p>
              {isAdmin && (
                <Button onClick={() => handleUpgrade('base')} disabled={!!upgradingTo}>
                  {upgradingTo === 'base' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Upgrade to Base — £29/mo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {CREDIT_PACKS.map(({ pack, credits, price, pricePer, popular }) => {
              const isBuying = buyingPack === pack;
              return (
                <Card
                  key={pack}
                  className={`relative flex flex-col ${popular ? 'ring-2 ring-[var(--brand)]' : ''}`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[var(--brand)] text-white px-3">Best Value</Badge>
                    </div>
                  )}
                  <CardContent className={`flex flex-col flex-1 ${popular ? 'pt-7 pb-5 px-5' : 'pt-5 pb-5 px-5'}`}>
                    <div className="flex-1">
                      <div className="text-3xl font-bold mb-0.5">{credits.toLocaleString()}</div>
                      <div className="text-muted-foreground text-sm mb-3">credits</div>
                      <div className="text-2xl font-semibold mb-1">£{price}</div>
                      <div className="text-xs text-muted-foreground mb-4">{pricePer}</div>
                    </div>
                    <Button
                      className="w-full"
                      variant={popular ? 'primary' : 'outline'}
                      onClick={() => handleBuyCredits(pack)}
                      disabled={!!buyingPack || !isAdmin}
                    >
                      {isBuying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Buy {credits} Credits
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Billing History / Portal                                             */}
      {/* ------------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>Invoices, receipts and payment history</CardDescription>
        </CardHeader>
        <CardContent>
          {hasPaidPlan && hasStripeCustomer ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                View all your invoices and manage payment methods in the Stripe customer portal.
              </p>
              <Button variant="outline" onClick={handleOpenPortal} disabled={openingPortal}>
                {openingPortal ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Open Billing Portal
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium mb-1">No billing history</p>
              <p className="text-sm">Your invoices and receipts will appear here once you upgrade to a paid plan.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wrap in Suspense for useSearchParams compatibility
// ---------------------------------------------------------------------------
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}

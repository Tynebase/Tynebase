"use client";

import { useTenant } from "@/contexts/TenantContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { getDashboardStats, DashboardStats } from "@/lib/api/dashboard";
import { upgradeTenantTier } from "@/lib/api/tenants";
import Link from "next/link";
import { TIER_CONFIG, TierType } from "@/types/api";
import { 
  CreditCard, Check, X, Zap, Crown, Building2, Sparkles,
  ArrowRight, Calendar, AlertCircle, ExternalLink,
  ChevronRight, Users, HardDrive, Bot, FileText, UserPlus
} from "lucide-react";

// Tier display configuration for billing page
const TIER_DISPLAY: Record<TierType, {
  name: string;
  price: number | null;
  period: string;
  description: string;
  icon: React.ElementType;
  color: string;
  features: string[];
  highlighted?: boolean;
}> = {
  free: {
    name: "Free",
    price: 0,
    period: "/month",
    description: "For individuals getting started",
    icon: Zap,
    color: "var(--dash-text-secondary)",
    features: [
      "10 AI credits per month",
      "500MB storage",
      "2 team members",
      "Basic document editing",
      "Community support",
    ],
  },
  base: {
    name: "Base",
    price: 29,
    period: "/month",
    description: "For small teams",
    icon: Building2,
    color: "#3b82f6",
    features: [
      "100 AI credits per month",
      "5GB storage",
      "10 team members",
      "Real-time collaboration",
      "Email support",
      "Document templates",
      "Custom domain",
    ],
  },
  pro: {
    name: "Pro",
    price: 99,
    period: "/month",
    description: "For growing businesses",
    icon: Crown,
    color: "var(--brand)",
    highlighted: true,
    features: [
      "500 AI credits per month",
      "50GB storage",
      "50 team members",
      "White-label branding",
      "Custom domain",
      "Priority support",
      "Advanced analytics",
      "API access",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: null,
    period: "",
    description: "For large organizations",
    icon: Sparkles,
    color: "#8b5cf6",
    features: [
      "1000+ AI credits per month",
      "Unlimited storage",
      "Unlimited team members",
      "Full white-label",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "On-premise option",
    ],
  },
};

export default function BillingPage() {
  const { tenant, tierConfig, canUseFeature } = useTenant();
  const { addToast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TierType | null>(null);

  const currentTier = (tenant?.tier || 'free') as TierType;
  const currentTierConfig = TIER_CONFIG[currentTier];
  const currentTierDisplay = TIER_DISPLAY[currentTier];
  const { creditsRemaining, creditsTotal, isLoading: creditsLoading } = useCredits();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Fetch dashboard stats for storage and team data
  useEffect(() => {
    getDashboardStats()
      .then(setDashboardStats)
      .catch((err) => console.error('Failed to fetch dashboard stats:', err));
  }, []);

  // Usage data from real API data
  // Use MB when storage is under 1GB for better display
  const storageLimitMb = dashboardStats?.storage?.limit_mb || currentTierConfig?.maxStorageMb || 500;
  const storageUsedMb = dashboardStats?.storage?.used_mb || 0;
  const usesMbDisplay = storageLimitMb < 1024;
  
  const usage = {
    credits: { used: creditsTotal - creditsRemaining, total: creditsTotal || currentTierConfig?.credits || 10 },
    storage: { 
      used: usesMbDisplay ? storageUsedMb : (dashboardStats?.storage?.used_gb || 0),
      total: usesMbDisplay ? storageLimitMb : (dashboardStats?.storage?.limit_gb || storageLimitMb / 1024),
      unit: usesMbDisplay ? 'MB' : 'GB'
    },
    users: { 
      used: dashboardStats?.team?.members || 1, 
      total: currentTierConfig?.maxUsers || 2 
    },
  };

  const handleUpgrade = async (tier: TierType) => {
    if (tier === 'enterprise') {
      addToast({
        type: "info",
        title: "Contact Sales",
        description: "Please contact our sales team for enterprise pricing.",
      });
      return;
    }

    setSelectedTier(tier);
    setIsUpgrading(true);

    try {
      const result = await upgradeTenantTier(tier as 'base' | 'pro' | 'enterprise');
      addToast({
        type: "success",
        title: "Plan Upgraded!",
        description: result.message || `Successfully upgraded to ${tier}`,
      });
      // Reload the page to reflect the new tier
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to upgrade:', err);
      addToast({
        type: "error",
        title: "Upgrade Failed",
        description: err.message || "Failed to upgrade plan. Please try again.",
      });
    } finally {
      setIsUpgrading(false);
      setSelectedTier(null);
    }
  };

  const handleManageBilling = () => {
    // In production, this would redirect to Stripe customer portal
    addToast({
      type: "info",
      title: "Stripe Integration Coming Soon",
      description: "Billing management portal will be available soon.",
    });
  };

  const getTierIndex = (tier: TierType): number => {
    const tiers: TierType[] = ['free', 'base', 'pro', 'enterprise'];
    return tiers.indexOf(tier);
  };

  const isUpgradeAvailable = (tier: TierType): boolean => {
    return getTierIndex(tier) > getTierIndex(currentTier);
  };

  const isDowngrade = (tier: TierType): boolean => {
    return getTierIndex(tier) < getTierIndex(currentTier);
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Billing & Subscription</h1>
        <p className="text-[var(--dash-text-tertiary)]">
          Manage your subscription, view usage and update payment methods
        </p>
      </div>

      {/* Current Plan Overview */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[var(--brand)]" />
            Current Plan
          </h2>
          {currentTier !== 'free' && (
            <button
              onClick={handleManageBilling}
              className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1"
            >
              Manage Billing <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${currentTierDisplay.color}20` }}
              >
                <currentTierDisplay.icon className="w-7 h-7" style={{ color: currentTierDisplay.color }} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--dash-text-primary)]">
                  {currentTierDisplay.name} Plan
                </h3>
                <p className="text-sm text-[var(--dash-text-tertiary)]">
                  {currentTierDisplay.description}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[var(--dash-text-primary)]">
                {currentTierDisplay.price !== null ? `£${currentTierDisplay.price}` : 'Custom'}
                <span className="text-base font-normal text-[var(--dash-text-muted)]">
                  {currentTierDisplay.period}
                </span>
              </div>
              {currentTier !== 'free' && (
                <p className="text-xs text-[var(--dash-text-muted)] mt-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Next billing: February 1, 2026
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI Credits */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[var(--brand)]" />
              <span className="font-medium text-[var(--dash-text-primary)]">AI Credits</span>
            </div>
            <span className="text-sm text-[var(--dash-text-muted)]">
              {usage.credits.used} / {usage.credits.total}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-ground)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--brand)] rounded-full transition-all"
              style={{ width: `${(usage.credits.used / usage.credits.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-[var(--dash-text-muted)] mt-2">
            {usage.credits.total - usage.credits.used} credits remaining this month
          </p>
        </div>

        {/* Storage */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#3b82f6]" />
              <span className="font-medium text-[var(--dash-text-primary)]">Storage</span>
            </div>
            <span className="text-sm text-[var(--dash-text-muted)]">
              {usage.storage.used.toFixed(1)} / {usage.storage.total.toFixed(0)} {usage.storage.unit}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-ground)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#3b82f6] rounded-full transition-all"
              style={{ width: `${(usage.storage.used / usage.storage.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-[var(--dash-text-muted)] mt-2">
            {(usage.storage.total - usage.storage.used).toFixed(1)} {usage.storage.unit} available
          </p>
        </div>

        {/* Team Members */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8b5cf6]" />
              <span className="font-medium text-[var(--dash-text-primary)]">Team Members</span>
            </div>
            <span className="text-sm text-[var(--dash-text-muted)]">
              {usage.users.used} / {usage.users.total === -1 ? '∞' : usage.users.total}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-ground)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#8b5cf6] rounded-full transition-all"
              style={{ width: usage.users.total === -1 ? '10%' : `${(usage.users.used / usage.users.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-[var(--dash-text-muted)] mt-2 flex items-center justify-between">
            <span>{usage.users.total === -1 ? 'Unlimited' : `${usage.users.total - usage.users.used} seats available`}</span>
            <Link 
              href="/dashboard/users"
              className="text-[var(--brand)] hover:text-[var(--brand-dark)] font-medium flex items-center gap-1 transition-colors"
            >
              <UserPlus className="w-3 h-3" />
              Invite users
            </Link>
          </p>
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-4">
          {currentTier === 'enterprise' ? 'All Plans' : 'Upgrade Your Plan'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(TIER_DISPLAY) as TierType[]).map((tier) => {
            const tierInfo = TIER_DISPLAY[tier];
            const isCurrent = tier === currentTier;
            const isUpgrade = isUpgradeAvailable(tier);
            const isDowngradeOption = isDowngrade(tier);

            return (
              <div
                key={tier}
                className={`relative ${tier === 'enterprise' ? 'gemini-container' : 'bg-[var(--surface-card)] border overflow-hidden'} rounded-xl transition-all flex flex-col ${
                  tier !== 'enterprise' && (isCurrent 
                    ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/20' 
                    : tierInfo.highlighted 
                      ? 'border-[var(--brand)]' 
                      : 'border-[var(--dash-border-subtle)]')
                }`}
              >
                {tierInfo.highlighted && !isCurrent && (
                  <div className="absolute top-0 left-0 right-0 bg-[var(--brand)] text-white text-xs font-semibold text-center py-1">
                    MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 bg-[var(--status-success)] text-white text-xs font-semibold text-center py-1">
                    CURRENT PLAN
                  </div>
                )}
                
                <div className={`${tier === 'enterprise' ? 'gemini-content' : ''} p-5 flex flex-col flex-1 ${(tierInfo.highlighted || isCurrent) ? 'pt-8' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <tierInfo.icon className="w-5 h-5" style={{ color: tierInfo.color }} />
                    <h3 className="font-semibold text-[var(--dash-text-primary)]">{tierInfo.name}</h3>
                  </div>
                  
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-[var(--dash-text-primary)]">
                      {tierInfo.price !== null ? `£${tierInfo.price}` : 'Custom'}
                    </span>
                    <span className="text-sm text-[var(--dash-text-muted)]">{tierInfo.period}</span>
                  </div>

                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-4">
                    {tierInfo.description}
                  </p>

                  <ul className="space-y-2 flex-1">
                    {tierInfo.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-[var(--dash-text-secondary)]">
                        <Check className="w-3 h-3 text-[var(--status-success)] mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full h-10 px-4 rounded-lg bg-[var(--surface-ground)] text-[var(--dash-text-muted)] text-sm font-medium cursor-not-allowed flex items-center justify-center"
                    >
                      Current Plan
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(tier)}
                      disabled={isUpgrading && selectedTier === tier}
                      className="w-full h-10 px-4 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {isUpgrading && selectedTier === tier ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : tier === 'enterprise' ? (
                        <>Contact Sales</>
                      ) : (
                        <>Upgrade <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleManageBilling}
                      className="w-full h-10 px-4 rounded-lg border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] text-sm font-medium hover:bg-[var(--surface-ground)] transition-colors flex items-center justify-center"
                    >
                      Downgrade
                    </button>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Notice */}
      {!canUseFeature('whiteLabel') && (
        <div className="bg-gradient-to-r from-[var(--brand)]/10 to-[#8b5cf6]/10 border border-[var(--brand)]/20 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--brand)] mt-0.5" />
              <div>
                <h4 className="font-semibold text-[var(--dash-text-primary)]">
                  Unlock Premium Features
                </h4>
                <p className="text-sm text-[var(--dash-text-secondary)] mt-1">
                  Upgrade to Pro or Enterprise to access white-label branding, custom domains, and priority support.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleUpgrade('pro')}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] text-white rounded-lg font-medium hover:bg-[var(--brand-dark)] transition-colors whitespace-nowrap"
            >
              Upgrade to Pro <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Billing History */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--brand)]" />
            Billing History
          </h2>
        </div>
        <div className="p-7">
          {currentTier === 'free' ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--dash-text-secondary)]">No billing history</p>
              <p className="text-sm text-[var(--dash-text-muted)] mt-1">
                Upgrade to a paid plan to see your invoices here
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--dash-text-secondary)]">Billing history will appear here</p>
              <p className="text-sm text-[var(--dash-text-muted)] mt-1">
                Once Stripe integration is complete, your invoices will be displayed
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method */}
      {currentTier !== 'free' && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--brand)]" />
              Payment Method
            </h2>
            <button
              onClick={handleManageBilling}
              className="text-sm text-[var(--brand)] hover:underline"
            >
              Update
            </button>
          </div>
          <div className="p-7">
            <div className="flex items-center gap-4 p-4 bg-[var(--surface-ground)] rounded-lg">
              <div className="w-12 h-8 bg-[var(--dash-border-subtle)] rounded flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[var(--dash-text-muted)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--dash-text-primary)]">
                  Payment method will appear here
                </p>
                <p className="text-xs text-[var(--dash-text-muted)]">
                  Add a payment method via Stripe to manage your subscription
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="text-center py-4">
        <p className="text-sm text-[var(--dash-text-muted)]">
          Need help with billing?{" "}
          <a href="mailto:support@tynebase.com" className="text-[var(--brand)] hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

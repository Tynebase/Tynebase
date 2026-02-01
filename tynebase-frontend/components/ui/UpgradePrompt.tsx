"use client";

import Link from "next/link";
import { useTenant } from "@/contexts/TenantContext";
import { TIER_CONFIG, TierType } from "@/types/api";
import { Crown, Sparkles, Zap, Lock, ArrowRight } from "lucide-react";

interface UpgradePromptProps {
  feature: 'whiteLabel' | 'customDomain' | 'aiFeatures' | 'collaboration' | 'prioritySupport';
  title?: string;
  description?: string;
  variant?: 'banner' | 'card' | 'inline';
  requiredTier?: TierType;
}

const FEATURE_INFO: Record<string, { title: string; description: string; requiredTier: TierType }> = {
  whiteLabel: {
    title: "White-Label Branding",
    description: "Remove TyneBase branding and fully customize your workspace appearance.",
    requiredTier: "pro",
  },
  customDomain: {
    title: "Custom Domain",
    description: "Use your own domain for a fully branded experience.",
    requiredTier: "pro",
  },
  aiFeatures: {
    title: "AI Features",
    description: "Access AI-powered document generation and assistance.",
    requiredTier: "free",
  },
  collaboration: {
    title: "Real-time Collaboration",
    description: "Work together with your team in real-time.",
    requiredTier: "base",
  },
  prioritySupport: {
    title: "Priority Support",
    description: "Get faster response times and dedicated support.",
    requiredTier: "pro",
  },
};

export function UpgradePrompt({ 
  feature, 
  title, 
  description, 
  variant = 'banner',
  requiredTier: customRequiredTier,
}: UpgradePromptProps) {
  const { tenant, canUseFeature } = useTenant();
  
  // If user can use the feature, don't show anything
  if (canUseFeature(feature)) {
    return null;
  }

  const featureInfo = FEATURE_INFO[feature];
  const requiredTier = customRequiredTier || featureInfo.requiredTier;
  const tierConfig = TIER_CONFIG[requiredTier];

  const displayTitle = title || featureInfo.title;
  const displayDescription = description || featureInfo.description;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-ground)] rounded-lg">
        <Lock className="w-4 h-4 text-[var(--dash-text-muted)]" />
        <span className="text-sm text-[var(--dash-text-muted)]">
          Upgrade to {tierConfig.name} to unlock
        </span>
        <Link 
          href="/dashboard/settings/billing" 
          className="text-sm text-[var(--brand)] font-medium hover:underline"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-[var(--brand)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--dash-text-primary)]">{displayTitle}</h3>
            <p className="text-xs text-[var(--dash-text-muted)]">{tierConfig.name} Plan Required</p>
          </div>
        </div>
        <p className="text-sm text-[var(--dash-text-secondary)] mb-4">
          {displayDescription}
        </p>
        <Link 
          href="/dashboard/settings/billing"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-dark)] transition-colors"
        >
          Upgrade to {tierConfig.name} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Default: banner variant
  return (
    <div className="bg-gradient-to-r from-[var(--brand)] to-[#8b5cf6] rounded-xl p-6 text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{displayTitle}</h3>
            <p className="text-white/80 text-sm mt-1">
              {displayDescription}
            </p>
          </div>
        </div>
        <Link 
          href="/dashboard/settings/billing"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[var(--brand)] rounded-xl font-semibold hover:bg-white/90 transition-colors whitespace-nowrap"
        >
          Upgrade to {tierConfig.name}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Hook to check if credits are available
 * Returns { hasCredits, remaining, total, isLimited }
 */
export function useCreditsCheck() {
  const { tenant, tierConfig } = useTenant();
  
  // In a real app, this would fetch from the API
  // For now, return mock data based on tier
  const totalCredits = tierConfig?.credits || 10;
  
  // Mock: assume 30% used
  const usedCredits = Math.floor(totalCredits * 0.3);
  const remainingCredits = totalCredits - usedCredits;
  
  return {
    hasCredits: remainingCredits > 0,
    remaining: remainingCredits,
    total: totalCredits,
    used: usedCredits,
    isLimited: totalCredits <= 10, // Free tier
  };
}

/**
 * Component to show when AI credits are exhausted
 */
export function CreditsExhaustedPrompt() {
  const { tierConfig } = useTenant();
  const currentTierName = tierConfig?.name || 'Free';
  
  return (
    <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/20 rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--status-warning)]/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-[var(--status-warning)]" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[var(--dash-text-primary)]">
              AI Credits Exhausted
            </h3>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">
              You've used all your AI credits for this month. Upgrade for more credits.
            </p>
          </div>
        </div>
        <Link 
          href="/dashboard/settings/billing"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--brand)] text-white rounded-xl font-semibold hover:bg-[var(--brand-dark)] transition-colors whitespace-nowrap"
        >
          Get More Credits
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="mt-4 text-xs text-[var(--dash-text-muted)]">
        Current plan: {currentTierName} • Credits reset on the 1st of each month
      </div>
    </div>
  );
}

/**
 * Wrapper component that shows upgrade prompt if feature is not available
 */
export function FeatureGate({ 
  feature, 
  children,
  fallback,
}: { 
  feature: 'whiteLabel' | 'customDomain' | 'aiFeatures' | 'collaboration' | 'prioritySupport';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canUseFeature } = useTenant();
  
  if (canUseFeature(feature)) {
    return <>{children}</>;
  }
  
  return fallback ? <>{fallback}</> : <UpgradePrompt feature={feature} variant="card" />;
}

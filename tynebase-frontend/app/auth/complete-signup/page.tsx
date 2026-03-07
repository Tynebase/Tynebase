"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { TierType } from "@/types/api";
import { validateSubdomain } from "@/lib/utils";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { Check, Zap, Crown, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

const PLANS = {
  free: {
    name: "Free",
    price: "£0",
    period: "/mo",
    tagline: "Get started",
    features: ["1 user", "10 AI credits/mo", "500MB storage"],
    highlight: false,
  },
  base: {
    name: "Base",
    price: "£29",
    period: "/mo",
    tagline: "Small teams",
    features: ["10 users", "100 AI credits/mo", "5GB storage", "Collaboration"],
    highlight: false,
  },
  pro: {
    name: "Pro",
    price: "£99",
    period: "/mo",
    tagline: "Scale up",
    features: ["50 users", "500 AI credits/mo", "50GB storage", "White-label", "Branded subdomain", "Priority support"],
    highlight: true,
  },
};

interface PendingSignup {
  accountType: "individual" | "company";
  workspaceName: string;
  tier: TierType;
  subdomain: string;
  timestamp: number;
}

export default function CompleteSignupPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [step, setStep] = useState<"loading" | "plan" | "subdomain" | "creating">("loading");
  const [tier, setTier] = useState<TierType>("free");
  const [subdomain, setSubdomain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Read pending signup data from localStorage
    const raw = localStorage.getItem("pending_signup");
    if (!raw) {
      // No pending signup — maybe user navigated here directly
      router.replace("/dashboard");
      return;
    }

    try {
      const data: PendingSignup = JSON.parse(raw);
      // Check if data is fresh (less than 1 hour old)
      if (Date.now() - data.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem("pending_signup");
        router.replace("/signup");
        return;
      }

      setPending(data);
      setTier(data.tier as TierType);
      setSubdomain(data.subdomain || "");

      if (data.accountType === "individual") {
        // Individual: auto-create workspace immediately
        completeSignup(data, "free", "");
      } else if (data.tier && data.tier !== "free" && data.tier !== "base" && data.tier !== "pro") {
        // Unknown tier, show plan selection
        setStep("plan");
      } else if ((data.tier === "pro" || data.tier === "base") && !data.subdomain) {
        // Pro/Base without subdomain, show subdomain step
        setStep("subdomain");
      } else if ((data.tier === "pro" || data.tier === "base") && data.subdomain) {
        // Pro/Base with subdomain, auto-create
        completeSignup(data, data.tier, data.subdomain);
      } else {
        // Company with free/base tier — show plan selection
        setStep("plan");
      }
    } catch {
      localStorage.removeItem("pending_signup");
      router.replace("/signup");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlanSelect = (selectedTier: TierType) => {
    setTier(selectedTier);
    if (selectedTier === "enterprise") {
      addToast({ type: "info", title: "Enterprise", description: "Contact sales@tynebase.com for custom enterprise pricing." });
      return;
    }
    if (selectedTier === "pro" || selectedTier === "base") {
      setStep("subdomain");
    } else {
      completeSignup(pending!, selectedTier, "");
    }
  };

  const handleSubdomainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSubdomain(subdomain)) {
      setErrors({ subdomain: "Letters, numbers and hyphens only (3-63 chars)" });
      return;
    }
    completeSignup(pending!, tier, subdomain);
  };

  const completeSignup = async (data: PendingSignup, selectedTier: TierType, selectedSubdomain: string) => {
    setStep("creating");
    setIsCreating(true);

    try {
      // Get the current Supabase session (set by OAuth callback)
      const supabase = createClient();
      if (!supabase) {
        addToast({ type: "error", title: "Configuration error", description: "Authentication is not configured." });
        localStorage.removeItem("pending_signup");
        router.replace("/signup");
        return;
      }
      const { data: session } = await supabase.auth.getSession();

      if (!session?.session?.access_token) {
        addToast({ type: "error", title: "Session expired", description: "Please sign up again." });
        localStorage.removeItem("pending_signup");
        router.replace("/signup");
        return;
      }

      const user = session.session.user;

      // Call backend to complete the signup (create tenant + user record)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      
      // Build request body — only include subdomain for Pro/Enterprise
      const requestBody: Record<string, string> = {
        tenant_name: data.workspaceName,
        tier: selectedTier,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      };
      
      // Only Pro/Enterprise/Base get subdomains (white-label feature)
      if ((selectedTier === "pro" || selectedTier === "enterprise" || selectedTier === "base") && selectedSubdomain) {
        requestBody.subdomain = selectedSubdomain;
      }

      const response = await fetch(`${apiBase}/api/auth/complete-oauth-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error?.message || "Failed to create workspace");
      }

      // Store tokens and tenant info
      setAuthTokens(session.session.access_token, session.session.refresh_token || "");
      setTenantSubdomain(result.data?.tenant?.subdomain || "");

      // Clean up
      localStorage.removeItem("pending_signup");

      addToast({ type: "success", title: "Welcome to TyneBase!", description: "Redirecting to your dashboard..." });
      await new Promise(r => setTimeout(r, 400));
      window.location.href = "/dashboard";
    } catch (error) {
      setIsCreating(false);
      setStep("plan");
      addToast({
        type: "error",
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const inputClasses = "w-full px-4 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="hero-gradient" />
      <SiteNavbar currentPage="other" />

      <div className="flex-1 flex items-center justify-center px-4 py-12" style={{ marginTop: '80px', marginBottom: '80px' }}>
        <div className="w-full max-w-[460px]">
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '24px',
            padding: '44px 36px',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.3)',
          }}>

            {/* Loading / Creating */}
            {(step === "loading" || step === "creating") && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-10 h-10 text-[var(--brand)] animate-spin" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {step === "creating" ? "Creating your workspace..." : "Loading..."}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">This will only take a moment</p>
              </div>
            )}

            {/* Plan selection */}
            {step === "plan" && pending && (
              <div className="flex flex-col gap-4">
                <div className="text-center mb-1">
                  <h1 className="text-[26px] font-semibold text-[var(--text-primary)] mb-1">Choose your plan</h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    For <span className="font-medium text-[var(--text-primary)]">{pending.workspaceName}</span> — upgrade anytime
                  </p>
                </div>

                {(["free", "base", "pro"] as TierType[]).map((t) => {
                  const plan = PLANS[t as keyof typeof PLANS];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handlePlanSelect(t)}
                      className="relative text-left rounded-2xl p-5 border transition-all hover:border-[var(--brand)] cursor-pointer"
                      style={{
                        background: "var(--bg-secondary)",
                        border: plan.highlight ? "2px solid var(--brand)" : "1px solid var(--border-subtle)",
                      }}
                    >
                      {plan.highlight && (
                        <span className="absolute -top-2.5 right-4 px-3 py-0.5 bg-[var(--brand)] text-white text-[10px] font-bold uppercase rounded-full tracking-wide">
                          Recommended
                        </span>
                      )}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            {t === "pro" && <Zap className="w-4 h-4 text-[var(--brand)]" />}
                            {plan.name}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{plan.tagline}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[var(--text-primary)]">{plan.price}</span>
                          <span className="text-xs text-[var(--text-muted)]">{plan.period}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.features.map(f => (
                          <span key={f} className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-md">
                            <Check className="w-3 h-3 text-emerald-400" />{f}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handlePlanSelect("enterprise")}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--brand)] transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)" }}
                >
                  <div className="flex items-center gap-3">
                    <Crown className="w-5 h-5 text-[var(--brand)]" />
                    <div className="text-left">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Enterprise</span>
                      <p className="text-xs text-[var(--text-muted)]">Unlimited everything, custom pricing</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            )}

            {/* Subdomain step (Base/Pro) */}
            {step === "subdomain" && pending && (
              <form onSubmit={handleSubdomainSubmit} className="flex flex-col gap-5">
                <div className="text-center mb-1">
                  <h1 className="text-[26px] font-semibold text-[var(--text-primary)] mb-1">Your branded URL</h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Where <span className="font-medium text-[var(--text-primary)]">{pending.workspaceName}</span> lives on the web
                  </p>
                </div>

                <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl p-3.5 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    {tier === "pro" ? <Zap className="w-4 h-4 text-[var(--brand)]" /> : <div className="w-4 h-4 rounded-full border-2 border-[var(--brand)]" />}
                    <span className="text-sm font-medium text-[var(--text-primary)] capitalize">{tier} — {PLANS[tier as keyof typeof PLANS]?.price}{PLANS[tier as keyof typeof PLANS]?.period}</span>
                  </div>
                  <button type="button" onClick={() => setStep("plan")} className="text-xs text-[var(--brand)] font-medium hover:underline cursor-pointer">Change</button>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Workspace URL</label>
                  <div className="flex items-stretch">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => { setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setErrors({}); }}
                      className={`${inputClasses} rounded-r-none flex-1`}
                      placeholder="acme"
                    />
                    <span className="inline-flex items-center px-3.5 bg-[var(--bg-tertiary)] border border-l-0 border-[var(--border-subtle)] rounded-r-xl text-sm text-[var(--text-muted)] whitespace-nowrap">
                      .tynebase.com
                    </span>
                  </div>
                  {errors.subdomain && <p className="text-xs text-red-500 mt-1">{errors.subdomain}</p>}
                  {subdomain && !errors.subdomain && (
                    <p className="text-xs text-emerald-400 mt-1.5">
                      Your app will be live at <span className="font-mono font-medium">{subdomain}.tynebase.com</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep("plan")} className="flex-1 py-3.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-muted)] transition-all cursor-pointer">
                    Back
                  </button>
                  <button type="submit" disabled={isCreating} className="btn btn-primary flex-1 py-3.5 text-[15px] font-semibold">
                    {isCreating ? "Creating..." : "Launch workspace"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

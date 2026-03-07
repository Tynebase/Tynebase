"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { signup } from "@/lib/api/auth";
import { validateSubdomain } from "@/lib/utils";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TierType } from "@/types/api";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Check, Eye, EyeOff, Building2, Crown, User, Users, Zap, ArrowLeft } from "lucide-react";

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

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // Flow state
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState(""); // Space name or Company name
  const [tier, setTier] = useState<TierType>("free");
  const [subdomain, setSubdomain] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Auto-generate subdomain from workspace name
  useEffect(() => {
    if (workspaceName) {
      const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      setSubdomain(slug);
    }
  }, [workspaceName]);

  const clearError = (field: string) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (workspaceName.length < 2) e.workspaceName = accountType === "company" ? "Company name is required" : "Space name is required";
    if (fullName.length < 2) e.fullName = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email is required";
    if (password.length < 8) e.password = "At least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if ((tier === "pro" || tier === "base") && !validateSubdomain(subdomain)) {
      e.subdomain = "Letters, numbers and hyphens only (3-63 chars)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Step 1 → next
  const handleStep1Next = () => {
    if (!validateStep1()) return;

    if (accountType === "individual") {
      // Individuals go straight to submit (free tier)
      doSignup("free");
    } else {
      // Companies choose a plan
      setStep(2);
    }
  };

  // Plan selected → submit or subdomain step
  const handlePlanSelect = (selectedTier: TierType) => {
    setTier(selectedTier);
    if (selectedTier === "enterprise") {
      addToast({ type: "info", title: "Enterprise", description: "Contact sales@tynebase.com for custom enterprise pricing." });
      return;
    }
    if (selectedTier === "pro" || selectedTier === "base") {
      setStep(3); // Need subdomain for base and pro
    } else {
      doSignup(selectedTier);
    }
  };

  // Step 3 (Subdomain) → submit
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    doSignup(tier);
  };

  const doSignup = async (selectedTier: TierType) => {
    setIsLoading(true);
    try {
      // Subdomain: only for Pro/Enterprise (white-label feature)
      // Free/Base users access via main app (no subdomain)
      const signupData: Parameters<typeof signup>[0] = {
        email,
        password,
        tenant_name: workspaceName,
        full_name: fullName,
        tier: selectedTier,
      };

      // Only include subdomain for Base/Pro/Enterprise
      if ((selectedTier === "base" || selectedTier === "pro" || selectedTier === "enterprise") && subdomain) {
        signupData.subdomain = subdomain;
      }

      await signup(signupData);

      addToast({ type: "success", title: "Welcome to TyneBase!", description: "Redirecting to your dashboard..." });
      await new Promise(r => setTimeout(r, 400));
      window.location.href = "/dashboard";
    } catch (error) {
      addToast({
        type: "error",
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth — store pending signup data, then redirect to Google
  const handleGoogleSignup = async () => {
    // Validate workspace name before redirecting
    if (workspaceName.length < 2) {
      setErrors({ workspaceName: accountType === "company" ? "Enter your company name first" : "Enter your space name first" });
      return;
    }

    // Store signup context in localStorage so we can complete after OAuth callback
    const pendingSignup = {
      accountType,
      workspaceName,
      tier: accountType === "individual" ? "free" : tier,
      subdomain,
      timestamp: Date.now(),
    };
    localStorage.setItem("pending_signup", JSON.stringify(pendingSignup));

    // Redirect to Supabase Google OAuth
    const supabase = createClient();
    if (!supabase) {
      addToast({ type: "error", title: "Configuration error", description: "Authentication is not configured." });
      localStorage.removeItem("pending_signup");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/auth/complete-signup`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      addToast({ type: "error", title: "Google sign-in failed", description: error.message });
      localStorage.removeItem("pending_signup");
    }
  };

  const inputClasses = "w-full px-4 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";

  // Total steps for progress bar
  const totalSteps = accountType === "individual" ? 1 : (tier === "pro" || tier === "base") ? 3 : 2;

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

            {/* Progress bar */}
            <div className="flex gap-2 mb-8">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{ background: i < step ? 'var(--brand)' : 'var(--bg-tertiary)' }} />
              ))}
            </div>

            {/* ===== STEP 1: Account details ===== */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div className="text-center mb-2">
                  <h1 className="text-[26px] font-semibold text-[var(--text-primary)] mb-1">Create your account</h1>
                  <p className="text-sm text-[var(--text-secondary)]">Start managing knowledge in minutes</p>
                </div>

                {/* Account type toggle */}
                <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => { setAccountType("individual"); setTier("free"); clearError("workspaceName"); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: accountType === "individual" ? "var(--brand)" : "transparent",
                      color: accountType === "individual" ? "white" : "var(--text-secondary)",
                    }}
                  >
                    <User className="w-4 h-4" />
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAccountType("company"); clearError("workspaceName"); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: accountType === "company" ? "var(--brand)" : "transparent",
                      color: accountType === "company" ? "white" : "var(--text-secondary)",
                    }}
                  >
                    <Building2 className="w-4 h-4" />
                    Company
                  </button>
                </div>

                {/* Workspace name — contextual label */}
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                    {accountType === "company" ? "Company name" : "Space name"}
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => { setWorkspaceName(e.target.value); clearError("workspaceName"); }}
                    className={inputClasses}
                    placeholder={accountType === "company" ? "Acme Inc" : "My Knowledge Base"}
                  />
                  {errors.workspaceName && <p className="text-xs text-red-500 mt-1">{errors.workspaceName}</p>}
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {accountType === "company"
                      ? "Your team workspace will be named after your company"
                      : "A personal space for organising your knowledge"}
                  </p>
                </div>

                {/* Full name */}
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
                    className={inputClasses}
                    placeholder="Jane Smith"
                  />
                  {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                    className={inputClasses}
                    placeholder={accountType === "company" ? "you@company.com" : "you@email.com"}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                      className={`${inputClasses} pr-12`}
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={isLoading}
                  className="btn btn-primary w-full py-3.5 text-[15px] font-semibold mt-1"
                >
                  {isLoading ? "Creating account..." : accountType === "individual" ? "Create free account" : "Choose plan"}
                  {!isLoading && <ArrowRight className="w-4.5 h-4.5 ml-1" />}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-1">
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[15px] font-medium text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Individual: show what they get */}
                {accountType === "individual" && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-3.5 border border-[var(--border-subtle)]">
                    <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Free plan includes</p>
                    <div className="flex flex-wrap gap-2">
                      {["1 user", "10 AI credits/mo", "500MB storage"].map(f => (
                        <span key={f} className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-md">
                          <Check className="w-3 h-3 text-[var(--brand)]" />{f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-center text-sm text-[var(--text-secondary)]">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[var(--brand)] font-medium hover:underline">Sign in</Link>
                </p>
              </div>
            )}

            {/* ===== STEP 2: Plan selection (Company only) ===== */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="text-center mb-1">
                  <h1 className="text-[26px] font-semibold text-[var(--text-primary)] mb-1">Choose your plan</h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    For <span className="font-medium text-[var(--text-primary)]">{workspaceName}</span> — you can upgrade anytime
                  </p>
                </div>

                {(["free", "base", "pro"] as TierType[]).map((t) => {
                  const plan = PLANS[t as keyof typeof PLANS];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handlePlanSelect(t)}
                      className="relative text-left rounded-2xl p-5 border transition-all hover:border-[var(--brand)] cursor-pointer group"
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

                {/* Enterprise */}
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

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </div>
            )}

            {/* ===== STEP 3: Custom subdomain (Base/Pro only) ===== */}
            {step === 3 && (
              <form onSubmit={handleStep3Submit} className="flex flex-col gap-5">
                <div className="text-center mb-1">
                  <h1 className="text-[26px] font-semibold text-[var(--text-primary)] mb-1">Your branded URL</h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Where <span className="font-medium text-[var(--text-primary)]">{workspaceName}</span> lives on the web
                  </p>
                </div>

                {/* Selected plan badge */}
                <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl p-3.5 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    {tier === "pro" ? <Zap className="w-4 h-4 text-[var(--brand)]" /> : <div className="w-4 h-4 rounded-full border-2 border-[var(--brand)]" />}
                    <span className="text-sm font-medium text-[var(--text-primary)] capitalize">{tier} — {PLANS[tier as keyof typeof PLANS]?.price}{PLANS[tier as keyof typeof PLANS]?.period}</span>
                  </div>
                  <button type="button" onClick={() => setStep(2)} className="text-xs text-[var(--brand)] font-medium hover:underline cursor-pointer">Change</button>
                </div>

                {/* Subdomain input */}
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Workspace URL</label>
                  <div className="flex items-stretch">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => { setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); clearError("subdomain"); }}
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

                {/* Features summary */}
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-subtle)]">
                  <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2.5 capitalize">{tier} includes</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLANS[tier as keyof typeof PLANS]?.features.map(f => (
                      <span key={f} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <Check className="w-3.5 h-3.5 text-[var(--brand)]" />{f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-muted)] transition-all cursor-pointer">
                    Back
                  </button>
                  <button type="submit" disabled={isLoading} className="btn btn-primary flex-1 py-3.5 text-[15px] font-semibold">
                    {isLoading ? "Creating..." : "Launch workspace"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <SiteFooter currentPage="signup" />
    </div>
  );
}

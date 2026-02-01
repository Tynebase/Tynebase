"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { signup } from "@/lib/api/auth";
import { validateSubdomain } from "@/lib/utils";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TIER_CONFIG, TierType } from "@/types/api";
import { ArrowRight, Check, Eye, EyeOff, Sparkles, Building2, Crown, Zap, X } from "lucide-react";

// Tier display info for signup
const TIER_DISPLAY = {
  free: {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals getting started",
    highlight: false,
    features: [
      "10 AI credits/month",
      "500MB storage",
      "2 team members",
      "Basic features",
    ],
    limitations: [
      "No white-label branding",
      "No custom domain",
    ],
  },
  base: {
    name: "Base",
    price: "$29",
    period: "/month",
    description: "For small teams",
    highlight: false,
    features: [
      "100 AI credits/month",
      "5GB storage",
      "10 team members",
      "Real-time collaboration",
    ],
    limitations: [
      "No white-label branding",
      "No custom domain",
    ],
  },
  pro: {
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "For growing businesses",
    highlight: true,
    features: [
      "500 AI credits/month",
      "50GB storage",
      "50 team members",
      "White-label branding",
      "Custom domain",
      "Priority support",
    ],
    limitations: [],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    highlight: false,
    features: [
      "1000+ AI credits/month",
      "Unlimited storage",
      "Unlimited team members",
      "Full white-label",
      "Dedicated support",
      "Custom integrations",
    ],
    limitations: [],
  },
};

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    accountType: "user", // 'user' or 'company'
    companyName: "",
    subdomain: "",
    tier: "free" as TierType,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === "companyName") {
      const slug = value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, subdomain: slug }));
    }
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (formData.fullName.length < 2) newErrors.fullName = "Name must be at least 2 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email address";
    if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (!formData.accountType) newErrors.accountType = "Please select an account type";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (formData.accountType === 'company' && formData.companyName.length < 2) newErrors.companyName = "Company name is required";
    // Only validate subdomain for Pro/Enterprise (white-label tiers)
    if (formData.accountType === 'company' && (formData.tier === 'pro' || formData.tier === 'enterprise') && !validateSubdomain(formData.subdomain)) {
      newErrors.subdomain = "Invalid subdomain format";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      // Go to tier selection for company accounts, or step 3 for individual
      if (formData.accountType === 'user') {
        handleSubmit();
      } else {
        setStep(2); // Tier selection
      }
    }
  };

  const handleTierSelect = (tier: TierType) => {
    setFormData(prev => ({ ...prev, tier }));
    if (tier === 'enterprise') {
      // For enterprise, redirect to contact page
      addToast({
        type: "info",
        title: "Contact Sales",
        description: "Please contact our sales team for enterprise pricing.",
      });
      return;
    }
    
    // All company accounts need to provide company name
    // Pro tier also needs custom subdomain (white-label)
    setStep(3);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate based on account type
    const isValid = formData.accountType === 'user' ? validateStep1() : validateStep2();
    if (!isValid) return;
    
    setIsLoading(true);

    try {
      // Determine tenant name
      const tenantName = formData.accountType === 'company' 
        ? formData.companyName 
        : formData.fullName || formData.email.split('@')[0];
      
      // Subdomain logic:
      // - Pro/Enterprise with company account: use custom subdomain (white-label)
      // - Free/Base or individual: auto-generate from email
      let subdomain: string;
      if (formData.accountType === 'company' && (formData.tier === 'pro' || formData.tier === 'enterprise') && formData.subdomain) {
        subdomain = formData.subdomain;
      } else {
        // Auto-generate subdomain from email for non-white-label tiers
        subdomain = formData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      }

      const response = await signup({
        email: formData.email,
        password: formData.password,
        tenant_name: tenantName,
        subdomain: subdomain,
        full_name: formData.fullName,
        tier: formData.tier,
      });

      addToast({
        type: "success",
        title: "Account created!",
        description: `Welcome to TyneBase! Redirecting to dashboard...`,
      });
      
      // Small delay to ensure tokens are stored before redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirect to dashboard after successful signup
      window.location.href = "/dashboard";
    } catch (error) {
      addToast({
        type: "error",
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Failed to create account. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    // TODO: Implement Google OAuth through backend API
    addToast({ 
      type: "info", 
      title: "Coming soon", 
      description: "Google sign-up will be available soon. Please use email signup for now." 
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      {/* Centered Modal Container */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ marginTop: '80px', marginBottom: '80px' }}>
        <div className="w-full max-w-md">
          {/* Modal Card */}
          <div style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)', 
            borderRadius: '20px', 
            padding: '48px 40px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--brand)' : 'var(--bg-tertiary)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--brand)' : 'var(--bg-tertiary)' }} />
              {formData.accountType === 'company' && (
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 3 ? 'var(--brand)' : 'var(--bg-tertiary)' }} />
              )}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {step === 1 ? "Create your account" : step === 2 ? "Choose your plan" : "Set up your workspace"}
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                {step === 1 
                  ? (formData.accountType === 'company' ? "Start building with your team" : "Start with a free account") 
                  : step === 2 
                    ? "Select the plan that fits your needs" 
                    : "Where your team will collaborate"}
              </p>
            </div>

            {step === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Account type</label>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, accountType: 'user' }))}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: formData.accountType === 'user' ? 'var(--brand)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: formData.accountType === 'user' ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, accountType: 'company' }))}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: formData.accountType === 'company' ? 'var(--brand)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: formData.accountType === 'company' ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Company
                    </button>
                  </div>
                  {errors.accountType && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.accountType}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Full name</label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="First&Last name"
                    value={formData.fullName}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                  />
                  {errors.fullName && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.fullName}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Work email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                  />
                  {errors.email && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.email}</p>}
                </div>
                <div>
                  <label style={{ display: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="••••••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      style={{ ...inputStyle, paddingRight: '48px' }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.password}</p>}
                </div>
                <button type="button" onClick={handleNext} className="btn btn-primary" style={{ width: '100%', padding: '14px 24px', fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>
                  Continue <ArrowRight className="w-5 h-5" />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Or</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>

                <button type="button" onClick={handleGoogleSignup} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px 24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            ) : step === 2 ? (
              /* Tier Selection Step */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(['free', 'base', 'pro'] as TierType[]).map((tier) => {
                  const tierInfo = TIER_DISPLAY[tier];
                  const isSelected = formData.tier === tier;
                  const isHighlighted = tierInfo.highlight;
                  
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => handleTierSelect(tier)}
                      style={{
                        position: 'relative',
                        padding: '20px',
                        background: isSelected ? 'var(--brand)' : 'var(--bg-secondary)',
                        border: isHighlighted ? '2px solid var(--brand)' : '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isHighlighted && (
                        <span style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '16px',
                          padding: '4px 12px',
                          background: 'var(--brand)',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'white',
                          textTransform: 'uppercase',
                        }}>
                          Most Popular
                        </span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-primary)', marginBottom: '4px' }}>
                            {tierInfo.name}
                          </h3>
                          <p style={{ fontSize: '13px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                            {tierInfo.description}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '24px', fontWeight: 700, color: isSelected ? 'white' : 'var(--text-primary)' }}>
                            {tierInfo.price}
                          </span>
                          <span style={{ fontSize: '13px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                            {tierInfo.period}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {tierInfo.features.slice(0, 4).map((feature) => (
                          <span key={feature} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: isSelected ? 'white' : 'var(--text-secondary)',
                          }}>
                            <Check className="w-3 h-3" />
                            {feature}
                          </span>
                        ))}
                      </div>
                      {tierInfo.limitations.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {tierInfo.limitations.map((limitation) => (
                            <span key={limitation} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              background: isSelected ? 'rgba(255,255,255,0.1)' : 'var(--bg-tertiary)',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                            }}>
                              <X className="w-3 h-3" />
                              {limitation}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handleTierSelect('enterprise')}
                  style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Crown className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Enterprise</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>Custom pricing for large teams</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>

                <button type="button" onClick={() => setStep(1)} style={{
                  padding: '12px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>
                  ← Back to account details
                </button>
              </div>
            ) : (
              /* Step 3: Company Details */
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Selected plan summary */}
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Selected Plan</p>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {TIER_DISPLAY[formData.tier].name} - {TIER_DISPLAY[formData.tier].price}{TIER_DISPLAY[formData.tier].period}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setStep(2)}
                    style={{ fontSize: '14px', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Company name</label>
                  <input
                    type="text"
                    name="companyName"
                    placeholder="Acme Inc"
                    value={formData.companyName}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                  />
                  {errors.companyName && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.companyName}</p>}
                </div>
                {/* Only show subdomain field for Pro tier (white-label) */}
                {formData.tier === 'pro' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Custom Workspace URL
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>(White-label feature)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <input
                        type="text"
                        name="subdomain"
                        placeholder="acme"
                        value={formData.subdomain}
                        onChange={handleChange}
                        style={{ ...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                      />
                      <span style={{ padding: '14px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderLeft: 'none', borderTopRightRadius: '12px', borderBottomRightRadius: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>.tynebase.com</span>
                    </div>
                    {errors.subdomain && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.subdomain}</p>}
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Your workspace will be accessible at this custom URL
                    </p>
                  </div>
                )}
                
                {/* Info for Free/Base tiers */}
                {(formData.tier === 'free' || formData.tier === 'base') && (
                  <div style={{ 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '12px', 
                    padding: '12px 16px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>Note:</span> Your workspace URL will be auto-generated. 
                      Upgrade to Pro for custom domain and white-label branding.
                    </p>
                  </div>
                )}

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Your {TIER_DISPLAY[formData.tier].name} plan includes:
                  </p>
                  {TIER_DISPLAY[formData.tier].features.map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      {item}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setStep(2)} className="btn btn-secondary" style={{ flex: 1, padding: '14px 24px' }}>
                    Back
                  </button>
                  <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ flex: 1, padding: '14px 24px' }}>
                    {isLoading ? "Creating..." : "Create workspace"}
                  </button>
                </div>
              </form>
            )}

            <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: 'var(--brand)', fontWeight: 500 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="signup" />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { signup } from "@/lib/api/auth";
import { validateSubdomain } from "@/lib/utils";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";

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
    if (formData.accountType === 'company' && !validateSubdomain(formData.subdomain)) newErrors.subdomain = "Invalid subdomain format";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      // Skip step 2 if user selected individual account
      if (formData.accountType === 'user') {
        handleSubmit();
      } else {
        setStep(2);
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate based on account type
    const isValid = formData.accountType === 'user' ? validateStep1() : validateStep2();
    if (!isValid) return;
    
    setIsLoading(true);

    try {
      // For individual accounts, use email username as subdomain
      // For company accounts, use the provided subdomain
      const tenantName = formData.accountType === 'company' 
        ? formData.companyName 
        : formData.fullName || formData.email.split('@')[0];
      
      const subdomain = formData.accountType === 'company'
        ? formData.subdomain
        : formData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

      const response = await signup({
        email: formData.email,
        password: formData.password,
        tenant_name: tenantName,
        subdomain: subdomain,
        full_name: formData.fullName,
      });

      addToast({
        type: "success",
        title: "Account created!",
        description: `Welcome to TyneBase! Redirecting to dashboard...`,
      });
      
      // Redirect to dashboard after successful signup
      router.push("/dashboard");
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Signup failed",
        description: error.message || "Failed to create account. Please try again.",
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
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {step === 1 ? "Create your account" : "Set up your workspace"}
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                {step === 1 ? (formData.accountType === 'company' ? "Start with a Pro subscription if you choose company" : "Start with a free account") : "Where your team will collaborate"}
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
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Workspace URL</label>
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
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Your free trial includes:</p>
                  {["Full access to all features", "Up to 10 team members", "AI document generation", "Priority support"].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      {item}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1, padding: '14px 24px' }}>
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

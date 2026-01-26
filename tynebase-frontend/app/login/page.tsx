"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { login } from "@/lib/api/auth";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const redirect = searchParams.get("redirect") || "/dashboard";

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call backend API to login
      const response = await login({ email, password });

      addToast({
        type: "success",
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });

      // Redirect to dashboard
      // The login() function already stored the JWT token and tenant subdomain
      router.push(redirect);
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Login failed",
        description: error.message || "Invalid email or password.",
      });
    } finally {
      setIsLoading(false);
    }
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
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Welcome back
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                Sign in to your account
              </p>
            </div>

            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--brand)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-subtle)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <Link href="/auth/reset-password" style={{ fontSize: '13px', color: 'var(--brand)' }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '14px 48px 14px 16px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--brand)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-subtle)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px'
                    }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px 24px', fontSize: '15px', fontWeight: 600, marginTop: '8px' }}
              >
                {isLoading ? "Signing in..." : "Sign In"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>


            <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Don't have an account?{" "}
              <Link href="/signup" style={{ color: 'var(--brand)', fontWeight: 500 }}>
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="login" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="text-sm text-[var(--text-secondary)]">Loading…</div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

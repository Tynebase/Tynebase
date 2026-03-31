"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { login } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/client";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowRight, Eye, EyeOff, AlertCircle, UserX, Plus } from "lucide-react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAccountDeletedModal, setShowAccountDeletedModal] = useState(false);
  const [deletedEmail, setDeletedEmail] = useState("");

  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");

  // Handle error redirects from auth callback
  useEffect(() => {
    if (errorParam === 'account_deleted') {
      setShowAccountDeletedModal(true);
    } else if (errorParam === 'invite_expired') {
      setErrorMessage(messageParam || 'This invitation link has expired. Please ask the workspace admin to resend the invite.');
      setShowErrorModal(true);
    } else if (errorParam && messageParam) {
      setErrorMessage(decodeURIComponent(messageParam));
      setShowErrorModal(true);
    }
  }, [errorParam, messageParam]);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    if (!supabase) {
      setErrorMessage('Authentication is not configured.');
      setShowErrorModal(true);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setErrorMessage(error.message);
      setShowErrorModal(true);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call backend API to login
      await login({ email, password });

      addToast({
        type: "success",
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });

      // Small delay to ensure tokens are stored before redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to dashboard - use window.location for hard redirect
      window.location.href = redirect;
    } catch (error: any) {
      // Check for specific error codes from the API
      const errorCode = error?.code;
      
      if (errorCode === 'ACCOUNT_DELETED') {
        setDeletedEmail(email);
        setShowAccountDeletedModal(true);
      } else if (errorCode === 'ACCOUNT_SUSPENDED') {
        setErrorMessage('Your account has been suspended. Please contact your workspace administrator.');
        setShowErrorModal(true);
      } else {
        const message = error?.message || "Invalid email or password.";
        setErrorMessage(message);
        setShowErrorModal(true);
      }
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

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: 500,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Don't have an account?{" "}
              <Link href="/signup" style={{ color: 'var(--brand)', fontWeight: 500 }}>
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="login" />

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        size="sm"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--status-error-bg)',
              flexShrink: 0
            }}>
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--status-error)' }} />
            </div>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Login Failed
            </h3>
          </div>
          <p style={{ 
            fontSize: '15px', 
            color: 'var(--text-secondary)', 
            lineHeight: 1.5
          }}>
            {errorMessage}
          </p>
          <button
            onClick={() => setShowErrorModal(false)}
            className="btn btn-primary"
            style={{ 
              marginTop: '24px',
              padding: '12px 32px',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Try Again
          </button>
        </div>
      </Modal>

      {/* Account Deleted Modal */}
      <Modal
        isOpen={showAccountDeletedModal}
        onClose={() => setShowAccountDeletedModal(false)}
        title="Account Removed"
        size="sm"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            marginBottom: '16px'
          }}>
            <UserX className="w-7 h-7" style={{ color: '#ef4444' }} />
          </div>
          <p style={{ 
            fontSize: '15px', 
            color: 'var(--text-primary)', 
            marginBottom: '8px',
            fontWeight: 500
          }}>
            Your account has been removed
          </p>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-secondary)',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            You were removed from your previous workspace. You can create a new workspace to continue using TyneBase, or wait to be invited to another workspace.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              href={`/signup?email=${encodeURIComponent(deletedEmail)}`}
              className="btn btn-primary"
              style={{ 
                padding: '12px 32px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Plus className="w-4 h-4" />
              Create New Workspace
            </Link>
            <button
              onClick={() => setShowAccountDeletedModal(false)}
              className="btn btn-secondary"
              style={{ 
                padding: '12px 32px',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
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

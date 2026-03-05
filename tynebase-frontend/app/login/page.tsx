"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { login } from "@/lib/api/auth";
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

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Login Failed"
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
            background: 'var(--status-error-bg)',
            marginBottom: '16px'
          }}>
            <AlertCircle className="w-7 h-7" style={{ color: 'var(--status-error)' }} />
          </div>
          <p style={{ 
            fontSize: '15px', 
            color: 'var(--text-primary)', 
            marginBottom: '8px',
            fontWeight: 500
          }}>
            {errorMessage}
          </p>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-secondary)'
          }}>
            Please check your credentials and try again.
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

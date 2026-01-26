"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase?.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      }) || { error: new Error("Failed to connect") };

      if (error) throw error;

      setEmailSent(true);
      addToast({
        type: "success",
        title: "Reset link sent!",
        description: "Check your email for the password reset link.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to send reset link",
        description: error instanceof Error ? error.message : "An error occurred",
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
            {!emailSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--brand)', opacity: 0.1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                    <Mail style={{ width: '32px', height: '32px', color: 'var(--brand)' }} />
                  </div>
                  <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Reset your password
                  </h1>
                  <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                    Enter your email and we'll send you a reset link
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px 24px', fontSize: '15px', fontWeight: 600 }}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                  <Mail style={{ width: '32px', height: '32px', color: '#22c55e' }} />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Check your email
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  We've sent a password reset link to<br />
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="btn btn-secondary"
                  style={{ padding: '12px 24px' }}
                >
                  Send another link
                </button>
                <div style={{ marginTop: '24px' }}>
                  <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter currentPage="reset-password" />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowRight, Lock, Eye, EyeOff, Check } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      addToast({
        type: "error",
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
      });
      return;
    }

    if (password.length < 8) {
      addToast({
        type: "error",
        title: "Password too short",
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase?.auth.updateUser({
        password: password,
      }) || { error: new Error("Failed to connect") };

      if (error) throw error;

      addToast({
        type: "success",
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });
      router.push("/login");
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to update password",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
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
      <div className="grid-overlay" />

      <SiteNavbar currentPage="other" />

      {/* Centered Modal Container */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ marginTop: '80px' }}>
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
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255, 77, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                <Lock style={{ width: '32px', height: '32px', color: 'var(--brand)' }} />
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Set new password
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                Choose a strong password for your account
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ ...inputStyle, paddingRight: '48px' }}
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

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Confirm new password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--brand)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 77, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-subtle)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {password && confirmPassword && password === confirmPassword && (
                  <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginTop: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Password requirements:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: password.length >= 8 ? '#22c55e' : 'var(--text-muted)' }}>
                  <Check className="w-4 h-4" />
                  At least 8 characters
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px 24px', fontSize: '15px', fontWeight: 600, marginTop: '8px' }}
              >
                {isLoading ? "Updating..." : "Update Password"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Remember your password?{" "}
              <Link href="/login" style={{ color: 'var(--brand)', fontWeight: 500 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="update-password" />
    </div>
  );
}

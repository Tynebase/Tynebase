"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { login } from "@/lib/api/auth";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowRight, Eye, EyeOff, LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CommunityLoginPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subdomain, setSubdomain] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const parts = hostname.split(".");
      if (parts.length >= 3 && parts[0] !== "www") {
        setSubdomain(parts[0]);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast({ type: "error", title: "Error", description: "Please fill in all fields" });
      return;
    }

    setIsLoading(true);
    try {
      await login({ email, password });

      addToast({ type: "success", title: "Welcome back!", description: "Redirecting to the community hub..." });
      setTimeout(() => {
        router.push("/community");
      }, 1000);
    } catch (error) {
      addToast({
        type: "error",
        title: "Login failed",
        description: error instanceof Error ? error.message : "Please check your credentials.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    if (!supabase) {
      addToast({ type: "error", title: "Error", description: "Authentication is not configured." });
      return;
    }

    const currentSubdomain = subdomain || "main";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/community/join/finalize&subdomain=${currentSubdomain}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      addToast({ type: "error", title: "Error", description: error.message });
    }
  };

  const inputClasses = "w-full pl-11 pr-4 py-3 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] rounded-xl text-[15px] outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";

  return (
    <div className="min-h-screen relative flex flex-col bg-[var(--surface-ground)]">
      <SiteNavbar currentPage="other" />

      <div className="flex-1 flex items-center justify-center px-4 py-12" style={{ marginTop: '80px' }}>
        <div className="w-full max-w-[440px]">
          <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-[24px] p-8 md:p-10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[var(--brand)]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-[var(--brand)]" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Welcome Back</h1>
              <p className="text-[var(--text-secondary)]">
                Sign in to your {subdomain ? <span className="text-[var(--brand)] font-semibold">{subdomain}</span> : "account"} community profile
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-tertiary)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClasses}
                  placeholder="Email address"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-tertiary)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClasses} pr-12`}
                  placeholder="Your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" title="Forgot password" className="text-xs text-[var(--brand)] hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[var(--brand)] hover:brightness-110 text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--brand)]/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
              >
                {isLoading ? "Signing in..." : "Sign In"}
                {!isLoading && <ArrowRight className="w-4.5 h-4.5" />}
              </button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              <span className="text-xs text-[var(--text-tertiary)] uppercase font-medium tracking-wider">or</span>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-12 flex items-center justify-center gap-3 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--brand)]/30 rounded-xl text-[var(--text-primary)] font-medium transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                New to the community?{" "}
                <Link href="/community/signup" className="text-[var(--brand)] font-medium hover:underline">
                  Create a contributor account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="other" />
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Shield, Users } from "lucide-react";
import { acceptInvite, getInvite, WorkspaceRole } from "@/lib/api/invites";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

interface InviteData {
  inviteId?: string;
  userId?: string;
  email: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  role: WorkspaceRole;
  invitedBy: string;
}

function normalizeInviteRole(role?: string): WorkspaceRole {
  if (role === "admin" || role === "editor" || role === "viewer" || role === "community_contributor" || role === "community_admin") {
    return role;
  }

  return role === "member" ? "editor" : "viewer";
}

function buildInviteLoginHref(inviteId?: string, existingInvite?: boolean): string {
  if (!inviteId) {
    return "/login";
  }

  const redirect = `/auth/accept-invite?invite=${inviteId}${existingInvite ? "&existing=1" : ""}`;
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const inviteIdParam = searchParams.get("invite");
  const dataParam = searchParams.get("data");
  const existingInviteParam = searchParams.get("existing") === "1";

  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "no_session" | "ready" | "error" | "success">("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const acceptCurrentInvite = async (inviteToAccept: InviteData) => {
    const response = await acceptInvite(
      inviteToAccept.inviteId
        ? {
            invite_id: inviteToAccept.inviteId,
            full_name: fullName.trim() || undefined,
            password: password || undefined,
          }
        : {
            user_id: inviteToAccept.userId!,
            tenant_id: inviteToAccept.tenantId,
            role: inviteToAccept.role,
            full_name: fullName.trim() || undefined,
            password: password || undefined,
          }
    );

    setTenantSubdomain(response.tenant.subdomain);

    // If a password was set, sign in with it to establish a full cookie session
    if (password && inviteToAccept.email) {
      // Small delay to ensure backend has finished setting the password
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const supabase = createClient();
      if (supabase) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: inviteToAccept.email,
          password,
        });
        
        if (signInError) {
          console.error('[AcceptInvite] Auto sign-in failed:', signInError.message);
          // Don't block the flow - user can still log in manually
        } else if (signInData?.session) {
          console.log('[AcceptInvite] Auto sign-in successful');
          setAuthTokens(signInData.session.access_token, signInData.session.refresh_token);
        }
      }
    }

    addToast({
      type: "success",
      title: "Welcome to the team!",
      description: `You've joined ${response.tenant.name}`,
    });

    setStatus("success");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  };

  const handleAcceptError = (error: any, inviteToAccept: InviteData, fromAutoAccept = false) => {
    console.error('Failed to accept invite:', error);

    if (error.code === 'USER_EXISTS') {
      if (inviteToAccept.tenantSubdomain) {
        setTenantSubdomain(inviteToAccept.tenantSubdomain);
      }
      setStatus("success");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
      return;
    }

    if (error.code === 'INVALID_INVITE' || error.code === 'INVITE_NOT_FOUND') {
      setStatus("invalid");
      return;
    }

    if (fromAutoAccept && (error.code === 'INVITE_EMAIL_MISMATCH' || error.code === 'INVITE_USER_MISMATCH')) {
      setErrors({
        submit: `This invitation was sent to ${inviteToAccept.email}. Please sign in with that account to continue.`,
      });
      setStatus("error");
      return;
    }

    setErrors({ submit: error.message || 'Failed to accept invitation. Please try again.' });
    if (fromAutoAccept) {
      setStatus("error");
    }
  };

  useEffect(() => {
    async function initInvite() {
      try {
        let resolvedInvite: InviteData | null = null;

        if (inviteIdParam) {
          const response = await getInvite(inviteIdParam);
          resolvedInvite = {
            inviteId: response.invite.id,
            email: response.invite.email,
            tenantId: response.invite.tenant.id,
            tenantName: response.invite.tenant.name,
            tenantSubdomain: response.invite.tenant.subdomain,
            role: response.invite.role,
            invitedBy: response.invite.invited_by,
          };
        } else if (dataParam) {
          const decoded = JSON.parse(decodeURIComponent(dataParam)) as Partial<InviteData> & { role?: string };
          if (!decoded.userId || !decoded.tenantId || !decoded.role) {
            setStatus("invalid");
            return;
          }

          resolvedInvite = {
            inviteId: decoded.inviteId,
            userId: decoded.userId,
            email: decoded.email || "",
            tenantId: decoded.tenantId,
            tenantName: decoded.tenantName || "Workspace",
            tenantSubdomain: decoded.tenantSubdomain || "",
            role: normalizeInviteRole(decoded.role),
            invitedBy: decoded.invitedBy || "A workspace admin",
          };
        } else {
          setStatus("invalid");
          return;
        }

        let hasSession = false;

        // Check Supabase session first
        const supabase = createClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token && session?.refresh_token) {
            setAuthTokens(session.access_token, session.refresh_token);
            hasSession = true;
          }
        }

        // Fallback: check localStorage tokens (set by login page)
        if (!hasSession) {
          const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
          const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
          if (storedToken && storedRefresh) {
            hasSession = true;
          }
        }

        if (hasSession) {
          setInvite(resolvedInvite);

          if (existingInviteParam && resolvedInvite.inviteId) {
            setStatus("loading");
            setErrors({});

            try {
              await acceptCurrentInvite(resolvedInvite);
            } catch (error: any) {
              handleAcceptError(error, resolvedInvite, true);
            }
            return;
          }

          setStatus("ready");
        } else {
          setInvite(resolvedInvite);
          setStatus("no_session");
        }
      } catch {
        setStatus("invalid");
      }
    }
    initInvite();
  }, [dataParam, inviteIdParam, existingInviteParam]);

  useEffect(() => {
    if (status !== "no_session" || !existingInviteParam || !invite?.inviteId) {
      return;
    }

    const loginHref = buildInviteLoginHref(invite.inviteId, true);
    const redirectTimeout = window.setTimeout(() => {
      window.location.replace(loginHref);
    }, 250);

    return () => {
      window.clearTimeout(redirectTimeout);
    };
  }, [existingInviteParam, invite?.inviteId, status]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (password && password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (password && !confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invite) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await acceptCurrentInvite(invite);
    } catch (error: any) {
      handleAcceptError(error, invite);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="hero-gradient" />
      <div className="grid-overlay" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/">
            <Image src="/logo.png" alt="TyneBase" width={140} height={36} className="h-9 w-auto mx-auto" />
          </Link>
        </div>

        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-xl">
          {status === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--brand)] animate-spin" />
              <p className="text-[var(--text-secondary)]">Validating invitation...</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Invalid Invitation
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                This invitation link is invalid or has already been used.
              </p>
              <Link href="/login">
                <Button variant="primary">Go to Login</Button>
              </Link>
            </div>
          )}

          {status === "no_session" && invite && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                {existingInviteParam ? "Redirecting to sign in" : "Session Expired"}
              </h2>
              <p className="text-[var(--text-secondary)] mb-2">
                {existingInviteParam ? (
                  <>
                    This invitation was sent to <strong className="text-[var(--text-primary)]">{invite.email}</strong>. Sign in with that account and we&apos;ll finish joining <strong className="text-[var(--text-primary)]">{invite.tenantName}</strong> automatically.
                  </>
                ) : (
                  <>
                    Your invitation to <strong className="text-[var(--text-primary)]">{invite.tenantName}</strong> is valid, but your session has expired.
                  </>
                )}
              </p>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                {existingInviteParam
                  ? "If nothing happens, continue to the login page below."
                  : "Please log in to the account that matches this invite to continue."}
              </p>
              {errors.submit && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  {errors.submit}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Link href={buildInviteLoginHref(invite.inviteId, existingInviteParam)}>
                  <Button variant="primary" className="w-full">{existingInviteParam ? "Continue to Login" : "Go to Login"}</Button>
                </Link>
              </div>
            </div>
          )}

          {status === "error" && invite && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Couldn&apos;t accept this invitation
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                {errors.submit || 'There was a problem completing this invitation. Please try again.'}
              </p>
              <div className="flex flex-col gap-3">
                <Link href={buildInviteLoginHref(invite.inviteId, existingInviteParam)}>
                  <Button variant="primary" className="w-full">Continue</Button>
                </Link>
              </div>
            </div>
          )}

          {status === "ready" && invite && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-[var(--brand)]" />
                </div>
                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                  Join {invite.tenantName}
                </h2>
                <p className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{invite.invitedBy || 'A workspace admin'}</span> has invited you to collaborate
                </p>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Email</span>
                  <span className="text-[var(--text-primary)] font-medium">{invite.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-[var(--text-secondary)]">Role</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-500 rounded-full capitalize">
                    {invite.role}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className={inputClasses}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Set Password
                    <span className="text-[var(--text-muted)] font-normal ml-1">(for future logins)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '', confirmPassword: '' })); }}
                      placeholder="At least 8 characters"
                      className={`${inputClasses} pr-11 ${errors.password ? 'border-red-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                {password && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                      placeholder="Confirm your password"
                      className={`${inputClasses} ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                )}

                {errors.submit && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {errors.submit}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-3"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining workspace...
                    </>
                  ) : (
                    "Accept & Join Workspace"
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
                By accepting, you agree to our{" "}
                <Link href="/terms" className="text-[var(--brand)] hover:underline">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-[var(--brand)] hover:underline">Privacy Policy</Link>
              </p>
            </>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Welcome to the Team!
              </h2>
              <p className="text-[var(--text-secondary)] mb-4">
                You've successfully joined {invite?.tenantName || 'the workspace'}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to dashboard...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}

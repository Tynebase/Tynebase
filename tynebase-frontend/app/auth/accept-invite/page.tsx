"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { acceptInvite } from "@/lib/api/invites";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";

interface InviteData {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  role: 'admin' | 'editor' | 'member' | 'viewer';
  invitedBy: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const dataParam = searchParams.get("data");
  
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "expired" | "ready" | "success">("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!dataParam) {
      setStatus("invalid");
      return;
    }
    
    try {
      const decoded = JSON.parse(decodeURIComponent(dataParam)) as InviteData;
      if (!decoded.userId || !decoded.tenantId || !decoded.role) {
        setStatus("invalid");
        return;
      }
      setInvite(decoded);
      setStatus("ready");
    } catch {
      setStatus("invalid");
    }
  }, [dataParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invite) return;
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const response = await acceptInvite({
        user_id: invite.userId,
        tenant_id: invite.tenantId,
        role: invite.role,
        full_name: fullName.trim() || undefined,
      });
      
      // Set tenant subdomain for future API calls
      setTenantSubdomain(response.tenant.subdomain);
      
      addToast({
        type: "success",
        title: "Welcome to the team!",
        description: `You've joined ${response.tenant.name}`,
      });
      
      setStatus("success");
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error('Failed to accept invite:', error);
      setErrors({ submit: error.message || 'Failed to accept invitation' });
      addToast({
        type: "error",
        title: "Failed to accept invite",
        description: error.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

          {status === "expired" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Invitation Expired
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                This invitation has expired. Please request a new one from your administrator.
              </p>
              <Link href="/login">
                <Button variant="primary">Go to Login</Button>
              </Link>
            </div>
          )}

          {status === "ready" && invite && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                  You're Invited!
                </h2>
                <p className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{invite.invitedBy}</span> has invited you to join
                </p>
                <p className="text-lg font-medium text-[var(--brand)] mt-1">{invite.tenantName}</p>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Email</span>
                  <span className="text-[var(--text-primary)]">{invite.email}</span>
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
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                  />
                </div>

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
                      Joining...
                    </>
                  ) : (
                    "Accept Invitation"
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
                You've successfully joined {invite?.tenantName || 'the team'}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Redirecting to dashboard...
              </p>
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

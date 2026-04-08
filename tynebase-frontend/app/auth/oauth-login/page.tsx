"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

function OAuthLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirect = searchParams.get("redirect") || "/dashboard";

    async function finishOAuthLogin() {
      const supabase = createClient();
      if (!supabase) {
        router.replace("/login?error=auth_failed");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session?.access_token) {
        router.replace(
          "/login?error=auth_failed&message=" +
            encodeURIComponent("Session not found. Please try signing in again.")
        );
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      try {
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error?.code;
          if (code === "ACCOUNT_DELETED") {
            router.replace("/login?error=account_deleted");
          } else if (code === "ACCOUNT_SUSPENDED") {
            router.replace("/login?error=account_suspended");
          } else {
            router.replace("/login?error=auth_failed");
          }
          return;
        }

        const result = await res.json();
        const tenant = result?.data?.tenant;

        setAuthTokens(session.access_token, session.refresh_token || "");
        if (tenant?.subdomain) {
          setTenantSubdomain(tenant.subdomain);
        }

        window.location.href = redirect;
      } catch {
        router.replace("/login?error=auth_failed");
      }
    }

    finishOAuthLogin();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

export default function OAuthLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <OAuthLoginContent />
    </Suspense>
  );
}

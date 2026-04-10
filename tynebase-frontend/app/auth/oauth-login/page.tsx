"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

function OAuthLoginContent() {
  const router = useRouter();

  useEffect(() => {
    // Tokens are passed via URL fragment (#t=<base64url>) — fragments are never
    // sent to servers or logged, and bypass all cross-site cookie restrictions.
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const raw = params.get("t");

    if (!raw) {
      router.replace(
        "/login?error=auth_failed&message=" +
          encodeURIComponent("Session not found. Please try signing in again.")
      );
      return;
    }

    let parsed: {
      access_token?: string;
      refresh_token?: string;
      redirect?: string;
    };

    try {
      // base64url → base64 → JSON
      parsed = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      router.replace("/login?error=auth_failed");
      return;
    }

    const { access_token, refresh_token, redirect = "/dashboard" } = parsed;

    if (!access_token) {
      router.replace("/login?error=auth_failed");
      return;
    }

    async function finalize() {
      // Store tokens in localStorage + cookies so the app's auth helpers work
      setAuthTokens(access_token!, refresh_token || "");

      // Fetch tenant info from the backend using the Supabase access token
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      try {
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error?.code;
          // If they are accepting an invite, bypass suspension/deletion checks
          // because accepting the invite might restore their access or move them to a new workspace.
          if (redirect && redirect.includes("accept-invite")) {
            window.location.replace(redirect);
            return;
          }

          if (code === "ACCOUNT_DELETED") {
            router.replace("/login?error=account_deleted");
          } else if (code === "ACCOUNT_SUSPENDED") {
            router.replace("/login?error=account_suspended");
          } else {
            // User may not have completed signup yet
            window.location.replace("/auth/complete-signup");
          }
          return;
        }

        const result = await res.json();
        const tenant = result?.data?.tenant;
        if (tenant?.subdomain) {
          setTenantSubdomain(tenant.subdomain);
        }
      } catch {
        // Network error — proceed anyway, dashboard will re-validate
      }

      window.location.replace(redirect!);
    }

    finalize();
  }, [router]);

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

"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

function OAuthLoginContent() {
  const router = useRouter();

  useEffect(() => {
    // Tokens are passed via URL fragment (#t=<base64url>) to avoid cookie
    // cross-site restrictions (e.g. Firefox Total Cookie Protection).
    // Fragments are never sent to the server and never logged.
    const hash = window.location.hash.slice(1); // remove leading '#'
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
      tenant_subdomain?: string;
      redirect?: string;
    };

    try {
      parsed = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      router.replace("/login?error=auth_failed");
      return;
    }

    const { access_token, refresh_token, tenant_subdomain, redirect = "/dashboard" } = parsed;

    if (!access_token) {
      router.replace("/login?error=auth_failed");
      return;
    }

    setAuthTokens(access_token, refresh_token || "");
    if (tenant_subdomain) {
      setTenantSubdomain(tenant_subdomain);
    }

    // Use replace to avoid the oauth-login page appearing in browser history
    window.location.replace(redirect);
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

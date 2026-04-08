"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function OAuthLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirect = searchParams.get("redirect") || "/dashboard";

    const accessToken = getCookie("access_token");
    const refreshToken = getCookie("refresh_token");
    const tenantSubdomain = getCookie("tenant_subdomain");

    if (!accessToken) {
      // Tokens not present — send back to login
      router.replace(
        "/login?error=auth_failed&message=" +
          encodeURIComponent("Session not found. Please try signing in again.")
      );
      return;
    }

    // Sync server-set cookies into localStorage so the app's auth helpers can read them
    setAuthTokens(accessToken, refreshToken || "");
    if (tenantSubdomain) {
      setTenantSubdomain(tenantSubdomain);
    }

    window.location.href = redirect;
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

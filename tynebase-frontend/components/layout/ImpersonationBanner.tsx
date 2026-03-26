"use client";

import { useState, useEffect } from "react";
import { Shield, X, LogOut } from "lucide-react";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = localStorage.getItem("impersonating");
    const name = localStorage.getItem("impersonating_tenant_name");
    if (flag === "true") {
      setIsImpersonating(true);
      setTenantName(name || "Unknown Workspace");
    }
  }, []);

  const handleExitImpersonation = () => {
    const saAccess = localStorage.getItem("sa_access_token");
    const saRefresh = localStorage.getItem("sa_refresh_token");
    const saSubdomain = localStorage.getItem("sa_tenant_subdomain");

    if (saAccess && saRefresh) {
      setAuthTokens(saAccess, saRefresh);
      if (saSubdomain) {
        setTenantSubdomain(saSubdomain);
      }
    }

    // Clean up impersonation state
    localStorage.removeItem("impersonating");
    localStorage.removeItem("impersonating_tenant_name");
    localStorage.removeItem("sa_access_token");
    localStorage.removeItem("sa_refresh_token");
    localStorage.removeItem("sa_tenant_subdomain");

    window.location.href = "/dashboard/admin";
  };

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <Shield className="w-4 h-4 flex-shrink-0" />
      <span>
        Super Admin Mode — Working in <strong>{tenantName}</strong>
      </span>
      <button
        onClick={handleExitImpersonation}
        className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-black/20 hover:bg-black/30 rounded-md text-xs font-semibold transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Exit Workspace
      </button>
    </div>
  );
}

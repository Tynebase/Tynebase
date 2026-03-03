"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import type { Tenant, TierType } from "@/types/api";
import { TIER_CONFIG } from "@/types/api";

interface TenantBranding {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  company_name?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  isLoading: boolean;
  subdomain: string | null;
  tierConfig: (typeof TIER_CONFIG)[TierType] | null;
  canUseFeature: (feature: 'whiteLabel' | 'customDomain' | 'aiFeatures' | 'collaboration' | 'prioritySupport') => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { tenant: authTenant, isLoading: authLoading } = useAuth();
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);

  // Extract subdomain from hostname or resolve from custom domain
  useEffect(() => {
    const hostname = window.location.hostname;
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tynebase.com";
    
    const parts = hostname.split(".");
    const baseParts = baseDomain.split(".");
    
    let extractedSubdomain: string | null = null;
    if (parts.length > baseParts.length) {
      extractedSubdomain = parts.slice(0, parts.length - baseParts.length).join(".");
    }
    
    // Also check localStorage for subdomain (set during login/signup)
    if (!extractedSubdomain || extractedSubdomain === "www") {
      extractedSubdomain = localStorage.getItem("tenant_subdomain");
    }

    // Custom domain fallback: if no subdomain found, check cookie set by middleware
    if (!extractedSubdomain) {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const domainCookie = cookies.find(c => c.startsWith("x-custom-domain="));
      if (domainCookie) {
        const customDomain = domainCookie.split("=")[1];
        if (customDomain) {
          // Resolve tenant subdomain from custom domain via API
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
          fetch(`${baseUrl}/api/public/tenant-by-domain?domain=${encodeURIComponent(customDomain)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              const resolved = data?.data?.tenant?.subdomain;
              if (resolved) {
                localStorage.setItem("tenant_subdomain", resolved);
                setSubdomain(resolved);
              }
            })
            .catch(() => {});
          return; // Don't set subdomain yet — async resolution in progress
        }
      }
    }
    
    setSubdomain(extractedSubdomain);
  }, []);

  // Update branding when tenant changes
  useEffect(() => {
    if (authTenant?.settings?.branding) {
      setBranding({
        primary_color: authTenant.settings.branding.primary_color || "#E85002",
        secondary_color: authTenant.settings.branding.secondary_color,
        logo_url: authTenant.settings.branding.logo_url,
        company_name: authTenant.name,
      });
    } else if (authTenant) {
      setBranding({
        primary_color: "#E85002",
        company_name: authTenant.name,
      });
    }
  }, [authTenant]);

  // Apply branding CSS variables
  useEffect(() => {
    if (branding?.primary_color) {
      document.documentElement.style.setProperty("--brand", branding.primary_color);
      document.documentElement.style.setProperty("--brand-primary", branding.primary_color);
    }
  }, [branding]);

  // Get current tier configuration
  const tierConfig = authTenant?.tier ? TIER_CONFIG[authTenant.tier as TierType] : null;

  // Check if a feature is available for current tier
  const canUseFeature = (feature: 'whiteLabel' | 'customDomain' | 'aiFeatures' | 'collaboration' | 'prioritySupport'): boolean => {
    if (!tierConfig) return false;
    return tierConfig[feature] === true;
  };

  return (
    <TenantContext.Provider value={{ 
      tenant: authTenant, 
      branding, 
      isLoading: authLoading, 
      subdomain,
      tierConfig,
      canUseFeature,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout, isAuthenticated } from "@/lib/api/auth";
import { setTenantSubdomain, clearAuth } from "@/lib/api/client";
import type { User, Tenant } from "@/types/api";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      console.log('[AuthContext] Fetching user session...');
      if (!isAuthenticated()) {
        console.log('[AuthContext] No session found (localStorage/cookies empty).');
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }
 
      const response = await getMe();
      console.log('[AuthContext] Session found for user:', response.user.id, 'Role:', response.user.role);
      setUser(response.user);
      setTenant(response.tenant);
      
      // Sync tenant_subdomain in localStorage if it changed (e.g. user moved to new tenant)
      if (response.tenant?.subdomain) {
        const storedSubdomain = localStorage.getItem('tenant_subdomain');
        const urlSubdomain = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : null;

        // If we land on a subdomain and they are a member, ensure the context matches
        if (urlSubdomain && urlSubdomain !== 'www' && urlSubdomain !== response.tenant.subdomain) {
          console.warn('[AuthContext] Context mismatch! URL Subdomain:', urlSubdomain, 'but Primary Tenant:', response.tenant.subdomain);
          // We don't force a switch here, but we should be aware
        }

        if (storedSubdomain !== response.tenant.subdomain) {
          setTenantSubdomain(response.tenant.subdomain);
        }
      }
    } catch (error: any) {
      console.error("[AuthContext] Failed to fetch user:", error);
      
      const errorCode = error?.code || error?.statusCode;
      
      // If the profile is simply missing for this tenant, we are a guest but STILL authenticated in Supabase.
      // We don't clear the session because the user might want to join the community.
      if (error?.code === 'PROFILE_NOT_FOUND') {
        console.log('[AuthContext] Profile not found. User is a guest with a valid Supabase token.');
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // If account was deleted or suspended, clear everything and redirect to login
      if (errorCode === 'ACCOUNT_DELETED' || errorCode === 'ACCOUNT_SUSPENDED') {
        clearAuth();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/auth/')) {
          window.location.href = `/login?error=${errorCode === 'ACCOUNT_DELETED' ? 'account_deleted' : 'account_suspended'}`;
        }
      }
      
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signOut = async () => {
    await logout();
    setUser(null);
    setTenant(null);
  };

  const refreshUser = async () => {
    setIsLoading(true);
    await fetchUser();
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        tenant, 
        isLoading, 
        isAuthenticated: !!user,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

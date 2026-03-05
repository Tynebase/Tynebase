"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout, isAuthenticated } from "@/lib/api/auth";
import { setTenantSubdomain } from "@/lib/api/client";
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
      if (!isAuthenticated()) {
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }

      const response = await getMe();
      setUser(response.user);
      setTenant(response.tenant);
      
      // Sync tenant_subdomain in localStorage if it changed (e.g. user moved to new tenant)
      if (response.tenant?.subdomain) {
        const storedSubdomain = localStorage.getItem('tenant_subdomain');
        if (storedSubdomain !== response.tenant.subdomain) {
          setTenantSubdomain(response.tenant.subdomain);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch user:", error);
      
      const errorCode = error?.code;
      
      // If account was deleted or suspended, clear everything and redirect to login
      if (errorCode === 'ACCOUNT_DELETED' || errorCode === 'ACCOUNT_SUSPENDED') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('tenant_subdomain');
        document.cookie = 'tenant_subdomain=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
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

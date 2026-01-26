"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout, isAuthenticated } from "@/lib/api/auth";
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
    } catch (error) {
      console.error("Failed to fetch user:", error);
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

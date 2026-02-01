"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getDashboardStats } from "@/lib/api/dashboard";
import { useAuth } from "./AuthContext";

interface CreditsState {
  creditsRemaining: number;
  creditsTotal: number;
  isLoading: boolean;
  error: string | null;
}

interface CreditsContextType extends CreditsState {
  refreshCredits: () => Promise<void>;
  decrementCredits: (amount?: number) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<CreditsState>({
    creditsRemaining: 0,
    creditsTotal: 0,
    isLoading: true,
    error: null,
  });

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const stats = await getDashboardStats();
      setState({
        creditsRemaining: stats.ai?.credits_remaining ?? 0,
        creditsTotal: stats.ai?.credits_total ?? 0,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch credits:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch credits",
      }));
    }
  }, [user]);

  const decrementCredits = useCallback((amount: number = 1) => {
    setState(prev => ({
      ...prev,
      creditsRemaining: Math.max(0, prev.creditsRemaining - amount),
    }));
  }, []);

  useEffect(() => {
    if (user) {
      refreshCredits();
    }
  }, [user, refreshCredits]);

  return (
    <CreditsContext.Provider
      value={{
        ...state,
        refreshCredits,
        decrementCredits,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error("useCredits must be used within a CreditsProvider");
  }
  return context;
}

"use client";

import { DashboardLayout as DashLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

// Routes that viewers are NOT allowed to access
const VIEWER_BLOCKED_ROUTES = [
  "/dashboard/ai-assistant",
  "/dashboard/templates",
  "/dashboard/knowledge/imports",
  "/dashboard/knowledge/new",
  "/dashboard/sources",
  "/dashboard/community/new",
  "/dashboard/settings/users",
  "/dashboard/settings/team",
  "/dashboard/settings/branding",
  "/dashboard/settings/sso",
  "/dashboard/settings/webhooks",
  "/dashboard/settings/import-export",
  "/dashboard/settings/permissions",
  "/dashboard/settings/audit-logs",
  "/dashboard/settings/privacy",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isViewer = user?.role === 'viewer' && !user?.is_super_admin;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Redirect viewers away from restricted routes
  useEffect(() => {
    if (!isLoading && user && isViewer && pathname) {
      const isBlocked = VIEWER_BLOCKED_ROUTES.some(route => pathname.startsWith(route));
      if (isBlocked) {
        console.log(`[ViewerGuard] Blocked viewer from accessing: ${pathname}`);
        router.replace("/dashboard");
      }
    }
  }, [isLoading, user, isViewer, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-ground)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mx-auto mb-4"></div>
          <p className="text-[var(--dash-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <CreditsProvider>
      <DashLayout>{children}</DashLayout>
    </CreditsProvider>
  );
}

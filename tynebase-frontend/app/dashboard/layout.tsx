"use client";

import { DashboardLayout as DashLayout } from "@/components/layout/DashboardLayout";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { useAuth } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
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
  "/dashboard/settings/billing",
];

// Routes that editors are NOT allowed to access (admin-only pages)
const EDITOR_BLOCKED_ROUTES = [
  "/dashboard/settings/users",
  "/dashboard/settings/team",
  "/dashboard/settings/branding",
  "/dashboard/settings/sso",
  "/dashboard/settings/webhooks",
  "/dashboard/settings/import-export",
  "/dashboard/settings/permissions",
  "/dashboard/settings/audit-logs",
  "/dashboard/settings/billing",
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
  const isEditor = user?.role === 'editor' && !user?.is_super_admin;
  const isAdmin = user?.role === 'admin' || user?.is_super_admin;
  const isCommunityRole = (user?.role === 'community_contributor' || user?.role === 'community_admin') && !user?.is_super_admin;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }

    // Redirect community roles away from the core dashboard
    if (!isLoading && user && isCommunityRole) {
      console.log(`[RoleGuard] Redirecting community user ${user.id} away from dashboard`);
      router.replace("/community");
    }
  }, [user, isLoading, router, isCommunityRole]);

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

  // Redirect editors away from admin-only routes
  useEffect(() => {
    if (!isLoading && user && isEditor && pathname) {
      const isBlocked = EDITOR_BLOCKED_ROUTES.some(route => pathname.startsWith(route));
      if (isBlocked) {
        console.log(`[EditorGuard] Blocked editor from accessing: ${pathname}`);
        router.replace("/dashboard");
      }
    }
  }, [isLoading, user, isEditor, pathname, router]);

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
      <NotificationProvider>
        <ImpersonationBanner />
        <DashLayout>{children}</DashLayout>
      </NotificationProvider>
    </CreditsProvider>
  );
}

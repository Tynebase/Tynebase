"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Users, Palette, Key, Webhook, FileDown, Shield, ClipboardList, ChevronRight } from "lucide-react";
import { updateProfile } from "@/lib/api/auth";

const settingsNav = [
  { label: "Users & Permissions", href: "/dashboard/settings/users", icon: Users, description: "Manage team members and roles" },
  { label: "Branding", href: "/dashboard/settings/branding", icon: Palette, description: "Customize logo, colors, and themes" },
  { label: "SSO & Authentication", href: "/dashboard/settings/sso", icon: Key, description: "Configure single sign-on" },
  { label: "Webhooks", href: "/dashboard/settings/webhooks", icon: Webhook, description: "Set up integrations and webhooks" },
  { label: "Import & Export", href: "/dashboard/settings/import-export", icon: FileDown, description: "Migrate content and data" },
  { label: "Permissions", href: "/dashboard/settings/permissions", icon: Shield, description: "Role-based access control" },
  { label: "Audit Logs", href: "/dashboard/settings/audit-logs", icon: ClipboardList, description: "Activity and change history" },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");

  // Initialize form values from user context
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
    }
    if (tenant) {
      setCompanyName(tenant.name || "");
    }
  }, [user, tenant]);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Update user profile
      await updateProfile({
        full_name: fullName,
      });

      // Refresh user context to get updated data
      await refreshUser();

      addToast({
        type: "success",
        title: "Settings saved",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Settings</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Manage your workspace settings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isLoading} variant="primary">
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Workspace Information */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
            <h2 className="font-semibold text-[var(--dash-text-primary)]">Workspace Information</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)]">Basic information about your workspace</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1.5">Subdomain</label>
              <input
                type="text"
                value={tenant?.subdomain || ""}
                placeholder="acme"
                disabled
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-muted)] cursor-not-allowed"
              />
              <p className="text-xs text-[var(--dash-text-muted)] mt-1.5">
                Your workspace URL: {tenant?.subdomain || "your-workspace"}.tynebase.com
              </p>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
            <h2 className="font-semibold text-[var(--dash-text-primary)]">Profile Settings</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)]">Your personal information</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First Last"
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                placeholder="you@example.com"
                disabled
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-muted)] cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)]">Quick Settings</h2>
          <p className="text-sm text-[var(--dash-text-tertiary)]">Access other configuration options</p>
        </div>
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {settingsNav.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <div className="h-full px-4 py-4 flex items-center justify-between rounded-lg hover:bg-[var(--surface-hover)] transition-colors group border border-transparent hover:border-[var(--dash-border-subtle)]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-ground)] flex items-center justify-center text-[var(--dash-text-tertiary)] group-hover:text-[var(--brand)] group-hover:bg-[var(--brand-primary-muted)] transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--dash-text-primary)] group-hover:text-[var(--brand)]">{item.label}</p>
                      <p className="text-sm text-[var(--dash-text-muted)]">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

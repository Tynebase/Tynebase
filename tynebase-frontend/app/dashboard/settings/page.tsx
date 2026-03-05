"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Users, Palette, Key, Webhook, FileDown, Shield, ClipboardList, ChevronRight, Lock, LogOut, AlertTriangle } from "lucide-react";
import { updateProfile, logout } from "@/lib/api/auth";
import { updateTenant } from "@/lib/api/tenants";
import { apiDelete } from "@/lib/api/client";

const settingsNav = [
  { label: "Privacy & Data", href: "/dashboard/settings/privacy", icon: Lock, description: "GDPR consents and data export" },
  { label: "Users & Permissions", href: "/dashboard/settings/users", icon: Users, description: "Manage team members and roles" },
  { label: "Branding", href: "/dashboard/settings/branding", icon: Palette, description: "Customise logo, colours and themes" },
  { label: "SSO & Authentication", href: "/dashboard/settings/sso", icon: Key, description: "Configure single sign-on" },
  { label: "Webhooks", href: "/dashboard/settings/webhooks", icon: Webhook, description: "Set up integrations and webhooks" },
  { label: "Import & Export", href: "/dashboard/settings/import-export", icon: FileDown, description: "Migrate content and data" },
  { label: "Permissions", href: "/dashboard/settings/permissions", icon: Shield, description: "Role-based access control" },
  { label: "Audit Logs", href: "/dashboard/settings/audit-logs", icon: ClipboardList, description: "Activity and change history" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Check if user is admin (admins can't leave, they own the workspace)
  const isAdmin = user?.role === 'admin' || user?.is_super_admin;

  const handleLeaveWorkspace = async () => {
    if (!user) return;
    
    setIsLeaving(true);
    try {
      // Call API to remove self from workspace
      await apiDelete(`/api/users/${user.id}/leave`);
      
      addToast({
        type: "success",
        title: "Left workspace",
        description: "You have successfully left this workspace.",
      });
      
      // Log out and redirect to login
      await logout();
      router.push("/login");
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to leave",
        description: error instanceof Error ? error.message : "Could not leave workspace. Please try again.",
      });
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
    }
  };

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
    if (!user || !tenant) return;

    setIsLoading(true);
    const hasNameChanged = fullName !== (user.full_name || "");
    const hasCompanyChanged = companyName !== (tenant.name || "");

    try {
      // Track if any update was attempted
      let profileUpdated = false;
      let tenantUpdated = false;

      // Update user profile if name changed
      if (hasNameChanged) {
        await updateProfile({
          full_name: fullName,
        });
        profileUpdated = true;
      }

      // Update tenant if company name changed
      if (hasCompanyChanged) {
        await updateTenant(tenant.id, {
          name: companyName,
        });
        tenantUpdated = true;
      }

      // Refresh user context to get updated data
      await refreshUser();

      // Show appropriate success message
      if (profileUpdated && tenantUpdated) {
        addToast({
          type: "success",
          title: "Settings saved",
          description: "Your profile and workspace have been updated successfully.",
        });
      } else if (tenantUpdated) {
        addToast({
          type: "success",
          title: "Workspace updated",
          description: "Your workspace has been updated successfully.",
        });
      } else if (profileUpdated) {
        addToast({
          type: "success",
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      } else {
        addToast({
          type: "info",
          title: "No changes",
          description: "No changes were made to save.",
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to update settings. Please try again.",
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

      {/* Leave Workspace - Only show for non-admin users */}
      {!isAdmin && (
        <div className="bg-[var(--surface-card)] border border-red-500/20 rounded-xl">
          <div className="px-6 py-4 border-b border-red-500/20">
            <h2 className="font-semibold text-red-500">Danger Zone</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)]">Irreversible actions</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--dash-text-primary)]">Leave Workspace</p>
                <p className="text-sm text-[var(--dash-text-muted)]">
                  Remove yourself from {tenant?.name || 'this workspace'}. You will lose access to all content.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowLeaveModal(true)}
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Workspace Confirmation Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Workspace"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <p className="text-center text-[var(--dash-text-primary)] mb-2">
            Are you sure you want to leave <strong>{tenant?.name || 'this workspace'}</strong>?
          </p>
          <p className="text-center text-sm text-[var(--dash-text-muted)] mb-6">
            You will lose access to all documents and content. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowLeaveModal(false)}
              disabled={isLeaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-red-500 hover:bg-red-600"
              onClick={handleLeaveWorkspace}
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave Workspace"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

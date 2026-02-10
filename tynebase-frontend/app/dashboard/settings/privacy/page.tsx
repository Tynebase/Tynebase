"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Shield, Info, Download, Trash2, AlertTriangle } from "lucide-react";
import { getConsents, updateConsents, downloadDataExport, deleteAccount } from "@/lib/api/settings";
import type { UserConsents } from "@/lib/api/settings";

export default function PrivacySettingsPage() {
  const { user, signOut } = useAuth();
  const { addToast } = useToast();
  
  const [consents, setConsents] = useState<UserConsents>({
    ai_processing: true,
    analytics_tracking: true,
    knowledge_indexing: true,
    updated_at: null,
  });
  
  const [originalConsents, setOriginalConsents] = useState<UserConsents | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch current consents on mount
  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      setIsLoading(true);
      const response = await getConsents();
      setConsents(response.consents);
      setOriginalConsents(response.consents);
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to load consents",
        description: error instanceof Error ? error.message : "Could not load privacy settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentChange = (key: keyof UserConsents, value: boolean) => {
    if (key === 'updated_at') return;
    setConsents((prev) => ({ ...prev, [key]: value }));
  };

  const getChangedConsentsMessage = (): string => {
    if (!originalConsents) return "Your consent preferences have been saved.";
    
    const consentLabels: Record<string, string> = {
      ai_processing: "AI processing",
      analytics_tracking: "analytics tracking",
      knowledge_indexing: "knowledge indexing",
    };
    
    const changed: string[] = [];
    
    if (consents.ai_processing !== originalConsents.ai_processing) {
      changed.push(consentLabels.ai_processing);
    }
    if (consents.analytics_tracking !== originalConsents.analytics_tracking) {
      changed.push(consentLabels.analytics_tracking);
    }
    if (consents.knowledge_indexing !== originalConsents.knowledge_indexing) {
      changed.push(consentLabels.knowledge_indexing);
    }
    
    if (changed.length === 0) {
      return "Your consent preferences have been saved.";
    }
    
    if (changed.length === 1) {
      return `Your ${changed[0]} preference has been changed.`;
    }
    
    if (changed.length === 2) {
      return `Your ${changed[0]} and ${changed[1]} preferences have been changed.`;
    }
    
    // 3 or more items
    const last = changed[changed.length - 1];
    const rest = changed.slice(0, -1).join(", ");
    return `Your ${rest} and ${last} preferences have been changed.`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await updateConsents({
        ai_processing: consents.ai_processing,
        analytics_tracking: consents.analytics_tracking,
        knowledge_indexing: consents.knowledge_indexing,
      });
      
      setConsents(response.consents);
      setOriginalConsents(response.consents);
      
      addToast({
        type: "success",
        title: "Privacy settings updated",
        description: getChangedConsentsMessage(),
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to update consents",
        description: error instanceof Error ? error.message : "Could not save privacy settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      await downloadDataExport();
      
      addToast({
        type: "success",
        title: "Data export started",
        description: "Your data export will download shortly.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export your data",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmation !== user.id) {
      addToast({
        type: "error",
        title: "Invalid confirmation",
        description: "Please enter your user ID to confirm account deletion.",
      });
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount(deleteConfirmation);
      
      addToast({
        type: "success",
        title: "Account deletion initiated",
        description: "Your account has been marked for deletion. You will be logged out.",
      });
      
      // Log out user after deletion
      setTimeout(() => {
        signOut();
      }, 2000);
    } catch (error) {
      addToast({
        type: "error",
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Could not delete account",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mx-auto mb-4"></div>
          <p className="text-[var(--dash-text-tertiary)]">Loading privacy settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Privacy & Data</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Manage your privacy settings and data rights
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} variant="primary">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Consent Management */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[var(--brand)]" />
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)]">Consent Preferences</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Control how your data is used</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* AI Processing Consent */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="font-medium text-[var(--dash-text-primary)] block mb-1">
                AI Processing
              </label>
              <p className="text-sm text-[var(--dash-text-tertiary)]">
                Allow AI models to process your content for generation, enhancement and chat features.
                Disabling this will block all AI operations.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.ai_processing}
                onChange={(e) => handleConsentChange('ai_processing', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--surface-ground)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--brand)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand)]"></div>
            </label>
          </div>

          {/* Analytics Tracking Consent */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="font-medium text-[var(--dash-text-primary)] block mb-1">
                Analytics Tracking
              </label>
              <p className="text-sm text-[var(--dash-text-tertiary)]">
                Allow us to collect anonymous usage data to improve the platform.
                This helps us understand how features are used.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.analytics_tracking}
                onChange={(e) => handleConsentChange('analytics_tracking', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--surface-ground)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--brand)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand)]"></div>
            </label>
          </div>

          {/* Knowledge Indexing Consent */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="font-medium text-[var(--dash-text-primary)] block mb-1">
                Knowledge Indexing
              </label>
              <p className="text-sm text-[var(--dash-text-tertiary)]">
                Allow your documents to be indexed for RAG (Retrieval-Augmented Generation) chat.
                Disabling this will prevent AI from accessing your documents in chat.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.knowledge_indexing}
                onChange={(e) => handleConsentChange('knowledge_indexing', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--surface-ground)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--brand)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand)]"></div>
            </label>
          </div>

          {consents.updated_at && (
            <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)] pt-2 border-t border-[var(--dash-border-subtle)]">
              <Info className="w-4 h-4" />
              <span>Last updated: {new Date(consents.updated_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Data Export (GDPR Right to Data Portability) */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-[var(--brand)]" />
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)]">Export Your Data</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Download all your data (GDPR compliant)</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-[var(--dash-text-secondary)] mb-4">
            Export all your data including documents, templates, usage history and profile information
            in JSON format. This export complies with GDPR Article 20 (Right to Data Portability).
          </p>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            variant="secondary"
          >
            {isExporting ? "Exporting..." : "Export My Data"}
          </Button>
        </div>
      </div>

      {/* Account Deletion (GDPR Right to be Forgotten) */}
      <div className="bg-[var(--surface-card)] border border-red-200 dark:border-red-900/30 rounded-xl">
        <div className="px-6 py-4 border-b border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)]">Delete Account</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Permanently delete your account and data</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {!showDeleteConfirm ? (
            <>
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-900 dark:text-red-200">
                  <p className="font-bold mb-1">This action cannot be undone</p>
                  <p>Deleting your account will permanently remove all your data including documents, templates and usage history within 24 hours.</p>
                </div>
              </div>
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="secondary"
                className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete My Account
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-900 dark:text-red-200">
                  <p className="font-medium mb-1">Confirm Account Deletion</p>
                  <p>To confirm, please enter your user ID: <code className="font-mono bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">{user?.id}</code></p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  User ID Confirmation
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Enter your user ID"
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation !== user?.id}
                  variant="secondary"
                  className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {isDeleting ? "Deleting..." : "Confirm Deletion"}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmation("");
                  }}
                  variant="secondary"
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

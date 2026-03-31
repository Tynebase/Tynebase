"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Settings,
  Save,
  Moon,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  FileText,
  MessageSquare,
  Users,
  AlertTriangle,
  Sparkles,
  CreditCard,
  ListTodo,
  MessageCircle,
  Coins,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from "@/lib/api/notifications";

const typeIcons = {
  document: FileText,
  comment: MessageSquare,
  mention: Users,
  system: AlertTriangle,
  ai: Sparkles,
  billing: CreditCard,
  task: ListTodo,
  chat: MessageCircle,
  credits: Coins,
  invoice: Receipt,
  invitation: Mail,
};

const typeLabels = {
  document: "Documents",
  comment: "Comments",
  mention: "Mentions",
  system: "System",
  ai: "AI Generation",
  billing: "Billing",
  task: "Tasks",
  chat: "Chat Messages",
  credits: "Credits",
  invoice: "Invoices",
  invitation: "Invitations",
};

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error("Failed to load notification preferences:", err);
      setError("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await updateNotificationPreferences(preferences);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
      setError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const updateQuietHours = (enabled: boolean, start?: string, end?: string) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      quiet_hours_enabled: enabled,
      quiet_hours_start: start ?? preferences.quiet_hours_start,
      quiet_hours_end: end ?? preferences.quiet_hours_end,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-ground)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-[var(--dash-text-tertiary)] animate-spin" />
          <p className="text-[var(--dash-text-secondary)]">Loading preferences…</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-[var(--surface-ground)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--status-error)]" />
          <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Failed to load</h2>
          <p className="text-[var(--dash-text-secondary)] mb-4">{error}</p>
          <Button onClick={loadPreferences}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-ground)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-[var(--dash-text-secondary)]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Notification Preferences</h1>
              <p className="text-[var(--dash-text-tertiary)]">Control how and when you receive notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-2 text-[var(--status-success)]">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Saved</span>
              </div>
            )}
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-lg">
            <p className="text-[var(--status-error)]">{error}</p>
          </div>
        )}

        {/* Delivery Channels */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Delivery Channels
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--dash-text-primary)]">In-App Notifications</div>
                <div className="text-sm text-[var(--dash-text-tertiary)]">Show notifications in the dashboard</div>
              </div>
              <button
                onClick={() => updatePreference("in_app_enabled", !preferences.in_app_enabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  preferences.in_app_enabled ? "bg-[var(--brand)]" : "bg-[var(--dash-border-subtle)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    preferences.in_app_enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--dash-text-primary)]">Email Notifications</div>
                <div className="text-sm text-[var(--dash-text-tertiary)]">Receive notifications via email</div>
              </div>
              <button
                onClick={() => updatePreference("email_enabled", !preferences.email_enabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  preferences.email_enabled ? "bg-[var(--brand)]" : "bg-[var(--dash-border-subtle)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    preferences.email_enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notification Types
          </h2>
          <div className="grid gap-4">
            {Object.entries(typeLabels).map(([type, label]) => {
              const Icon = typeIcons[type as keyof typeof typeIcons];
              const enabled = preferences[`${type}_enabled` as keyof NotificationPreferences] as boolean;
              
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[var(--dash-text-secondary)]" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--dash-text-primary)]">{label}</div>
                      <div className="text-sm text-[var(--dash-text-tertiary)]">
                        {type === "document" && "When documents are shared with you"}
                        {type === "comment" && "When someone comments on your content"}
                        {type === "mention" && "When you are mentioned in discussions"}
                        {type === "system" && "Important system updates"}
                        {type === "ai" && "AI generation completions and errors"}
                        {type === "billing" && "Billing and subscription updates"}
                        {type === "task" && "Task assignments and updates"}
                        {type === "chat" && "New chat messages in channels"}
                        {type === "credits" && "Credit usage and warnings"}
                        {type === "invoice" && "New invoices and payment reminders"}
                        {type === "invitation" && "Workspace invitations"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePreference(`${type}_enabled` as keyof NotificationPreferences, !enabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      enabled ? "bg-[var(--brand)]" : "bg-[var(--dash-border-subtle)]"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        enabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-4 flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Quiet Hours
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--dash-text-primary)]">Enable Quiet Hours</div>
                <div className="text-sm text-[var(--dash-text-tertiary)]">Pause non-urgent notifications during specific times</div>
              </div>
              <button
                onClick={() => updateQuietHours(!preferences.quiet_hours_enabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  preferences.quiet_hours_enabled ? "bg-[var(--brand)]" : "bg-[var(--dash-border-subtle)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    preferences.quiet_hours_enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            
            {preferences.quiet_hours_enabled && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--dash-border-subtle)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-primary)] mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_start || ""}
                    onChange={(e) => updateQuietHours(true, e.target.value, preferences.quiet_hours_end || undefined)}
                    className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-primary)] mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_end || ""}
                    onChange={(e) => updateQuietHours(true, preferences.quiet_hours_start || undefined, e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

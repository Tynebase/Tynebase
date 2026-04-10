"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Search,
  Bell,
  Command,
  ChevronDown,
  Settings,
  User,
  LogOut,
  HelpCircle,
  Menu,
  Sparkles,
  FileText,
  MessageSquare,
  Users,
  AlertCircle,
  CreditCard,
  ListTodo,
  MessageCircle,
  Coins,
  Receipt,
  Mail,
  CheckCheck,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibilityWidget } from "@/components/ui/AccessibilityWidget";
import { useCredits } from "@/contexts/CreditsContext";
import type { Notification, NotificationType } from "@/lib/api/notifications";

const typeIcons: Record<NotificationType, typeof Bell> = {
  document: FileText,
  comment: MessageSquare,
  mention: Users,
  system: AlertCircle,
  ai: Sparkles,
  billing: CreditCard,
  task: ListTodo,
  chat: MessageCircle,
  credits: Coins,
  invoice: Receipt,
  invitation: Mail,
};

const typeColors: Record<NotificationType, string> = {
  document: "text-blue-500 bg-blue-500/10",
  comment: "text-green-500 bg-green-500/10",
  mention: "text-purple-500 bg-purple-500/10",
  system: "text-amber-500 bg-amber-500/10",
  ai: "text-pink-500 bg-pink-500/10",
  billing: "text-orange-500 bg-orange-500/10",
  task: "text-indigo-500 bg-indigo-500/10",
  chat: "text-teal-500 bg-teal-500/10",
  credits: "text-yellow-500 bg-yellow-500/10",
  invoice: "text-red-500 bg-red-500/10",
  invitation: "text-cyan-500 bg-cyan-500/10",
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface DashboardHeaderProps {
  onOpenCommandPalette?: () => void;
  onMenuClick?: () => void;
}

export function DashboardHeader({ onOpenCommandPalette, onMenuClick }: DashboardHeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { creditsRemaining, creditsTotal, isLoading: creditsLoading } = useCredits();
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    remove,
  } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const recentNotifications = notifications.slice(0, 8);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setShowNotifications(false);
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await remove(id);
  };

  return (
    <header className="h-16 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-card)] flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-xl">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar - Responsive */}
        <div className="flex-1 w-full flex justify-end sm:justify-start">
          <button
            onClick={onOpenCommandPalette}
            className="w-full hidden sm:flex items-center gap-3 px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-tertiary)] hover:border-[var(--dash-border-default)] transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left text-sm">Search documents, templates and quick actions…</span>
            <kbd className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded text-xs font-medium">
              <Command className="w-3 h-3" />
              <span>K</span>
            </kbd>
          </button>

          <div className="flex items-center gap-1 sm:hidden">
            {/* Mobile Accessibility Widget */}
            <div className="relative">
              <AccessibilityWidget customTrigger={
                <button className="p-2 text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] rounded-md">
                  <img src="/accessibility-2-128.ico" alt="Accessibility" className="w-5 h-5" />
                </button>
              } />
            </div>

            {/* Mobile Search Icon Only */}
            <button
              onClick={onOpenCommandPalette}
              className="p-2 text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] rounded-md"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* AI Credits */}
        <Link
          href="/dashboard/settings/billing"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors",
            creditsRemaining === 0
              ? "bg-[var(--status-error-bg)] text-[var(--status-error)]"
              : creditsRemaining <= 3
              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
              : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)]"
          )}
          title={`${creditsRemaining} of ${creditsTotal} AI credits remaining`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">
            {creditsLoading ? "..." : creditsRemaining}
          </span>
        </Link>

        {/* Help */}
        <Link
          href="/dashboard/help"
          className="p-2.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)] transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--brand)] rounded-full" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[var(--dash-border-subtle)] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--dash-text-primary)]">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--brand)] text-white rounded-full min-w-[1.25rem] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="p-1.5 rounded-md text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      href="/dashboard/preferences"
                      onClick={() => setShowNotifications(false)}
                      className="p-1.5 rounded-md text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                      title="Notification settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="py-10 text-center">
                      <Loader2 className="w-6 h-6 mx-auto mb-2 text-[var(--dash-text-tertiary)] animate-spin" />
                      <p className="text-sm text-[var(--dash-text-tertiary)]">Loading…</p>
                    </div>
                  ) : recentNotifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="w-10 h-10 mx-auto mb-2 text-[var(--dash-text-tertiary)] opacity-40" />
                      <p className="text-sm text-[var(--dash-text-secondary)]">No notifications yet</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">We&apos;ll notify you when something happens</p>
                    </div>
                  ) : (
                    recentNotifications.map((notif) => {
                      const Icon = typeIcons[notif.type] || Bell;
                      const colorClass = typeColors[notif.type] || "text-gray-500 bg-gray-500/10";

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={cn(
                            "px-4 py-3 hover:bg-[var(--surface-hover)] cursor-pointer border-b border-[var(--dash-border-subtle)] last:border-0 transition-colors group",
                            !notif.read && "bg-[var(--brand)]/5"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm font-medium truncate",
                                  !notif.read ? "text-[var(--dash-text-primary)]" : "text-[var(--dash-text-secondary)]"
                                )}>
                                  {notif.title}
                                </p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!notif.read && (
                                    <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                                  )}
                                  <button
                                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--surface-card)] rounded transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3 text-[var(--dash-text-tertiary)]" />
                                  </button>
                                </div>
                              </div>
                              {notif.description && (
                                <p className="text-xs text-[var(--dash-text-tertiary)] truncate mt-0.5">
                                  {notif.description}
                                </p>
                              )}
                              <span className="text-xs text-[var(--dash-text-tertiary)] flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(notif.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                {recentNotifications.length > 0 && (
                  <Link
                    href="/dashboard/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="block px-4 py-3 text-center text-sm font-medium text-[var(--brand)] hover:bg-[var(--surface-hover)] border-t border-[var(--dash-border-subtle)] transition-colors"
                  >
                    View all notifications
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-sm">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--dash-border-subtle)]">
                  <p className="font-medium text-[var(--dash-text-primary)]">
                    {user?.full_name || "User"}
                  </p>
                  <p className="text-sm text-[var(--dash-text-tertiary)] truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard/settings/account"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)]"
                  >
                    <User className="w-4 h-4" />
                    Account Settings
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)]"
                  >
                    <Settings className="w-4 h-4" />
                    Account Settings
                  </Link>
                </div>
                <div className="border-t border-[var(--dash-border-subtle)] py-1">
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

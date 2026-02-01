"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibilityWidget } from "@/components/ui/AccessibilityWidget";
import { useCredits } from "@/contexts/CreditsContext";

interface DashboardHeaderProps {
  onOpenCommandPalette?: () => void;
  onMenuClick?: () => void;
}

export function DashboardHeader({ onOpenCommandPalette, onMenuClick }: DashboardHeaderProps) {
  const { user, signOut } = useAuth();
  const { creditsRemaining, creditsTotal, isLoading: creditsLoading } = useCredits();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: "New comment on your article", time: "5 min ago", unread: true },
    { id: 2, title: "Document approved for publishing", time: "1 hour ago", unread: true },
    { id: 3, title: "Weekly content audit complete", time: "2 hours ago", unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

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
              <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-80 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--dash-border-subtle)] flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-[var(--dash-text-primary)] truncate">Notifications</h3>
                  <button className="text-xs text-[var(--brand)] hover:underline whitespace-nowrap flex-shrink-0">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "px-4 py-3 hover:bg-[var(--surface-hover)] cursor-pointer border-b border-[var(--dash-border-subtle)] last:border-0",
                        notif.unread && "bg-[var(--brand-primary-muted)]"
                      )}
                    >
                      <p className="text-sm text-[var(--dash-text-primary)]">{notif.title}</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">{notif.time}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/notifications"
                  className="block px-4 py-3 text-center text-sm text-[var(--brand)] hover:bg-[var(--surface-hover)] border-t border-[var(--dash-border-subtle)]"
                >
                  View all notifications
                </Link>
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
                    href="/dashboard/settings/profile"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)]"
                  >
                    <User className="w-4 h-4" />
                    Profile Settings
                  </Link>
                  <Link
                    href="/dashboard/settings"
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

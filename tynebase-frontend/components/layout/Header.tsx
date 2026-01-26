"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Moon, Sun, LogOut, User, Command } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "next-themes";

interface HeaderProps {
  onOpenCommandPalette?: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { branding } = useTenant();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSearchClick = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        {/* Search - Opens Command Palette */}
        <div className="flex-1 max-w-xl">
          <button
            onClick={handleSearchClick}
            className="h-10 w-full flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 text-sm text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-card)] transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search knowledge base...</span>
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-[var(--radius-md)] p-2 text-[var(--text-tertiary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)] transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-[var(--radius-md)] p-2 text-[var(--text-tertiary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)] transition-colors"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--status-error)]" />
          </button>
          
          <NotificationCenter 
            isOpen={showNotifications} 
            onClose={() => setShowNotifications(false)} 
          />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] p-1 hover:bg-[var(--surface-ground)] transition-colors"
            >
              <Avatar
                src={user?.avatar_url ?? undefined}
                alt={user?.full_name || user?.email || "User"}
                size="sm"
              />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)] z-50">
                  <div className="p-4 border-b border-[var(--border-subtle)]">
                    <p className="font-medium text-[var(--text-primary)]">
                      {user?.full_name}
                    </p>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {user?.email}
                    </p>
                    {branding?.name && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {branding.name}
                      </p>
                    )}
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings/profile");
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Profile Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

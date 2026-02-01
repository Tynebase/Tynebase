"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { MobileSidebar } from "./MobileSidebar";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="dashboard-shell h-screen w-full overflow-hidden bg-[var(--surface-ground)]">
      {/* Mobile Sidebar Overlay */}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Grid: 1 column on mobile, 2 columns on desktop */}
      <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar />

        <div className="min-w-0 flex flex-col h-full overflow-hidden">
          <div className="flex-shrink-0">
            <DashboardHeader
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              onMenuClick={() => setIsMobileSidebarOpen(true)}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <main
              className={cn(
                "flex-1 min-h-0 min-w-0 overflow-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-10",
                className
              )}
            >
              <div className="w-full max-w-none min-h-0 flex flex-col min-h-full">
                <div className="flex-1 min-h-0 min-w-0">
                  {children}
                </div>
              </div>
            </main>

            <footer className="flex-shrink-0 border-t border-[var(--dash-border-subtle)] bg-[var(--surface-card)] px-8 pr-24 py-3 hidden sm:block">
              <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)]">
                <span>© 2026 TyneBase. All rights reserved.</span>
                <div className="flex items-center gap-6">
                  <Link href="/dashboard/help" className="hover:text-[var(--dash-text-secondary)] transition-colors">Help</Link>
                  <Link href="/privacy" className="hover:text-[var(--dash-text-secondary)] transition-colors">Privacy</Link>
                  <Link href="/terms" className="hover:text-[var(--dash-text-secondary)] transition-colors">Terms</Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}

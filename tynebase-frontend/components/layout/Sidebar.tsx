"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  Sparkles,
  BarChart3,
  Users,
  FileText,
  Settings,
  UserCog,
  Palette,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Webhook,
  Upload,
  ClipboardCheck,
  Key,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  roles?: string[];
}

const navigation: NavItem[] = [
  {
    id: "knowledge",
    label: "Knowledge",
    icon: <BookOpen className="w-5 h-5" />,
    href: "/dashboard/knowledge",
  },
  {
    id: "ai-assistant",
    label: "AI Assistant",
    icon: <Sparkles className="w-5 h-5" />,
    href: "/dashboard/ai-assistant",
  },
  {
    id: "audit",
    label: "Content Audit",
    icon: <ClipboardCheck className="w-5 h-5" />,
    href: "/dashboard/audit",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    href: "/dashboard/analytics",
    roles: ["admin", "editor"],
  },
  {
    id: "community",
    label: "Community",
    icon: <Users className="w-5 h-5" />,
    href: "/dashboard/community",
  },
  {
    id: "templates",
    label: "Templates",
    icon: <FileText className="w-5 h-5" />,
    href: "/dashboard/templates",
  },
];

const settingsNavigation: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="w-5 h-5" />,
    href: "/dashboard/settings",
  },
  {
    id: "users",
    label: "Users",
    icon: <UserCog className="w-5 h-5" />,
    href: "/dashboard/users",
    roles: ["admin"],
  },
  {
    id: "permissions",
    label: "Permissions",
    icon: <Shield className="w-5 h-5" />,
    href: "/dashboard/settings/permissions",
    roles: ["admin"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    icon: <Webhook className="w-5 h-5" />,
    href: "/dashboard/settings/webhooks",
    roles: ["admin"],
  },
  {
    id: "import-export",
    label: "Import/Export",
    icon: <Upload className="w-5 h-5" />,
    href: "/dashboard/settings/import-export",
    roles: ["admin"],
  },
  {
    id: "branding",
    label: "Branding",
    icon: <Palette className="w-5 h-5" />,
    href: "/dashboard/settings/branding",
    roles: ["admin"],
  },
  {
    id: "sso",
    label: "SSO",
    icon: <Key className="w-5 h-5" />,
    href: "/dashboard/settings/sso",
    roles: ["admin"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-[var(--border-subtle)] bg-[var(--surface-card)] transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-[var(--text-primary)]">
                TyneBase
              </span>
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-[var(--radius-sm)] p-1.5 hover:bg-[var(--surface-ground)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.filter(hasAccess).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--brand-primary)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-4 border-t border-[var(--border-subtle)]" />

          {/* Settings */}
          {settingsNavigation.filter(hasAccess).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--brand-primary)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  Database,
  FileSearch,
  HeartPulse,
  Layers,
  Tags,
  Download,
  Sparkles,
  BarChart3,
  FileText,
  Settings,
  UserCog,
  Palette,
  LayoutDashboard,
  Activity,
  FolderTree,
  FileEdit,
  Video,
  Wand2,
  ChevronDown,
  MessageCircle,
  Users,
  Search,
  CreditCard,
  Music
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  badge?: number | string;
  roles?: string[];
}

const mainNavigation: NavItem[] = [
  {
    id: "home",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "#3b82f6",
  },
];

const knowledgeNavigation: NavItem[] = [
  {
    id: "knowledge",
    label: "All Documents",
    icon: BookOpen,
    href: "/dashboard/knowledge",
    color: "#8b5cf6",
  },
  {
    id: "categories",
    label: "Categories",
    icon: FolderTree,
    href: "/dashboard/knowledge/categories",
    color: "#06b6d4",
  },
  {
    id: "collections",
    label: "Collections",
    icon: Layers,
    href: "/dashboard/knowledge/collections",
    color: "#3b82f6",
  },
  {
    id: "tags",
    label: "Tags",
    icon: Tags,
    href: "/dashboard/knowledge/tags",
    color: "#ec4899",
  },
  {
    id: "imports",
    label: "Imports",
    icon: Download,
    href: "/dashboard/knowledge/imports",
    color: "#10b981",
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    href: "/dashboard/knowledge/activity",
    color: "#f59e0b",
  },
  {
    id: "drafts",
    label: "My Drafts",
    icon: FileEdit,
    href: "/dashboard/knowledge/drafts",
    color: "#f59e0b",
  },
];

const sourcesNavigation: NavItem[] = [
  {
    id: "sources",
    label: "Sources",
    icon: Database,
    href: "/dashboard/sources",
    color: "#0ea5e9",
  },
  {
    id: "sources-normalized",
    label: "Normalized Markdown",
    icon: FileSearch,
    href: "/dashboard/sources/normalized",
    color: "#8b5cf6",
  },
  {
    id: "sources-health",
    label: "Index Health",
    icon: HeartPulse,
    href: "/dashboard/sources/health",
    color: "#10b981",
  },
];

const aiNavigation: NavItem[] = [
  {
    id: "ai-chat",
    label: "AI Chat",
    icon: MessageCircle,
    href: "/dashboard/ai-chat",
    color: "#8b5cf6",
  },
  {
    id: "ai-ask",
    label: "ASK",
    icon: Search,
    href: "/dashboard/ai-assistant/ask",
    color: "#ec4899",
  },
  {
    id: "ai-prompt",
    label: "Ingest",
    icon: Sparkles,
    href: "/dashboard/ai-assistant",
    color: "#ec4899",
  },
  {
    id: "ai-video",
    label: "From Video",
    icon: Video,
    href: "/dashboard/ai-assistant/video",
    color: "#ef4444",
  },
  {
    id: "ai-audio",
    label: "From Audio",
    icon: Music,
    href: "/dashboard/ai-assistant/audio",
    color: "#f59e0b",
  },
  {
    id: "ai-enhance",
    label: "Enhance",
    icon: Wand2,
    href: "/dashboard/ai-assistant/enhance",
    color: "#8b5cf6",
  },
];

const toolsNavigation: NavItem[] = [
  {
    id: "audit",
    label: "Content Audit",
    icon: BarChart3,
    href: "/dashboard/audit",
    color: "#10b981",
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    href: "/dashboard/community",
    color: "#3b82f6",
    badge: 3,
  },
  {
    id: "templates",
    label: "Templates",
    icon: FileText,
    href: "/dashboard/templates",
    color: "#f97316",
  },
];

const adminNavigation: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    color: "#6b7280",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    href: "/dashboard/settings/billing",
    color: "#10b981",
    roles: ["admin", "super_admin"],
  },
  {
    id: "users",
    label: "Users & Teams",
    icon: UserCog,
    href: "/dashboard/users",
    color: "#8b5cf6",
    roles: ["admin", "super_admin"],
  },
  {
    id: "branding",
    label: "Branding",
    icon: Palette,
    href: "/dashboard/settings/branding",
    color: "#ec4899",
    roles: ["admin", "super_admin"],
  },
  {
    id: "audit-logs",
    label: "Activity Log",
    icon: Activity,
    href: "/dashboard/settings/audit-logs",
    color: "#06b6d4",
    roles: ["admin", "super_admin"],
  },
];

export function DashboardSidebar({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // State for collapsible sections
  // Initializing with 'true' to have them open by default, 
  // or 'false' to start collapsed.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    knowledge: true,
    sources: false,
    ai: false,
    tools: false,
    admin: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href) && href !== "/dashboard";
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all group/link",
          active
            ? "bg-[var(--brand)]/10 text-[var(--brand)]"
            : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)]"
        )}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover/link:scale-105"
          style={{ backgroundColor: `${item.color}15` }}
        >
          <span style={{ color: item.color }}>
            <Icon className="w-4 h-4" />
          </span>
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[var(--brand)] text-white">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const CollapsibleSection = ({
    id,
    label,
    children
  }: {
    id: string;
    label: string;
    children: React.ReactNode
  }) => {
    const isOpen = openSections[id];

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between group px-2 py-1.5 rounded-lg text-xs font-semibold text-[var(--dash-text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)] transition-all text-left"
        >
          <span className="uppercase tracking-wider text-[10px] font-bold">{label}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-300 ease-out opacity-50 group-hover:opacity-100 flex-shrink-0 ml-2",
              !isOpen && "-rotate-90"
            )}
          />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 pt-1 pb-2">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className={cn(
      "bg-[var(--surface-card)] border-r border-[var(--dash-border-subtle)] flex flex-col transition-all duration-300",
      mobile ? "h-full w-full border-none" : "h-screen sticky top-0 hidden lg:flex"
    )}>
      {/* Logo Header */}
      <div className="h-16 flex items-center pr-2">
        <div className="w-5" />
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="nav-logo-glow-dash">
            <Image
              src="/logo.png"
              alt="TyneBase"
              width={34}
              height={34}
              className="logo-image"
              style={{
                minWidth: '34px',
                maxWidth: '34px',
                height: 'auto',
                display: 'block'
              }}
            />
          </span>
          <span className="shine-text-dash text-xl font-bold">
            TyneBase
          </span>
        </Link>
      </div>

      {/* Create Button */}
      <div className="px-8 pt-2 pb-4" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-7 pb-10 dashboard-scroll flex flex-col">
        <div className="space-y-6">
          {/* Main */}
          <div className="space-y-1">
            {mainNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </div>

          {/* Knowledge Base */}
          <CollapsibleSection id="knowledge" label="Knowledge Base">
            {knowledgeNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </CollapsibleSection>

          {/* Knowledge Sources (RAG) */}
          <CollapsibleSection id="sources" label="Knowledge Sources">
            {sourcesNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </CollapsibleSection>

          {/* AI Assistant */}
          <CollapsibleSection id="ai" label="AI Assistant">
            {aiNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </CollapsibleSection>

          {/* Tools */}
          <CollapsibleSection id="tools" label="Tools">
            {toolsNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </CollapsibleSection>
        </div>

        {/* Push Admin toward bottom so links aren't bunched in the middle */}
        <div className="mt-auto pt-10">
          <div className="h-px bg-[var(--dash-border-subtle)] mb-7" />
          <CollapsibleSection id="admin" label="Admin">
            {adminNavigation.filter(hasAccess).map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </CollapsibleSection>
        </div>
      </nav>
    </aside>
  );
}

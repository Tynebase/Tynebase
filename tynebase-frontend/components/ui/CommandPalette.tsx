"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listDocuments, type Document } from "@/lib/api/documents";
import { searchDocs } from "@/lib/docs";
import {
  Search,
  FileText,
  Plus,
  Settings,
  Users,
  Sparkles,
  BookOpen,
  FolderOpen,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  Clock,
  Loader2,
  HelpCircle
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: "navigation" | "actions" | "recent" | "documents" | "help";
  keywords?: string[];
  viewerHidden?: boolean;
  adminOnly?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer' && !user?.is_super_admin;
  const isEditor = user?.role === 'editor' && !user?.is_super_admin;
  const isAdmin = user?.role === 'admin' || user?.is_super_admin;
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fetchedDocuments, setFetchedDocuments] = useState<Document[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch recent/searched documents
  useEffect(() => {
    if (!isOpen) return;

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    const performSearch = async () => {
      try {
        setIsSearching(true);
        const response = await listDocuments({
          search: query || undefined,
          limit: query ? 8 : 5,
          status: 'published'
        });
        setFetchedDocuments(response.documents);
      } catch (err) {
        console.error('Failed to fetch documents for command palette:', err);
      } finally {
        setIsSearching(false);
      }
    };

    if (query) {
      searchTimeout.current = setTimeout(performSearch, 300);
    } else {
      performSearch();
    }

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, isOpen]);

  const staticCommands: CommandItem[] = useMemo(() => [
    // Actions
    {
      id: "new-doc",
      title: "Create New Document",
      description: "Start a new knowledge article",
      icon: Plus,
      action: () => router.push("/dashboard/knowledge/new"),
      category: "actions",
      keywords: ["new", "create", "document", "article"],
      viewerHidden: true,
    },
    {
      id: "ai-assistant",
      title: "Open AI Assistant",
      description: "Generate content with AI",
      icon: Sparkles,
      action: () => router.push("/dashboard/ai-assistant"),
      category: "actions",
      keywords: ["ai", "generate", "assistant"],
      viewerHidden: true,
    },
    {
      id: "use-template",
      title: "Use Template",
      description: "Start from a template",
      icon: FileText,
      action: () => router.push("/dashboard/templates"),
      category: "actions",
      keywords: ["template", "start"],
      viewerHidden: true,
    },
    // Navigation
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      icon: BarChart3,
      action: () => router.push("/dashboard"),
      category: "navigation",
      keywords: ["home", "dashboard", "overview"],
    },
    {
      id: "nav-knowledge",
      title: "Go to Knowledge Base",
      icon: BookOpen,
      action: () => router.push("/dashboard/knowledge"),
      category: "navigation",
      keywords: ["knowledge", "documents", "articles"],
    },
    {
      id: "nav-templates",
      title: "Go to Templates",
      icon: FolderOpen,
      action: () => router.push("/dashboard/templates"),
      category: "navigation",
      keywords: ["templates"],
      viewerHidden: true,
    },
    {
      id: "nav-analytics",
      title: "Go to Analytics",
      icon: BarChart3,
      action: () => router.push("/dashboard/analytics"),
      category: "navigation",
      keywords: ["analytics", "stats", "metrics"],
    },
    {
      id: "nav-settings",
      title: "Go to Settings",
      icon: Settings,
      action: () => router.push("/dashboard/settings"),
      category: "navigation",
      keywords: ["settings", "preferences", "config"],
    },
    {
      id: "nav-team",
      title: "Manage Team",
      icon: Users,
      action: () => router.push("/dashboard/settings/team"),
      category: "navigation",
      keywords: ["team", "members", "users", "invite"],
      viewerHidden: true,
      adminOnly: true,
    },
    {
      id: "nav-permissions",
      title: "Manage Permissions",
      icon: Shield,
      action: () => router.push("/dashboard/settings/permissions"),
      category: "navigation",
      keywords: ["permissions", "roles", "access", "rbac"],
      viewerHidden: true,
      adminOnly: true,
    },
  ], [router]);

  // Filter out static commands based on role
  const accessibleStaticCommands = useMemo(() => {
    return staticCommands.filter(cmd => {
      // Viewers can't see viewer-hidden commands
      if (isViewer && cmd.viewerHidden) return false;
      // Editors can't see admin-only commands
      if (isEditor && cmd.adminOnly) return false;
      return true;
    });
  }, [staticCommands, isViewer, isEditor]);

  const filteredCommands = useMemo(() => {
    // 1. Static commands filtration
    let results: CommandItem[] = [];
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = accessibleStaticCommands.filter((cmd) => {
        const matchTitle = cmd.title.toLowerCase().includes(lowerQuery);
        const matchKeywords = cmd.keywords?.some((k) => k.includes(lowerQuery));
        return matchTitle || matchKeywords;
      });
    } else {
      results = [...accessibleStaticCommands];
    }

    // 2. Real documents from API
    const docCommands: CommandItem[] = fetchedDocuments.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.status === 'published' ? `Updated ${new Date(doc.updated_at).toLocaleDateString()}` : 'Draft',
      icon: FileText,
      action: () => router.push(`/dashboard/knowledge/${doc.id}`),
      category: query ? "documents" : "recent",
    }));

    // 3. Documentation/Help results
    let helpResults: CommandItem[] = [];
    if (query) {
      helpResults = searchDocs(query).map(doc => ({
        id: `help-${doc.slug}`,
        title: doc.title,
        description: doc.description,
        icon: HelpCircle,
        action: () => router.push(`/docs/${doc.slug}`),
        category: "help",
      }));
    }

    return [...results, ...docCommands, ...helpResults];
  }, [accessibleStaticCommands, fetchedDocuments, query, router]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      actions: [],
      navigation: [],
      recent: [],
      documents: [],
      help: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  const executeCommand = useCallback((command: CommandItem) => {
    command.action();
    onClose();
    setQuery("");
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, executeCommand, onClose]);

  // Reset selection when query or results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredCommands.length]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-x-4 top-[20%] mx-auto max-w-2xl z-50">
        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--border-subtle)]">
            {isSearching ? (
              <Loader2 className="w-5 h-5 shrink-0 text-[var(--brand-primary)] animate-spin" />
            ) : (
              <Search className="w-5 h-5 shrink-0 text-[var(--text-tertiary)]" />
            )}
            <input
              type="text"
              placeholder="Search documents, commands, and help..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-0 h-12 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none text-lg"
              autoFocus
            />
            <kbd className="shrink-0 px-2 py-1 text-xs font-medium bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {filteredCommands.length === 0 && !isSearching ? (
              <div className="py-12 text-center">
                <Search className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-secondary)]">No results found</p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Try searching for something else
                </p>
              </div>
            ) : (
              <>
                {/* Actions */}
                {groupedCommands.actions.length > 0 && (
                  <div className="mb-4">
                    <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      Quick Actions
                    </p>
                    {groupedCommands.actions.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          isSelected={index === selectedIndex}
                          onSelect={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Recent Documents */}
                {groupedCommands.recent.length > 0 && (
                  <div className="mb-4">
                    <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Recent Documents
                    </p>
                    {groupedCommands.recent.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          isSelected={index === selectedIndex}
                          onSelect={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Search Results (Documents) */}
                {groupedCommands.documents.length > 0 && (
                  <div className="mb-4">
                    <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Documents
                    </p>
                    {groupedCommands.documents.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          isSelected={index === selectedIndex}
                          onSelect={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Help & Documentation */}
                {groupedCommands.help.length > 0 && (
                  <div className="mb-4">
                    <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-3 h-3" />
                      Help & Documentation
                    </p>
                    {groupedCommands.help.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          isSelected={index === selectedIndex}
                          onSelect={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Navigation */}
                {groupedCommands.navigation.length > 0 && (
                  <div className="mb-4">
                    <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      Navigation
                    </p>
                    {groupedCommands.navigation.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          isSelected={index === selectedIndex}
                          onSelect={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-ground)]">
            <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded">esc</kbd>
                Close
              </span>
            </div>
            {/* Mobile Footer Hint (Replaces Shortcuts) */}
            <div className="sm:hidden text-xs text-[var(--text-tertiary)]">
              Tap to select
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] whitespace-nowrap">
              <Zap className="w-3 h-3" />
              Powered by TyneBase
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CommandRow({
  command,
  isSelected,
  onSelect,
}: {
  command: CommandItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = command.icon;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isSelected
        ? "bg-[var(--brand-primary)] text-white"
        : "hover:bg-[var(--surface-ground)] text-[var(--text-primary)]"
        }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected
        ? "bg-white/20"
        : "bg-[var(--surface-ground)]"
        }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{command.title}</p>
        {command.description && (
          <p className={`text-sm truncate ${isSelected ? "text-white/70" : "text-[var(--text-tertiary)]"
            }`}>
            {command.description}
          </p>
        )}
      </div>
      <ArrowRight className={`w-4 h-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}

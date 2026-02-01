"use client";

import { useState, useEffect } from "react";
import {
  History,
  Clock,
  User,
  RotateCcw,
  Eye,
  X,
  ChevronRight,
  Calendar,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentVersion {
  id: string;
  version_number: number;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
  user_email?: string;
}

interface VersionHistoryPanelProps {
  documentId: string;
  currentTitle: string;
  onClose: () => void;
  onRestore: (version: DocumentVersion) => void;
}

export function VersionHistoryPanel({
  documentId,
  currentTitle,
  onClose,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      // Get tenant subdomain from hostname
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const subdomain = hostname.split('.')[0] || 'localhost';
      
      const response = await fetch(`${apiUrl}/api/documents/${documentId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tenant-subdomain': subdomain === 'localhost' ? (localStorage.getItem('tenant_subdomain') || 'maiknd88') : subdomain,
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          // No versions yet or table doesn't exist - that's okay
          setVersions([]);
          return;
        }
        throw new Error("Failed to fetch versions");
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      setError(err instanceof Error ? err.message : "Failed to load version history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (version: DocumentVersion) => {
    setIsRestoring(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const subdomain = hostname.split('.')[0] || 'localhost';
      
      const response = await fetch(
        `${apiUrl}/api/documents/${documentId}/versions/${version.id}/restore`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            'x-tenant-subdomain': subdomain === 'localhost' ? (localStorage.getItem('tenant_subdomain') || 'maiknd88') : subdomain,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      onRestore(version);
    } catch (err) {
      console.error("Failed to restore version:", err);
      setError(err instanceof Error ? err.message : "Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group versions by date
  const groupedVersions = versions.reduce((groups, version) => {
    const date = new Date(version.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(version);
    return groups;
  }, {} as Record<string, DocumentVersion[]>);

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Version history panel - modal on mobile, sidebar on desktop */}
      <div className="fixed lg:relative inset-y-0 right-0 w-full sm:w-96 lg:w-80 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] flex flex-col h-full z-50 lg:z-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--text-secondary)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Version History</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--brand-primary)] animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-[var(--status-error)]">{error}</p>
            <button
              onClick={fetchVersions}
              className="mt-2 text-sm text-[var(--brand-primary)] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-ground)] flex items-center justify-center">
              <FileText className="w-6 h-6 text-[var(--text-tertiary)]" />
            </div>
            <h4 className="font-medium text-[var(--text-primary)] mb-1">No versions yet</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              Versions are created automatically as you edit. Keep writing!
            </p>
          </div>
        ) : (
          <div className="p-2">
            {/* Current Version */}
            <div className="mb-4">
              <div className="px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] uppercase">
                Current
              </div>
              <div className="p-3 rounded-lg bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[var(--text-primary)] text-sm">
                      {currentTitle || "Untitled"}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Live version</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                </div>
              </div>
            </div>

            {/* Version Groups */}
            {Object.entries(groupedVersions).map(([date, dateVersions]) => (
              <div key={date} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Calendar className="w-3 h-3 text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="space-y-1">
                  {dateVersions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => setSelectedVersion(version)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedVersion?.id === version.id
                          ? "bg-[var(--surface-ground)] border border-[var(--border-default)]"
                          : "hover:bg-[var(--surface-ground)] border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                            Version {version.version_number}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-[var(--text-tertiary)]" />
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {formatDate(version.created_at)}
                            </span>
                          </div>
                          {version.user_email && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <User className="w-3 h-3 text-[var(--text-tertiary)]" />
                              <span className="text-xs text-[var(--text-tertiary)] truncate">
                                {version.user_email}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version Preview */}
      {selectedVersion && (
        <div className="border-t border-[var(--border-subtle)] p-4 bg-[var(--surface-ground)]">
          <div className="mb-3">
            <h4 className="font-medium text-[var(--text-primary)] text-sm">
              Version {selectedVersion.version_number}
            </h4>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {formatFullDate(selectedVersion.created_at)}
            </p>
          </div>

          {selectedVersion.content && (
            <div className="mb-3 p-2 bg-[var(--surface-card)] rounded-md max-h-32 overflow-y-auto">
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-5">
                {selectedVersion.content.substring(0, 500)}
                {selectedVersion.content.length > 500 && "..."}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => {
                // Preview functionality could open a modal
                console.log("Preview version:", selectedVersion);
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => handleRestore(selectedVersion)}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Restore
            </Button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

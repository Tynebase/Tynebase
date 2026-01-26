"use client";

import { useState } from "react";
import { 
  History, 
  RotateCcw, 
  Eye, 
  ChevronDown,
  ChevronRight,
  Check,
  Diff
} from "lucide-react";
import { Button } from "./Button";

interface Version {
  id: string;
  version: number;
  author: {
    name: string;
    avatar: string;
  };
  timestamp: string;
  changes: string;
  wordCount: number;
  isPublished: boolean;
  isCurrent: boolean;
}

interface VersionHistoryProps {
  versions: Version[];
  onRestore: (versionId: string) => void;
  onPreview: (versionId: string) => void;
  onCompare: (versionA: string, versionB: string) => void;
}

const defaultVersions: Version[] = [
  {
    id: "v5",
    version: 5,
    author: { name: "Sarah Chen", avatar: "SC" },
    timestamp: "2026-01-11T14:30:00Z",
    changes: "Updated authentication examples",
    wordCount: 1847,
    isPublished: true,
    isCurrent: true,
  },
  {
    id: "v4",
    version: 4,
    author: { name: "John Smith", avatar: "JS" },
    timestamp: "2026-01-10T16:45:00Z",
    changes: "Added rate limiting section",
    wordCount: 1756,
    isPublished: true,
    isCurrent: false,
  },
  {
    id: "v3",
    version: 3,
    author: { name: "Sarah Chen", avatar: "SC" },
    timestamp: "2026-01-09T11:20:00Z",
    changes: "Restructured API endpoints",
    wordCount: 1623,
    isPublished: true,
    isCurrent: false,
  },
  {
    id: "v2",
    version: 2,
    author: { name: "Emily Davis", avatar: "ED" },
    timestamp: "2026-01-08T09:15:00Z",
    changes: "Fixed code examples",
    wordCount: 1534,
    isPublished: false,
    isCurrent: false,
  },
  {
    id: "v1",
    version: 1,
    author: { name: "Sarah Chen", avatar: "SC" },
    timestamp: "2026-01-07T14:00:00Z",
    changes: "Initial version",
    wordCount: 1245,
    isPublished: true,
    isCurrent: false,
  },
];

export function VersionHistory({ 
  versions = defaultVersions,
  onRestore,
  onPreview,
  onCompare 
}: Partial<VersionHistoryProps>) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const toggleVersion = (versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length < 2) {
        return [...prev, versionId];
      }
      return [prev[1], versionId];
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTimeDiff = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTimestamp(timestamp);
  };

  return (
    <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-[var(--text-secondary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Version History</h3>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          {versions.length} versions • Last updated {getTimeDiff(versions[0]?.timestamp || "")}
        </p>
      </div>

      {/* Compare Button */}
      {selectedVersions.length === 2 && (
        <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-ground)]">
          <Button 
            variant="primary" 
            className="w-full gap-2"
            onClick={() => onCompare?.(selectedVersions[0], selectedVersions[1])}
          >
            <Diff className="w-4 h-4" />
            Compare Selected Versions
          </Button>
        </div>
      )}

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {versions.map((version, index) => {
          const isSelected = selectedVersions.includes(version.id);
          const isExpanded = expandedVersion === version.id;
          const prevVersion = versions[index + 1];
          const wordDiff = prevVersion ? version.wordCount - prevVersion.wordCount : version.wordCount;

          return (
            <div
              key={version.id}
              className={`border-b border-[var(--border-subtle)] ${
                isSelected ? "bg-[var(--brand-primary)]/5" : ""
              }`}
            >
              <div className="p-3">
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  <button
                    onClick={() => toggleVersion(version.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-[var(--border-default)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>

                  {/* Version Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[var(--text-primary)]">
                        Version {version.version}
                      </span>
                      {version.isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded">
                          Current
                        </span>
                      )}
                      {version.isPublished && !version.isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded">
                          Published
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] line-clamp-1">
                      {version.changes}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-[10px] font-medium">
                          {version.author.avatar}
                        </div>
                        <span>{version.author.name}</span>
                      </div>
                      <span>•</span>
                      <span>{getTimeDiff(version.timestamp)}</span>
                    </div>

                    {/* Word Count Change */}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="text-[var(--text-tertiary)]">
                        {version.wordCount.toLocaleString()} words
                      </span>
                      {wordDiff !== 0 && (
                        <span className={wordDiff > 0 ? "text-green-500" : "text-red-500"}>
                          {wordDiff > 0 ? "+" : ""}{wordDiff}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedVersion(isExpanded ? null : version.id)}
                    className="p-1 rounded hover:bg-[var(--surface-ground)] text-[var(--text-tertiary)]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Actions */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() => onPreview?.(version.id)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </Button>
                    {!version.isCurrent && (
                      <Button
                        variant="outline"
                        className="flex-1 h-8 text-xs gap-1"
                        onClick={() => onRestore?.(version.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--surface-ground)]">
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Select two versions to compare changes
        </p>
      </div>
    </div>
  );
}

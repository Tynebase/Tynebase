"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Search,
  Filter,
  FileText,
  CheckCircle,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  Video,
  FileType,
  Link as LinkIcon,
  Edit,
  EyeOff,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getKnowledgeActivity,
  getActivityTypes,
  type ActivityItem,
  type ActivityType,
  type ActivityTypeOption,
  type ActivityPagination,
} from "@/lib/api/knowledge-activity";

function TypeIcon({ type }: { type: ActivityType }) {
  switch (type) {
    case "published":
      return <CheckCircle className="w-4 h-4" />;
    case "unpublished":
      return <EyeOff className="w-4 h-4" />;
    case "ai_generated":
    case "ai_enhanced":
      return <Sparkles className="w-4 h-4" />;
    case "converted_from_video":
      return <Video className="w-4 h-4" />;
    case "converted_from_pdf":
    case "converted_from_docx":
      return <FileType className="w-4 h-4" />;
    case "converted_from_url":
      return <LinkIcon className="w-4 h-4" />;
    case "edited":
      return <Edit className="w-4 h-4" />;
    case "created":
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function TypeColor({ type }: { type: ActivityType }) {
  switch (type) {
    case "published":
      return { fg: "#10b981", bg: "#10b98115" };
    case "unpublished":
      return { fg: "#ef4444", bg: "#ef444415" };
    case "ai_generated":
    case "ai_enhanced":
      return { fg: "#8b5cf6", bg: "#8b5cf615" };
    case "converted_from_video":
    case "converted_from_pdf":
    case "converted_from_docx":
    case "converted_from_url":
      return { fg: "#3b82f6", bg: "#3b82f615" };
    case "created":
      return { fg: "#f59e0b", bg: "#f59e0b15" };
    case "edited":
    default:
      return { fg: "#6b7280", bg: "#6b728015" };
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export default function KnowledgeActivityPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pagination, setPagination] = useState<ActivityPagination | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>([]);
  const [selectedType, setSelectedType] = useState<ActivityType | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch activity types on mount
  useEffect(() => {
    getActivityTypes()
      .then((res) => setActivityTypes(res.types))
      .catch(() => {});
  }, []);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getKnowledgeActivity({
        page,
        limit: 20,
        search: debouncedQuery || undefined,
        type: selectedType || undefined,
      });
      setActivities(response.activities);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setActivities([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, selectedType]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleTypeChange = (type: ActivityType | "") => {
    setSelectedType(type);
    setPage(1);
  };

  return (
    <div className="min-h-full flex flex-col gap-8 pb-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--dash-text-primary)]" />
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Activity</h1>
          </div>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Track edits, AI generations, publishes and imports across the knowledge base.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/community"
            className="inline-flex items-center gap-2 h-10 px-6 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            Community
          </Link>
          <Link
            href="/dashboard/knowledge/documents/new"
            className="inline-flex items-center gap-2 h-10 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Document
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--dash-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity..."
            className="w-full box-border h-12 pl-12 pr-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm leading-[1.2] text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center justify-center gap-2 h-12 px-6 bg-[var(--surface-card)] border rounded-xl text-sm font-medium transition-all ${
            showFilters || selectedType
              ? "border-[var(--brand)] text-[var(--brand)]"
              : "border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {selectedType && <span className="w-2 h-2 bg-[var(--brand)] rounded-full" />}
        </button>
      </div>

      {showFilters && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTypeChange("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !selectedType
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--surface-hover)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border-subtle)]"
              }`}
            >
              All Types
            </button>
            {activityTypes.map((typeOption) => (
              <button
                key={typeOption.value}
                onClick={() => handleTypeChange(typeOption.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedType === typeOption.value
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--surface-hover)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border-subtle)]"
                }`}
              >
                {typeOption.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex-1 min-h-0">
        {loading ? (
          <div className="px-6 py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)] mx-auto" />
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-3">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-medium text-[var(--dash-text-primary)] mt-3">Failed to load activity</p>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{error}</p>
            <button
              onClick={fetchActivities}
              className="mt-4 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-dark)] transition-all"
            >
              Try Again
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Activity className="w-8 h-8 text-[var(--dash-text-muted)] mx-auto" />
            <p className="text-sm font-medium text-[var(--dash-text-primary)] mt-3">No activity found</p>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              {query || selectedType ? "Try adjusting your search or filters." : "Activity will appear here as you work with documents."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {activities.map((item) => {
              const colors = TypeColor({ type: item.type });
              return (
                <Link
                  key={item.id}
                  href={`/dashboard/knowledge/${item.target.id}`}
                  className="block px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <span style={{ color: colors.fg }}>
                        <TypeIcon type={item.type} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--dash-text-secondary)]">
                        <span className="font-semibold text-[var(--dash-text-primary)]">{item.actor.name}</span>{" "}
                        {item.type.replace(/_/g, " ")}{" "}
                        <span className="font-semibold text-[var(--dash-text-primary)]">{item.target.title}</span>
                      </p>
                      {item.detail && (
                        <p className="text-sm text-[var(--dash-text-tertiary)] mt-1 truncate">{item.detail}</p>
                      )}
                      <p className="text-xs text-[var(--dash-text-muted)] mt-2 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--dash-text-tertiary)]">
            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} activities
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.has_prev}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-[var(--dash-text-primary)] px-3">
              {pagination.page} / {pagination.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.has_next}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

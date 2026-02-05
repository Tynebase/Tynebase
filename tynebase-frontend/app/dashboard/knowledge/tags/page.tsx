"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Hash, Plus, Search, Sparkles, FileText, ArrowRight, TrendingUp, Filter, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { listTags, createTag, type Tag as APITag } from "@/lib/api/tags";

type Tag = {
  id: string;
  name: string;
  description: string;
  documents: number;
  updatedAt: string;
  trend: "up" | "flat" | "down";
  aiSuggested?: boolean;
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return diffMins === 0 ? 'Just now' : `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const mapAPITagToUI = (tag: APITag): Tag => ({
  id: tag.id,
  name: capitalizeFirstLetter(tag.name),
  description: tag.description || '',
  documents: tag.document_count,
  updatedAt: formatRelativeTime(tag.updated_at),
  trend: 'flat',
  aiSuggested: false,
});

function TrendBadge({ trend }: { trend: Tag["trend"] }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success)]">
        <TrendingUp className="w-3 h-3" />
        Trending
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--status-error-bg)] text-[var(--status-error)]">
        Cooling
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
      Stable
    </span>
  );
}

export default function TagsPage() {
  const [query, setQuery] = useState("");
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await listTags({ limit: 100 });
        const uiTags = response.tags.map(mapAPITagToUI);
        setTags(uiTags);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
  }, [query, tags]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      setCreating(true);
      setError(null);
      const response = await createTag({
        name: newTagName.trim(),
        description: newTagDescription.trim() || undefined,
      });
      
      const newTag = mapAPITagToUI(response.tag);
      setTags(prev => [newTag, ...prev]);
      
      // Reset form and close modal
      setNewTagName("");
      setNewTagDescription("");
      setShowNewTagModal(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex min-h-full flex-col px-2 sm:px-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Tags</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Organise articles with tags to reduce duplicates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/knowledge"
            className="inline-flex items-center gap-2 h-11 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <FileText className="w-4 h-4" />
            Browse Docs
          </Link>
          <button 
            onClick={() => setShowNewTagModal(true)}
            className="inline-flex items-center gap-2 h-11 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Tag
          </button>
        </div>
      </div>

      <div className="h-6" />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full h-12 pl-12 pr-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all leading-none"
          />
        </div>
        <button className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="h-2" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <span className="ml-3 text-[var(--dash-text-secondary)]">Loading tags...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--status-error)] mb-1">Failed to load tags</h3>
            <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Hash className="w-16 h-16 text-[var(--dash-text-muted)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
            {query ? 'No tags found' : 'No tags yet'}
          </h3>
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
            {query ? 'Try adjusting your search query.' : 'Create your first tag to start organizing your documents.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 flex-1 content-start">
          {filtered.map((t) => (
          <Card
            key={t.id}
            className="hover:shadow-lg hover:border-[var(--brand)] transition-all"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] flex items-center justify-center">
                      <Hash className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[var(--dash-text-primary)] truncate">#{capitalizeFirstLetter(t.name)}</h3>
                      <p className="text-xs text-[var(--dash-text-muted)]">{t.documents} docs</p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--dash-text-tertiary)] mt-3 line-clamp-2">{t.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <TrendBadge trend={t.trend} />
                  {t.aiSuggested && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--brand)]/10 text-[var(--brand)]">
                      <Sparkles className="w-3 h-3" />
                      AI
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[var(--dash-text-muted)]">Updated {t.updatedAt}</span>
                <Link
                  href={`/dashboard/knowledge?tag=${t.id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  View Docs
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                  title="Delete tag"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

      {/* New Tag Modal */}
      {showNewTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Create New Tag</h2>
              <button
                onClick={() => setShowNewTagModal(false)}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., api, security, onboarding"
                  disabled={creating}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                  placeholder="Brief description of what this tag represents..."
                  rows={3}
                  disabled={creating}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewTagModal(false);
                  setError(null);
                }}
                disabled={creating}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || creating}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tag'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

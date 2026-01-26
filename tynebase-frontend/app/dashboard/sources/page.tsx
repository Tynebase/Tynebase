"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Upload,
  Search,
  Filter,
  FileText,
  File,
  FileType,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { apiGet } from "@/lib/api/client";

type SourceType = "pdf" | "docx" | "md";

type SourceStatus =
  | "uploaded"
  | "normalizing"
  | "normalized"
  | "chunking"
  | "embedded"
  | "failed";

type Source = {
  id: string;
  title: string;
  filename: string;
  type: SourceType;
  status: SourceStatus;
  sizeMb: number;
  updatedAt: string;
  chunks?: number;
  tokens?: number;
  notes?: string;
};

interface SourceHealthResponse {
  success: boolean;
  data: {
    total_documents: number;
    indexed_documents: number;
    outdated_documents: number;
    never_indexed_documents: number;
    failed_jobs: number;
    documents_needing_reindex: Array<{
      id: string;
      title: string;
      reason: 'never_indexed' | 'outdated';
      last_indexed_at: string | null;
      updated_at: string;
    }>;
  };
}

function TypeBadge({ type }: { type: SourceType }) {
  const label = type.toUpperCase();
  const style =
    type === "pdf"
      ? { fg: "#ef4444", bg: "#ef444415" }
      : type === "docx"
        ? { fg: "#3b82f6", bg: "#3b82f615" }
        : { fg: "#10b981", bg: "#10b98115" };

  const Icon = type === "pdf" ? File : type === "docx" ? FileType : FileText;

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: style.fg, backgroundColor: style.bg }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const map: Record<SourceStatus, { label: string; fg: string; bg: string; icon?: React.ElementType }>
    = {
    uploaded: { label: "Uploaded", fg: "#6b7280", bg: "#6b728015", icon: Clock },
    normalizing: { label: "Normalizing", fg: "#8b5cf6", bg: "#8b5cf615", icon: Sparkles },
    normalized: { label: "Normalized", fg: "#0ea5e9", bg: "#0ea5e915", icon: CheckCircle },
    chunking: { label: "Chunking", fg: "#f59e0b", bg: "#f59e0b15", icon: Clock },
    embedded: { label: "Embedded", fg: "#10b981", bg: "#10b98115", icon: CheckCircle },
    failed: { label: "Failed", fg: "#ef4444", bg: "#ef444415", icon: AlertTriangle },
  };

  const item = map[status];
  const Icon = item.icon;

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: item.fg, backgroundColor: item.bg }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {item.label}
    </span>
  );
}

export default function SourcesPage() {
  const [query, setQuery] = useState("");
  const [healthData, setHealthData] = useState<SourceHealthResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet<SourceHealthResponse>('/api/sources/health');
      setHealthData(response.data);
    } catch (err) {
      console.error('Failed to fetch source health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load source health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const filtered = useMemo(() => {
    if (!healthData) return [];
    const q = query.trim().toLowerCase();
    if (!q) return healthData.documents_needing_reindex;
    return healthData.documents_needing_reindex.filter((doc) => 
      doc.title.toLowerCase().includes(q)
    );
  }, [query, healthData]);

  const stats = useMemo(() => {
    if (!healthData) {
      return { total: 0, indexed: 0, needingReindex: 0, failed: 0 };
    }
    return {
      total: healthData.total_documents,
      indexed: healthData.indexed_documents,
      needingReindex: healthData.outdated_documents + healthData.never_indexed_documents,
      failed: healthData.failed_jobs,
    };
  }, [healthData]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Knowledge Sources</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1 max-w-3xl leading-relaxed">
            Upload PDFs, DOCX and Markdown. TyneBase normalizes to Markdown and builds embeddings for RAG.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href="/dashboard/sources/query"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Query Workspace
          </Link>
          <button className="inline-flex items-center justify-center gap-2 h-12 px-7 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-semibold transition-all">
            <Upload className="w-4 h-4" />
            Add Sources
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Total Documents</p>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1">
              {loading ? '...' : stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Indexed</p>
            <p className="text-2xl font-bold text-[var(--status-success)] mt-1">
              {loading ? '...' : stats.indexed}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Needs Re-Index</p>
            <p className="text-2xl font-bold text-[var(--status-warning)] mt-1">
              {loading ? '...' : stats.needingReindex}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Failed Jobs</p>
            <p className="text-2xl font-bold text-[var(--status-error)] mt-1">
              {loading ? '...' : stats.failed}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources by title or filename…"
            className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
          />
        </div>
        <button className="inline-flex items-center justify-center gap-2 h-12 px-7 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          <p className="font-semibold">Error loading source health data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchHealthData}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--dash-text-primary)]">
            Documents Needing Re-Index
          </h2>
          <button
            onClick={fetchHealthData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto divide-y divide-[var(--dash-border-subtle)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-[var(--dash-text-muted)] animate-spin mx-auto mb-3" />
                <p className="text-sm text-[var(--dash-text-muted)]">Loading source health data...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-[var(--status-success)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">All documents are up to date!</p>
                <p className="text-xs text-[var(--dash-text-muted)] mt-1">No documents need re-indexing.</p>
              </div>
            </div>
          ) : (
            filtered.map((doc) => (
              <div key={doc.id} className="block hover:bg-[var(--surface-hover)] transition-colors">
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center flex-shrink-0">
                        <Database className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--dash-text-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            {doc.reason === 'never_indexed' ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                Never indexed
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-yellow-500" />
                                Outdated
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
                          {doc.last_indexed_at && (
                            <>
                              <span>•</span>
                              <span>Last indexed {new Date(doc.last_indexed_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/knowledge/${doc.id}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] hover:underline flex-shrink-0"
                    >
                      View
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-xs text-[var(--dash-text-muted)]">
        This is a UI scaffold aligned to PRD Part IV: documents are normalized to Markdown before semantic chunking + embeddings.
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Upload,
  Search,
  FileText,
  File,
  FileType as FileTypeIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { apiGet, apiPost } from "@/lib/api/client";
import { reindexDocument, pollJobUntilComplete, Job } from "@/lib/api/ai";
import { DocumentImportModal } from "@/components/docs/DocumentImportModal";
import { Modal } from "@/components/ui/Modal";

type FileType = "pdf" | "docx" | "md" | "unknown";
type IndexingStatus = "indexed" | "pending" | "outdated" | "failed";

interface Source {
  id: string;
  title: string;
  file_type: FileType;
  indexing_status: IndexingStatus;
  chunk_count: number;
  content_length: number;
  created_at: string;
  updated_at: string;
  last_indexed_at: string | null;
  author: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

interface SourcesResponse {
  sources: Source[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface SourceHealthResponse {
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
}

function TypeBadge({ type }: { type: FileType }) {
  const label = type === "unknown" ? "DOC" : type.toUpperCase();
  const style =
    type === "pdf"
      ? { fg: "#ef4444", bg: "#ef444415" }
      : type === "docx"
        ? { fg: "#3b82f6", bg: "#3b82f615" }
        : { fg: "#10b981", bg: "#10b98115" };

  const Icon = type === "pdf" ? File : type === "docx" ? FileTypeIcon : FileText;

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

function IndexingStatusBadge({ status }: { status: IndexingStatus }) {
  const map: Record<IndexingStatus, { label: string; fg: string; bg: string; icon: React.ElementType }> = {
    indexed: { label: "Indexed", fg: "#10b981", bg: "#10b98115", icon: CheckCircle },
    pending: { label: "Pending", fg: "#6b7280", bg: "#6b728015", icon: Clock },
    outdated: { label: "Outdated", fg: "#f59e0b", bg: "#f59e0b15", icon: AlertTriangle },
    failed: { label: "Failed", fg: "#ef4444", bg: "#ef444415", icon: AlertTriangle },
  };

  const item = map[status];
  const Icon = item.icon;

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: item.fg, backgroundColor: item.bg }}
    >
      <Icon className="w-3.5 h-3.5" />
      {item.label}
    </span>
  );
}

export default function SourcesPage() {
  const [query, setQuery] = useState("");
  const [healthData, setHealthData] = useState<SourceHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexingDocs, setReindexingDocs] = useState<Record<string, { jobId: string; progress: number; status: string }>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<'all' | 'never_indexed' | 'outdated'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [retryResult, setRetryResult] = useState<{ reset: number; failed: number } | null>(null);
  const [normalizedDocs, setNormalizedDocs] = useState<Array<{ id: string; title: string; normalizedMd: string; status: string; updatedAt: string }> | null>(null);
  const [loadingNormalized, setLoadingNormalized] = useState(false);
  const [showNormalizedModal, setShowNormalizedModal] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet<SourceHealthResponse>('/api/sources/health');
      setHealthData(response);
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

  const handleReindex = async (documentId: string, documentTitle: string) => {
    try {
      const response = await reindexDocument(documentId);
      const jobId = response.job_id;
      
      setReindexingDocs(prev => ({
        ...prev,
        [documentId]: { jobId, progress: 0, status: 'pending' }
      }));

      pollJobUntilComplete(
        jobId,
        (job: Job) => {
          setReindexingDocs(prev => ({
            ...prev,
            [documentId]: {
              jobId,
              progress: job.progress,
              status: job.status
            }
          }));
        },
        2000,
        150
      ).then((finalJob) => {
        if (finalJob.status === 'completed') {
          setTimeout(() => {
            setReindexingDocs(prev => {
              const updated = { ...prev };
              delete updated[documentId];
              return updated;
            });
            fetchHealthData();
          }, 2000);
        }
      }).catch((err) => {
        console.error('Re-index polling failed:', err);
        setReindexingDocs(prev => {
          const updated = { ...prev };
          delete updated[documentId];
          return updated;
        });
      });
    } catch (err) {
      console.error('Failed to trigger re-index:', err);
      alert(err instanceof Error ? err.message : 'Failed to trigger re-index');
    }
  };

  const handleRetryFailed = async () => {
    try {
      setRetryingFailed(true);
      setRetryResult(null);
      const response = await apiPost<{ stuck_jobs_found: number; reset_jobs: number; failed_jobs: number }>('/api/sources/repair/stuck-jobs', { max_age_minutes: 5 });
      setRetryResult({ reset: response.reset_jobs, failed: response.failed_jobs });
      // Refresh health data after repair
      await fetchHealthData();
    } catch (err) {
      console.error('Failed to retry failed jobs:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry failed jobs');
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleReviewNormalized = async () => {
    try {
      setLoadingNormalized(true);
      setShowNormalizedModal(true);
      const response = await apiGet<{ documents: Array<{ id: string; title: string; normalizedMd: string; status: string; updatedAt: string }>; count: number }>('/api/sources/normalized');
      setNormalizedDocs(response.documents);
    } catch (err) {
      console.error('Failed to fetch normalized documents:', err);
      alert(err instanceof Error ? err.message : 'Failed to fetch normalized documents');
      setShowNormalizedModal(false);
    } finally {
      setLoadingNormalized(false);
    }
  };

  const filtered = useMemo(() => {
    if (!healthData) return [];
    let result = healthData.documents_needing_reindex;
    if (reasonFilter !== 'all') {
      result = result.filter((doc) => doc.reason === reasonFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((doc) => doc.title.toLowerCase().includes(q));
    }
    return result;
  }, [query, healthData, reasonFilter]);

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
            Upload PDFs, DOCX and Markdown. TyneBase normalises to Markdown and builds embeddings for RAG.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href="/dashboard/ai-assistant/ask"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Query Workspace
          </Link>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-semibold transition-all"
          >
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
        <Card
          className="cursor-pointer hover:border-[var(--status-warning)] transition-all"
          onClick={() => document.getElementById('documents-needing-reindex')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        >
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Needs Re-indexed</p>
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
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center justify-center gap-2 h-12 px-7 bg-[var(--surface-card)] border rounded-xl text-sm font-semibold transition-all ${
              reasonFilter !== 'all' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters{reasonFilter !== 'all' ? ' (1)' : ''}
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-20 py-1">
              {([['all', 'All Documents'], ['never_indexed', 'Never Indexed'], ['outdated', 'Needs Re-indexing']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setReasonFilter(value); setShowFilters(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    reasonFilter === value ? 'bg-[var(--brand-primary-muted)] text-[var(--brand)] font-medium' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
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

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { fetchHealthData(); }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-run Health Checks
        </button>
        <button
          onClick={handleRetryFailed}
          disabled={retryingFailed || (stats.failed === 0)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--status-warning)] hover:text-[var(--status-warning)] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${retryingFailed ? 'animate-spin' : ''}`} />
          {retryingFailed ? 'Retrying...' : 'Retry Failed Normalisations'}
        </button>
        <button
          onClick={handleReviewNormalized}
          disabled={loadingNormalized}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          Review Normalised Markdown
        </button>
        {retryResult && (
          <span className="text-xs text-[var(--dash-text-muted)]">
            {retryResult.reset > 0 ? `${retryResult.reset} job(s) reset for retry.` : ''}
            {retryResult.failed > 0 ? ` ${retryResult.failed} exceeded retries.` : ''}
            {retryResult.reset === 0 && retryResult.failed === 0 ? 'No stuck jobs found.' : ''}
          </span>
        )}
      </div>

      <div id="documents-needing-reindex" className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--dash-text-primary)]">
            Documents needing Re-indexing
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
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {reindexingDocs[doc.id] ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                          <span className="text-sm font-medium text-blue-700">
                            {reindexingDocs[doc.id].status === 'pending' && 'Queued...'}
                            {reindexingDocs[doc.id].status === 'processing' && `Indexing ${reindexingDocs[doc.id].progress}%`}
                            {reindexingDocs[doc.id].status === 'completed' && 'Complete!'}
                            {reindexingDocs[doc.id].status === 'failed' && 'Failed'}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleReindex(doc.id, doc.title)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Re-Index
                        </button>
                      )}
                      <Link
                        href={`/dashboard/knowledge/${doc.id}`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                      >
                        View
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-xs text-[var(--dash-text-muted)]">
        Upload PDFs, DOCX and Markdown. TyneBase normalises to Markdown and builds embeddings for RAG.
      </div>

      <DocumentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchHealthData();
        }}
      />

      {/* Normalized Markdown Review Modal */}
      <Modal
        isOpen={showNormalizedModal}
        onClose={() => { setShowNormalizedModal(false); setNormalizedDocs(null); setExpandedDocId(null); }}
        title="Normalised Markdown"
        description="Review the markdown content that TyneBase has normalised for RAG indexing."
        size="full"
      >
        {loadingNormalized ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-[var(--dash-text-muted)] animate-spin" />
            <span className="ml-3 text-sm text-[var(--dash-text-muted)]">Loading normalised documents...</span>
          </div>
        ) : normalizedDocs && normalizedDocs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-[var(--dash-text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--dash-text-muted)]">No normalised documents found.</p>
          </div>
        ) : normalizedDocs ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--dash-text-muted)] mb-4">{normalizedDocs.length} document(s) with normalised content</p>
            {normalizedDocs.map((doc) => (
              <div key={doc.id} className="border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)] flex-shrink-0" />
                    <span className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</span>
                    <span className="text-xs text-[var(--dash-text-muted)] flex-shrink-0">
                      {doc.normalizedMd.length.toLocaleString()} chars
                    </span>
                  </div>
                  <span className="text-xs text-[var(--dash-text-muted)] flex-shrink-0 ml-2">
                    {expandedDocId === doc.id ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                {expandedDocId === doc.id && (
                  <div className="px-4 pb-4 border-t border-[var(--dash-border-subtle)]">
                    <pre className="mt-3 p-4 bg-[var(--surface-ground)] rounded-lg text-xs text-[var(--dash-text-secondary)] overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                      {doc.normalizedMd}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

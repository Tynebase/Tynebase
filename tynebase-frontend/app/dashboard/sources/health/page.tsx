"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import {
  HeartPulse,
  Database,
  Sparkles,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCcw,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { apiGet, apiPost } from "@/lib/api/client";

interface PipelineEvent {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  label: string;
  detail: string;
  time_ago: string;
  status: string;
}

interface HealthData {
  total_documents: number;
  indexed_documents: number;
  outdated_documents: number;
  never_indexed_documents: number;
  failed_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  total_chunks: number;
  pipeline_events: PipelineEvent[];
  documents_needing_reindex: Array<{
    id: string;
    title: string;
    reason: 'never_indexed' | 'outdated';
    last_indexed_at: string | null;
    updated_at: string;
  }>;
}

const EVENT_STYLES: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  success: { color: '#10b981', bg: '#10b98115', icon: CheckCircle },
  warning: { color: '#f59e0b', bg: '#f59e0b15', icon: Clock },
  error:   { color: '#ef4444', bg: '#ef444415', icon: AlertTriangle },
  info:    { color: '#6b7280', bg: '#6b728015', icon: Info },
};

export default function SourcesHealthPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<{ reset: number; failed: number } | null>(null);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const response = await apiGet<HealthData>('/api/sources/health');
      setData(response);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const handleRetryFailed = async () => {
    try {
      setRetrying(true);
      setRetryResult(null);
      const response = await apiPost<{ stuck_jobs_found: number; reset_jobs: number; failed_jobs: number }>(
        '/api/sources/repair/stuck-jobs',
        { max_age_minutes: 5 }
      );
      setRetryResult({ reset: response.reset_jobs, failed: response.failed_jobs });
      await fetchHealth(true);
    } catch (err) {
      console.error('Failed to retry:', err);
      addToast({ type: 'error', title: 'Retry failed', description: err instanceof Error ? err.message : 'Failed to retry failed jobs' });
    } finally {
      setRetrying(false);
    }
  };

  // Compute retrieval readiness
  const readiness = data
    ? data.total_documents === 0
      ? { label: 'No data', color: 'var(--dash-text-muted)' }
      : data.indexed_documents === data.total_documents && data.failed_jobs === 0 && data.processing_jobs === 0
        ? { label: 'Good', color: 'var(--status-success)' }
        : data.failed_jobs > 0
          ? { label: 'Degraded', color: 'var(--status-error)' }
          : { label: 'Syncing', color: 'var(--status-warning)' }
    : { label: '—', color: 'var(--dash-text-muted)' };

  const embeddingJobTotal = (data?.pending_jobs || 0) + (data?.processing_jobs || 0);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
          <p className="text-sm text-[var(--dash-text-tertiary)]">Loading health data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--status-error)]" />
          <p className="text-sm text-[var(--dash-text-primary)] font-medium">{error}</p>
          <button onClick={() => fetchHealth()} className="text-sm text-[var(--brand)] hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Index Health</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Monitor normalisation, chunking, embeddings and retrieval readiness.
          </p>
        </div>
        <button
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all w-full sm:w-auto disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Re-run health checks'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Sources</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">{data?.total_documents ?? 0}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
              {data?.indexed_documents ?? 0} indexed • {data?.never_indexed_documents ?? 0} pending • {data?.failed_jobs ?? 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Total chunks</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">{(data?.total_chunks ?? 0).toLocaleString()}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Across {data?.indexed_documents ?? 0} indexed documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--brand)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Embedding jobs</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">{embeddingJobTotal}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
              Queue: {data?.pending_jobs ?? 0} • Running: {data?.processing_jobs ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4" style={{ color: readiness.color }} />
              <p className="text-xs text-[var(--dash-text-muted)]">Retrieval readiness</p>
            </div>
            <p className="text-2xl font-bold mt-2" style={{ color: readiness.color }}>{readiness.label}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
              {data?.outdated_documents ?? 0} outdated documents
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        <Card className="col-span-12 xl:col-span-7 flex flex-col min-h-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Pipeline events</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--dash-border-subtle)] flex-1 min-h-0 overflow-auto">
            {(!data?.pipeline_events || data.pipeline_events.length === 0) ? (
              <div className="p-8 text-center">
                <Clock className="w-8 h-8 text-[var(--dash-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--dash-text-muted)]">No pipeline events yet</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Events will appear here when documents are published or re-indexed.</p>
              </div>
            ) : (
              data.pipeline_events.map((event) => {
                const style = EVENT_STYLES[event.type] || EVENT_STYLES.info;
                const Icon = style.icon;
                return (
                  <div key={event.id} className="p-5 flex items-start gap-4">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: style.bg }}>
                      <Icon className="w-5 h-5" style={{ color: style.color }} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--dash-text-primary)]">{event.label}</p>
                      <p className="text-sm text-[var(--dash-text-secondary)] mt-1">{event.detail}</p>
                      <p className="text-xs text-[var(--dash-text-muted)] mt-2">{event.time_ago}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <div className="col-span-12 xl:col-span-5 space-y-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-[var(--dash-text-primary)]">What this page guarantees</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--dash-text-secondary)]">
                <p>- Every file is normalised to Markdown before chunking.</p>
                <p>- Chunking is structure-aware + semantic.</p>
                <p>- Embeddings + retrieval are measurable and auditable.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Recommended actions</p>
              <div className="mt-4 space-y-3">
                {(data?.failed_jobs ?? 0) > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={retrying}
                    className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                      {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Retry failed jobs
                    </p>
                    <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">
                      {data?.failed_jobs} failed job{data?.failed_jobs !== 1 ? 's' : ''} — reset stuck jobs and re-queue.
                    </p>
                    {retryResult && (
                      <p className="text-xs text-[var(--status-success)] mt-1">
                        Reset {retryResult.reset} job{retryResult.reset !== 1 ? 's' : ''}.
                      </p>
                    )}
                  </button>
                )}
                <button
                  onClick={() => router.push('/dashboard/sources/normalised')}
                  className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors"
                >
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Review normalised Markdown</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Inspect the normalised content used for retrieval.</p>
                </button>
                <button
                  onClick={() => router.push('/dashboard/ai-assistant/ask')}
                  className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors"
                >
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Run a test query</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Validate citations and retrieval relevance in the AI assistant.</p>
                </button>
                {(data?.documents_needing_reindex?.length ?? 0) > 0 && (
                  <button
                    onClick={() => router.push('/dashboard/sources')}
                    className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors"
                  >
                    <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Re-index outdated documents</p>
                    <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">
                      {data?.documents_needing_reindex.length} document{data?.documents_needing_reindex.length !== 1 ? 's' : ''} need re-indexing.
                    </p>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

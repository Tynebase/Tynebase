"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { 
  AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp, TrendingDown,
  Edit3, Calendar, Download, RefreshCw, ChevronRight, AlertCircle, Loader2,
  Play, CheckCheck, XCircle, Archive, ClipboardCheck, Shield, X,
  ChevronDown, ChevronUp, MoreHorizontal
} from "lucide-react";
import {
  getAuditStats,
  getStaleDocuments,
  getTopPerformers,
  getReviewQueue,
  createReview,
  updateReview,
  deleteReview,
  runFullAudit,
  markDocumentReviewed,
  type StaleDocument,
  type TopPerformer,
  type DocumentReview,
  type FullAuditResult,
  type AuditFinding,
} from "@/lib/api/audit";
import { updateDocument } from "@/lib/api/documents";
import { useToast } from "@/components/ui/Toast";

interface StatItem {
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
  icon: typeof CheckCircle2;
  color: string;
}

interface HealthItem {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export default function AuditPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  // Data states
  const [auditStats, setAuditStats] = useState<StatItem[]>([]);
  const [contentHealth, setContentHealth] = useState<HealthItem[]>([]);
  const [staleDocuments, setStaleDocuments] = useState<StaleDocument[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [reviewQueue, setReviewQueue] = useState<DocumentReview[]>([]);
  const [lastAuditTime, setLastAuditTime] = useState<string>("Never");

  // Full audit states
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<FullAuditResult | null>(null);
  const [showAuditResults, setShowAuditResults] = useState(false);
  const [findingFilter, setFindingFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const auditResultsRef = useRef<HTMLDivElement>(null);

  // View All toggles
  const [showAllStale, setShowAllStale] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'in_progress' | 'completed' | 'all'>('pending');

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const getDaysFromRange = (range: "7d" | "30d" | "90d"): number => {
    switch (range) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
      default: return 30;
    }
  };

  const fetchReviewQueue = useCallback(async () => {
    const reviewLimit = showAllReviews ? 50 : 10;
    try {
      const reviewsData = await getReviewQueue(reviewFilter, reviewLimit);
      setReviewQueue(reviewsData.reviews);
    } catch (error) {
      console.error("Failed to fetch review queue:", error);
    }
  }, [reviewFilter, showAllReviews]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const days = getDaysFromRange(timeRange);
      const staleLimit = showAllStale ? 50 : 10;
      const reviewLimit = showAllReviews ? 50 : 10;

      const [statsData, staleData, performersData, reviewsData] = await Promise.all([
        getAuditStats(days),
        getStaleDocuments(days, staleLimit),
        getTopPerformers(5),
        getReviewQueue(reviewFilter, reviewLimit),
      ]);

      const stats: StatItem[] = [
        { 
          label: "Content Health", 
          value: statsData.stats.content_health.value, 
          change: statsData.stats.content_health.change, 
          positive: statsData.stats.content_health.positive, 
          icon: CheckCircle2, 
          color: "#10b981" 
        },
        { 
          label: "Total Documents", 
          value: statsData.stats.total_documents.value, 
          change: statsData.stats.total_documents.change, 
          positive: statsData.stats.total_documents.positive, 
          icon: FileText, 
          color: "#3b82f6" 
        },
        { 
          label: "Needs Review", 
          value: statsData.stats.needs_review.value, 
          change: statsData.stats.needs_review.change, 
          positive: statsData.stats.needs_review.positive, 
          icon: AlertTriangle, 
          color: "#f59e0b" 
        },
        { 
          label: "Stale Content", 
          value: statsData.stats.stale_content.value, 
          change: statsData.stats.stale_content.change, 
          positive: statsData.stats.stale_content.positive, 
          icon: Clock, 
          color: "#ef4444" 
        },
      ];
      setAuditStats(stats);

      const health: HealthItem[] = [
        { label: "Excellent", count: statsData.health_distribution.excellent.count, percentage: statsData.health_distribution.excellent.percentage, color: "#10b981" },
        { label: "Good", count: statsData.health_distribution.good.count, percentage: statsData.health_distribution.good.percentage, color: "#3b82f6" },
        { label: "Needs Review", count: statsData.health_distribution.needs_review.count, percentage: statsData.health_distribution.needs_review.percentage, color: "#f59e0b" },
        { label: "Poor", count: statsData.health_distribution.poor.count, percentage: statsData.health_distribution.poor.percentage, color: "#ef4444" },
      ];
      setContentHealth(health);

      setStaleDocuments(staleData.documents);
      setTopPerformers(performersData.documents);
      setReviewQueue(reviewsData.reviews);
      setLastAuditTime("Just now");
    } catch (error) {
      console.error("Failed to fetch audit data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, showAllStale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleDocumentClick = (docId: string) => {
    router.push(`/dashboard/knowledge/${docId}`);
  };

  // ── Run Full Audit ──
  const handleRunFullAudit = async () => {
    setRunningAudit(true);
    try {
      const result = await runFullAudit();
      setAuditResult(result);
      setShowAuditResults(true);
      addToast({
        type: result.summary.issues_found > 0 ? 'warning' : 'success',
        title: result.summary.issues_found > 0
          ? `Audit complete — ${result.summary.issues_found} issue${result.summary.issues_found !== 1 ? 's' : ''} found, ${result.summary.reviews_created} review${result.summary.reviews_created !== 1 ? 's' : ''} created`
          : 'Audit complete — all documents are healthy!',
      });
      // Refresh dashboard data to reflect new reviews
      fetchData(true);
      // Scroll to results
      setTimeout(() => {
        auditResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('Full audit failed:', err);
      addToast({ type: 'error', title: 'Failed to run full audit' });
    } finally {
      setRunningAudit(false);
    }
  };

  // ── Individual stale document actions ──
  const handleMarkReviewed = async (docId: string, docTitle: string) => {
    setActionInProgress(`review-${docId}`);
    try {
      await markDocumentReviewed(docId);
      addToast({ type: 'success', title: `"${docTitle}" marked as reviewed` });
      fetchData(true);
    } catch (err) {
      console.error('Mark reviewed failed:', err);
      addToast({ type: 'error', title: 'Failed to mark document as reviewed' });
    } finally {
      setActionInProgress(null);
      setOpenMenuId(null);
    }
  };

  const handleArchiveDocument = async (docId: string, docTitle: string) => {
    setActionInProgress(`archive-${docId}`);
    try {
      await updateDocument(docId, { status: 'draft' });
      addToast({ type: 'success', title: `"${docTitle}" archived as draft` });
      fetchData(true);
    } catch (err) {
      console.error('Archive document failed:', err);
      addToast({ type: 'error', title: 'Failed to archive document' });
    } finally {
      setActionInProgress(null);
      setOpenMenuId(null);
    }
  };

  const handleScheduleReview = async (docId: string, docTitle: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    setActionInProgress(`schedule-${docId}`);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (priority === 'high' ? 7 : 14));
      await createReview({
        document_id: docId,
        reason: `Stale content — scheduled from audit dashboard`,
        priority,
        due_date: dueDate.toISOString().split('T')[0],
      });
      addToast({ type: 'success', title: `Review scheduled for "${docTitle}"` });
      fetchData(true);
    } catch (err) {
      console.error('Schedule review failed:', err);
      addToast({ type: 'error', title: 'Failed to schedule review' });
    } finally {
      setActionInProgress(null);
      setOpenMenuId(null);
    }
  };

  // ── Individual review queue actions ──
  const handleUpdateReviewStatus = async (reviewId: string, status: 'in_progress' | 'completed' | 'cancelled', title: string) => {
    setActionInProgress(`review-status-${reviewId}`);
    try {
      await updateReview(reviewId, { status });
      const label = status === 'completed' ? 'completed' : status === 'in_progress' ? 'started' : 'cancelled';
      addToast({ type: 'success', title: `Review for "${title}" ${label}` });
      fetchData(true);
    } catch (err) {
      console.error('Update review status failed:', err);
      addToast({ type: 'error', title: 'Failed to update review' });
    } finally {
      setActionInProgress(null);
      setOpenMenuId(null);
    }
  };

  const handleDeleteReview = async (reviewId: string, title: string) => {
    setActionInProgress(`delete-review-${reviewId}`);
    try {
      await deleteReview(reviewId);
      addToast({ type: 'success', title: `Review for "${title}" deleted` });
      fetchData(true);
    } catch (err) {
      console.error('Delete review failed:', err);
      addToast({ type: 'error', title: 'Failed to delete review' });
    } finally {
      setActionInProgress(null);
      setOpenMenuId(null);
    }
  };

  // ── Finding actions ──
  const handleFindingAction = async (finding: AuditFinding, action: 'review' | 'archive' | 'edit') => {
    if (action === 'edit') {
      handleDocumentClick(finding.document_id);
      return;
    }
    if (action === 'review') {
      await handleMarkReviewed(finding.document_id, finding.title);
    }
    if (action === 'archive') {
      await handleArchiveDocument(finding.document_id, finding.title);
    }
  };

  const handleExport = () => {
    const lines: string[] = [];
    
    lines.push(`Content Audit Report - ${timeRange} Range`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    lines.push('=== AUDIT STATISTICS ===');
    auditStats.forEach(stat => {
      lines.push(`${stat.label}: ${stat.value} (${stat.change})`);
    });
    lines.push('');
    
    lines.push('=== CONTENT HEALTH DISTRIBUTION ===');
    contentHealth.forEach(item => {
      lines.push(`${item.label}: ${item.count} documents (${item.percentage}%)`);
    });
    lines.push('');
    
    lines.push('=== STALE DOCUMENTS ===');
    lines.push('Title,Last Updated,Views,Status');
    staleDocuments.forEach(doc => {
      lines.push(`"${doc.title}",${doc.last_updated},${doc.views},${doc.status}`);
    });
    lines.push('');
    
    lines.push('=== TOP PERFORMERS ===');
    lines.push('Title,Views,Trend');
    topPerformers.forEach(doc => {
      lines.push(`"${doc.title}",${doc.views},${doc.trend}`);
    });
    lines.push('');
    
    lines.push('=== REVIEW QUEUE ===');
    lines.push('Title,Reason,Priority,Due Date,Status');
    reviewQueue.forEach(item => {
      lines.push(`"${item.title}","${item.reason}",${item.priority},${item.due_date},${item.status}`);
    });

    if (auditResult) {
      lines.push('');
      lines.push('=== FULL AUDIT FINDINGS ===');
      lines.push('Title,Severity,Issues,Review Created');
      auditResult.findings.forEach(f => {
        lines.push(`"${f.title}",${f.severity},"${f.issues.join('; ')}",${f.auto_review_created}`);
      });
    }
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredFindings = auditResult?.findings.filter(f => 
    findingFilter === 'all' || f.severity === findingFilter
  ) || [];

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (s === 'warning') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  const severityDot = (s: string) => {
    if (s === 'critical') return 'bg-red-500';
    if (s === 'warning') return 'bg-amber-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
          <p className="text-sm text-[var(--dash-text-tertiary)]">Loading audit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col space-y-10 pb-2">
      {/* Header */}
      <DashboardPageHeader
        title={<h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Content audit</h1>}
        description={
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Monitor content health, identify stale articles and manage reviews
          </p>
        }
        right={
          <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-end">
            <div className="flex items-center bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-1.5">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    timeRange === range
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                  }`}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)]"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col gap-10">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {auditStats.map((stat) => (
          <div key={stat.label} className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--dash-text-tertiary)]">{stat.label}</p>
                <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1">{stat.value}</p>
                <p className={`text-xs mt-1 flex items-center gap-1 ${stat.positive ? 'text-[var(--status-success)]' : 'text-[var(--dash-text-muted)]'}`}>
                  {stat.positive && <TrendingUp className="w-3 h-3" />}
                  {stat.change}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Health Distribution + Run Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)]">
            <h2 className="font-semibold text-[var(--dash-text-primary)]">Content Health Distribution</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)]">Analyse content health</p>
          </div>
          <div className="p-6 space-y-4">
            {contentHealth.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--dash-text-secondary)]">{item.label}</span>
                  <span className="text-[var(--dash-text-primary)] font-medium">{item.count} docs ({item.percentage}%)</span>
                </div>
                <div className="h-2 bg-[var(--surface-ground)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
            <div className="mt-6 pt-6 border-t border-[var(--dash-border-subtle)] flex items-center justify-between">
              <span className="text-sm text-[var(--dash-text-muted)]">Last audit: {lastAuditTime}</span>
              <button 
                onClick={handleRunFullAudit}
                disabled={runningAudit}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {runningAudit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {runningAudit ? 'Running Audit...' : 'Run Full Audit'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)]">
            <h2 className="font-semibold text-[var(--dash-text-primary)]">Top Performing</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)]">Most viewed this month</p>
          </div>
          <div className="p-6 space-y-4">
            {topPerformers.length === 0 ? (
              <p className="text-sm text-[var(--dash-text-muted)] text-center py-4">No documents found. Create your first document to see performance data here.</p>
            ) : (
              topPerformers.map((doc, index) => (
                <div 
                  key={doc.id} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-hover)] -mx-2 px-2 py-1 rounded-lg transition-colors"
                  onClick={() => handleDocumentClick(doc.id)}
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-xs font-medium text-[var(--dash-text-tertiary)]">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">{doc.views.toLocaleString()} views</p>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-1 ${doc.positive ? 'text-[var(--status-success)]' : 'text-[var(--status-error)]'}`}>
                    {doc.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {doc.trend}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ AUDIT RESULTS PANEL ═══ */}
      {showAuditResults && auditResult && (
        <div ref={auditResultsRef} className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
          {/* Results Header */}
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[var(--brand)]" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--dash-text-primary)]">Audit Results</h2>
                <p className="text-sm text-[var(--dash-text-tertiary)]">
                  Ran at {new Date(auditResult.ran_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAuditResults(false)}
              className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[var(--dash-border-subtle)]">
            <div className="bg-[var(--surface-ground)] rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{auditResult.summary.total_documents}</p>
              <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Total Scanned</p>
            </div>
            <div className="bg-green-500/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{auditResult.summary.healthy}</p>
              <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Healthy</p>
            </div>
            <div className="bg-amber-500/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{auditResult.summary.issues_found}</p>
              <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Issues Found</p>
            </div>
            <div className="bg-blue-500/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{auditResult.summary.reviews_created}</p>
              <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Reviews Created</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)] flex flex-wrap gap-3">
            {auditResult.summary.breakdown.stale > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                <Clock className="w-3 h-3" /> {auditResult.summary.breakdown.stale} stale
              </span>
            )}
            {auditResult.summary.breakdown.empty_content > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                <FileText className="w-3 h-3" /> {auditResult.summary.breakdown.empty_content} empty
              </span>
            )}
            {auditResult.summary.breakdown.uncategorised > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                <AlertCircle className="w-3 h-3" /> {auditResult.summary.breakdown.uncategorised} uncategorised
              </span>
            )}
            {auditResult.summary.breakdown.stuck_in_draft > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                <Edit3 className="w-3 h-3" /> {auditResult.summary.breakdown.stuck_in_draft} drafts
              </span>
            )}
            {auditResult.summary.breakdown.zero_views > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                <TrendingDown className="w-3 h-3" /> {auditResult.summary.breakdown.zero_views} zero views
              </span>
            )}
            {auditResult.summary.issues_found === 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                <CheckCircle2 className="w-3 h-3" /> All documents are healthy
              </span>
            )}
          </div>

          {/* Findings list */}
          {auditResult.findings.length > 0 && (
            <>
              {/* Filter tabs */}
              <div className="px-6 py-3 border-b border-[var(--dash-border-subtle)] flex items-center gap-2">
                <span className="text-xs text-[var(--dash-text-tertiary)] mr-2">Filter:</span>
                {(['all', 'critical', 'warning', 'info'] as const).map(f => {
                  const count = f === 'all' 
                    ? auditResult.findings.length 
                    : auditResult.findings.filter(fin => fin.severity === f).length;
                  if (count === 0 && f !== 'all') return null;
                  return (
                    <button
                      key={f}
                      onClick={() => setFindingFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        findingFilter === f
                          ? 'bg-[var(--brand)] text-white'
                          : 'bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]'
                      }`}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="divide-y divide-[var(--dash-border-subtle)] max-h-[400px] overflow-y-auto">
                {filteredFindings.map((finding) => (
                  <div key={finding.document_id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-[var(--surface-hover)] transition-colors">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${severityDot(finding.severity)}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{finding.title}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {finding.issues.map((issue, i) => (
                            <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${severityColor(finding.severity)}`}>
                              {issue ? issue.charAt(0).toUpperCase() + issue.slice(1) : issue}
                            </span>
                          ))}
                        </div>
                        {finding.auto_review_created && (
                          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Review auto-created
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleFindingAction(finding, 'edit')}
                        className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                        title="Edit document"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFindingAction(finding, 'review')}
                        disabled={actionInProgress === `review-${finding.document_id}`}
                        className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-green-600 disabled:opacity-50"
                        title="Mark as reviewed"
                      >
                        {actionInProgress === `review-${finding.document_id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleFindingAction(finding, 'archive')}
                        disabled={actionInProgress === `archive-${finding.document_id}`}
                        className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-amber-600 disabled:opacity-50"
                        title="Archive as draft"
                      >
                        {actionInProgress === `archive-${finding.document_id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stale Content & Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Stale Content ── */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[var(--status-warning)]" />
                Stale Content
              </h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Documents needing updates</p>
            </div>
            <button 
              onClick={() => setShowAllStale(!showAllStale)}
              className="text-sm text-[var(--brand)] hover:underline px-2 py-1 rounded-md hover:bg-[var(--surface-hover)] flex items-center gap-1"
            >
              {showAllStale ? 'Show Less' : 'View All'}
              {showAllStale ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className={`divide-y divide-[var(--dash-border-subtle)] ${showAllStale ? 'max-h-[500px] overflow-y-auto' : ''}`}>
            {staleDocuments.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-[var(--status-success)] mx-auto mb-2" />
                <p className="text-sm text-[var(--dash-text-muted)]">All content is up to date!</p>
              </div>
            ) : (
              staleDocuments.map((doc) => (
                <div 
                  key={doc.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleDocumentClick(doc.id)}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${doc.status === 'critical' ? 'bg-[var(--status-error)]' : doc.status === 'warning' ? 'bg-[var(--status-warning)]' : 'bg-[var(--status-info)]'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">Updated {doc.last_updated} &middot; {doc.views} views</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkReviewed(doc.id, doc.title);
                      }}
                      disabled={actionInProgress?.startsWith(`review-${doc.id}`) || actionInProgress?.startsWith(`archive-${doc.id}`) || actionInProgress?.startsWith(`schedule-${doc.id}`)}
                      className="p-1.5 rounded-lg hover:bg-green-500/10 text-[var(--dash-text-tertiary)] hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title="Mark as reviewed"
                    >
                      {actionInProgress === `review-${doc.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDocumentClick(doc.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit document"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === `stale-${doc.id}` ? null : `stale-${doc.id}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenuId === `stale-${doc.id}` && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg z-20 py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleScheduleReview(doc.id, doc.title, doc.status === 'critical' ? 'high' : 'medium'); }}
                            disabled={!!actionInProgress}
                            className="w-full px-3 py-2 text-left text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-2 disabled:opacity-50"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            Schedule Review
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchiveDocument(doc.id, doc.title); }}
                            disabled={!!actionInProgress}
                            className="w-full px-3 py-2 text-left text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-2 disabled:opacity-50"
                          >
                            <Archive className="w-4 h-4" />
                            Archive as Draft
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Review Queue ── */}
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[var(--status-info)]" />
                  Review Queue
                </h2>
                <p className="text-sm text-[var(--dash-text-tertiary)]">Scheduled reviews</p>
              </div>
              <button 
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="text-sm text-[var(--brand)] hover:underline px-2 py-1 rounded-md hover:bg-[var(--surface-hover)] flex items-center gap-1"
              >
                {showAllReviews ? 'Show Less' : 'View All'}
                {showAllReviews ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            {/* Review status filter */}
            <div className="flex items-center gap-2 mt-3">
              {(['pending', 'in_progress', 'completed', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setReviewFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    reviewFilter === s
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-secondary)]'
                  }`}
                >
                  {s === 'in_progress' ? 'In Progress' : s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={`divide-y divide-[var(--dash-border-subtle)] ${showAllReviews ? 'max-h-[500px] overflow-y-auto' : ''}`}>
            {reviewQueue.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Calendar className="w-8 h-8 text-[var(--dash-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--dash-text-muted)]">
                  {reviewFilter === 'pending' ? 'No pending reviews' : `No ${reviewFilter === 'all' ? '' : reviewFilter.replace('_', ' ')} reviews`}
                </p>
              </div>
            ) : (
              reviewQueue.map((item) => (
                <div 
                  key={item.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleDocumentClick(item.document_id)}
                  >
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${item.priority === 'high' ? 'bg-red-500/10 text-red-500' : item.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : item.priority}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{item.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)] truncate">{item.reason} &middot; {item.due_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateReviewStatus(item.id, 'in_progress', item.title); }}
                        disabled={!!actionInProgress}
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 text-[var(--dash-text-tertiary)] hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="Start review"
                      >
                        {actionInProgress === `review-status-${item.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                    )}
                    {(item.status === 'pending' || item.status === 'in_progress') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateReviewStatus(item.id, 'completed', item.title); }}
                        disabled={!!actionInProgress}
                        className="p-1.5 rounded-lg hover:bg-green-500/10 text-[var(--dash-text-tertiary)] hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="Complete review"
                      >
                        {actionInProgress === `review-status-${item.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                      </button>
                    )}
                    {(item.status === 'pending' || item.status === 'in_progress') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateReviewStatus(item.id, 'cancelled', item.title); }}
                        disabled={!!actionInProgress}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--dash-text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="Cancel review"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {item.status === 'completed' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600">Done</span>
                    )}
                    {item.status === 'cancelled' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">Cancelled</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDocumentClick(item.document_id); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] opacity-0 group-hover:opacity-100 transition-all"
                      title="Open document"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 mt-auto">
        <h2 className="font-semibold text-[var(--dash-text-primary)] mb-4">Bulk Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={bulkAction !== null || staleDocuments.length === 0}
            onClick={async () => {
              setBulkAction('archive');
              try {
                let archived = 0;
                for (const doc of staleDocuments) {
                  await updateDocument(doc.id, { status: 'draft' });
                  archived++;
                }
                addToast({ type: 'success', title: `Archived ${archived} stale document${archived !== 1 ? 's' : ''} as drafts` });
                fetchData(true);
              } catch (err) {
                console.error('Archive stale content failed:', err);
                addToast({ type: 'error', title: 'Failed to archive some documents' });
              } finally {
                setBulkAction(null);
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkAction === 'archive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            {bulkAction === 'archive' ? 'Archiving...' : `Archive Stale Content${staleDocuments.length > 0 ? ` (${staleDocuments.length})` : ''}`}
          </button>
          <button
            disabled={bulkAction !== null || staleDocuments.length === 0}
            onClick={async () => {
              setBulkAction('review');
              try {
                let scheduled = 0;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7);
                const dueDateStr = dueDate.toISOString().split('T')[0];
                for (const doc of staleDocuments) {
                  await createReview({
                    document_id: doc.id,
                    reason: 'Stale content — scheduled via bulk review',
                    priority: doc.status === 'critical' ? 'high' : 'medium',
                    due_date: dueDateStr,
                  });
                  scheduled++;
                }
                addToast({ type: 'success', title: `Scheduled reviews for ${scheduled} document${scheduled !== 1 ? 's' : ''}` });
                fetchData(true);
              } catch (err) {
                console.error('Schedule batch review failed:', err);
                addToast({ type: 'error', title: 'Failed to schedule some reviews' });
              } finally {
                setBulkAction(null);
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkAction === 'review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {bulkAction === 'review' ? 'Scheduling...' : `Schedule Batch Review${staleDocuments.length > 0 ? ` (${staleDocuments.length})` : ''}`}
          </button>
          <button
            disabled={bulkAction !== null}
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Generate Health Report
          </button>
        </div>
      </div>

      </div>
    </div>
  );
}

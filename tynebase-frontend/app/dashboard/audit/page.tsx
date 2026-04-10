"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { 
  AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp, TrendingDown,
  Edit3, Calendar, Download, RefreshCw, ChevronRight, AlertCircle, Loader2,
  Play, CheckCheck, XCircle, Archive, ClipboardCheck, Shield, X,
  ChevronDown, ChevronUp, MoreHorizontal, Settings
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
  const [activeTab, setActiveTab] = useState<"review-queue" | "library" | "settings">("review-queue");

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
  }, [timeRange, showAllStale, showAllReviews, reviewFilter]);

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
    router.push(`/dashboard/knowledge/${docId}?from=audit`);
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
    // Optimistically remove this finding from the audit results panel after action
    setAuditResult(prev => {
      if (!prev) return null;
      const updatedFindings = prev.findings.filter(f => f.document_id !== finding.document_id);
      return {
        ...prev,
        findings: updatedFindings,
        summary: {
          ...prev.summary,
          issues_found: updatedFindings.length,
          healthy: prev.summary.healthy + 1,
        },
      };
    });
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
    <>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--dash-border-subtle)]">
        <button
          onClick={() => setActiveTab("review-queue")}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "review-queue"
              ? "text-[var(--brand)]"
              : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
          }`}
        >
          Review Queue
          {activeTab === "review-queue" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "library"
              ? "text-[var(--brand)]"
              : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
          }`}
        >
          Audit Library
          {activeTab === "library" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "settings"
              ? "text-[var(--brand)]"
              : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
          }`}
        >
          Settings
          {activeTab === "settings" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]" />
          )}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-10">
        {activeTab === "review-queue" && (
          <>
            {/* Stats - Focus on Review Queue */}
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

            {/* Review Queue Table - Redesigned */}
            <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-[var(--brand)]" />
                    Pending Reviews
                  </h2>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Documents queued for manual review</p>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={reviewFilter}
                    onChange={(e) => setReviewFilter(e.target.value as any)}
                    className="bg-transparent text-sm font-medium text-[var(--dash-text-secondary)] outline-none cursor-pointer border-none focus:ring-0"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--dash-border-subtle)]">
                      <th className="px-6 py-4 text-xs font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider">Document</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider">Due Date</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dash-border-subtle)]">
                    {reviewQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-[var(--dash-text-muted)]">
                          No items in the review queue.
                        </td>
                      </tr>
                    ) : (
                      reviewQueue.map((review) => (
                        <tr key={review.id} className="hover:bg-[var(--surface-hover)] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleDocumentClick(review.document_id)}>
                              <div className="w-9 h-9 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
                                <FileText className="w-4.5 h-4.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate max-w-[200px]">{review.title}</p>
                                <p className="text-xs text-[var(--dash-text-muted)]">ID: {review.document_id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-[var(--dash-text-secondary)] line-clamp-1" title={review.reason}>{review.reason}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              review.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                              review.priority === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                              'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            }`}>
                              {review.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-[var(--dash-text-secondary)]">{review.due_date}</span>
                              <span className={`text-[10px] ${
                                new Date(review.due_date_raw) < new Date() ? 'text-red-500 font-medium' : 'text-[var(--dash-text-muted)]'
                              }`}>
                                {new Date(review.due_date_raw) < new Date() ? 'Overdue' : 'Upcoming'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {review.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateReviewStatus(review.id, 'in_progress', review.title)}
                                  className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                                  title="Start Review"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/dashboard/knowledge/${review.document_id}?from=audit`)}
                                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                                title="Edit Document"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateReviewStatus(review.id, 'completed', review.title)}
                                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-success)]"
                                title="Mark Completed"
                              >
                                <CheckCheck className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "library" && (
          <div className="space-y-10">
            {/* Health Distribution & Top Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
                <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)]">
                  <h2 className="font-semibold text-[var(--dash-text-primary)]">Content Health Distribution</h2>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Analysis of all documents</p>
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
                    <span className="text-sm text-[var(--dash-text-muted)]">Last exhaustive audit: {lastAuditTime}</span>
                    <button 
                      onClick={handleRunFullAudit}
                      disabled={runningAudit}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {runningAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {runningAudit ? 'Running Audit...' : 'Run Full Audit Scan'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
                <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)]">
                  <h2 className="font-semibold text-[var(--dash-text-primary)]">Insights</h2>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Top performers this period</p>
                </div>
                <div className="p-6 space-y-4">
                  {topPerformers.map((doc, index) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-hover)] -mx-2 px-2 py-1 rounded-lg transition-colors"
                      onClick={() => handleDocumentClick(doc.id)}
                    >
                      <span className="w-6 h-6 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-xs font-medium text-[var(--dash-text-tertiary)]">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                        <p className="text-xs text-[var(--dash-text-muted)]">{doc.views.toLocaleString()} views</p>
                      </div>
                      <span className={`text-xs font-medium flex items-center gap-1 ${doc.positive ? 'text-[var(--status-success)]' : 'text-[var(--status-error)]'}`}>
                        {doc.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {doc.trend}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Audit Scan Results (if ran) */}
            {showAuditResults && auditResult && (
              <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[var(--brand)]" />
                    <div>
                      <h2 className="font-semibold text-[var(--dash-text-primary)]">Last Scan Findings</h2>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">{auditResult.findings.length} issues identified</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFindingFilter('all')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${findingFilter === 'all' ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--dash-text-secondary)]'}`}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setFindingFilter('critical')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${findingFilter === 'critical' ? 'bg-red-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--dash-text-secondary)]'}`}
                    >
                      Critical
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-[var(--dash-border-subtle)] max-h-[400px] overflow-y-auto">
                  {filteredFindings.map(finding => (
                    <div key={finding.document_id} className="px-6 py-4 flex items-center justify-between group">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-2 ${severityDot(finding.severity)}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{finding.title}</p>
                          <div className="flex gap-1.5 mt-1">
                            {finding.issues.map((issue, i) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor(finding.severity)}`}>{issue}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDocumentClick(finding.document_id)} className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stale Content */}
            <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
              <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Stale Content Library
                  </h2>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Documents that haven't been updated in 90+ days</p>
                </div>
              </div>
              <div className="divide-y divide-[var(--dash-border-subtle)]">
                {staleDocuments.map(doc => (
                  <div key={doc.id} className="px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between group">
                    <div className="flex-1 min-w-0" onClick={() => handleDocumentClick(doc.id)}>
                      <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">Last updated {doc.last_updated} &middot; {doc.views} views</p>
                    </div>
                    <button 
                      onClick={() => handleScheduleReview(doc.id, doc.title)}
                      className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--brand)] hover:text-white rounded-lg text-xs font-medium transition-all"
                    >
                      Schedule Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 text-center">
            <Settings className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--dash-text-primary)]">Audit Configurations</h3>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-2">
              Automate your content audit process. Settings such as scan frequency and review notification preferences will be available here soon.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button disabled className="px-5 py-2.5 bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] rounded-lg text-sm font-medium cursor-not-allowed">
                Configure Schedule
              </button>
              <button disabled className="px-5 py-2.5 bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] rounded-lg text-sm font-medium cursor-not-allowed">
                Notification Rules
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

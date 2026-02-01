"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { 
  AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp, TrendingDown,
  Eye, Edit3, Calendar, Download, RefreshCw, ChevronRight, AlertCircle, Loader2
} from "lucide-react";
import {
  getAuditStats,
  getStaleDocuments,
  getTopPerformers,
  getReviewQueue,
  type AuditStats,
  type StaleDocument,
  type TopPerformer,
  type DocumentReview,
} from "@/lib/api/audit";

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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [auditStats, setAuditStats] = useState<StatItem[]>([]);
  const [contentHealth, setContentHealth] = useState<HealthItem[]>([]);
  const [staleDocuments, setStaleDocuments] = useState<StaleDocument[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [reviewQueue, setReviewQueue] = useState<DocumentReview[]>([]);
  const [lastAuditTime, setLastAuditTime] = useState<string>("Never");

  const getDaysFromRange = (range: "7d" | "30d" | "90d"): number => {
    switch (range) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
      default: return 30;
    }
  };

  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const days = getDaysFromRange(timeRange);
      
      const [statsData, staleData, performersData, reviewsData] = await Promise.all([
        getAuditStats(days),
        getStaleDocuments(days, 10),
        getTopPerformers(5),
        getReviewQueue('pending', 10),
      ]);

      // Transform stats data into display format
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

      // Transform health distribution
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
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleDocumentClick = (docId: string) => {
    router.push(`/dashboard/sources/${docId}`);
  };

  const handleExport = () => {
    const lines: string[] = [];
    
    // Header
    lines.push(`Content Audit Report - ${timeRange} Range`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    // Stats
    lines.push('=== AUDIT STATISTICS ===');
    auditStats.forEach(stat => {
      lines.push(`${stat.label}: ${stat.value} (${stat.change})`);
    });
    lines.push('');
    
    // Health Distribution
    lines.push('=== CONTENT HEALTH DISTRIBUTION ===');
    contentHealth.forEach(item => {
      lines.push(`${item.label}: ${item.count} documents (${item.percentage}%)`);
    });
    lines.push('');
    
    // Stale Documents
    lines.push('=== STALE DOCUMENTS ===');
    lines.push('Title,Last Updated,Views,Status');
    staleDocuments.forEach(doc => {
      lines.push(`"${doc.title}",${doc.last_updated},${doc.views},${doc.status}`);
    });
    lines.push('');
    
    // Top Performers
    lines.push('=== TOP PERFORMERS ===');
    lines.push('Title,Views,Trend');
    topPerformers.forEach(doc => {
      lines.push(`"${doc.title}",${doc.views},${doc.trend}`);
    });
    lines.push('');
    
    // Review Queue
    lines.push('=== REVIEW QUEUE ===');
    lines.push('Title,Reason,Priority,Due Date,Status');
    reviewQueue.forEach(item => {
      lines.push(`"${item.title}","${item.reason}",${item.priority},${item.due_date},${item.status}`);
    });
    
    // Create and download file
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

      {/* Content Health Distribution */}
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
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Run Full Audit'}
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
              <p className="text-sm text-[var(--dash-text-muted)] text-center py-4">No documents with views yet</p>
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

      {/* Stale Content & Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[var(--status-warning)]" />
                Stale Content
              </h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Documents needing updates</p>
            </div>
            <button className="text-sm text-[var(--brand)] hover:underline px-2 py-1 rounded-md hover:bg-[var(--surface-hover)]">View All</button>
          </div>
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {staleDocuments.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-[var(--status-success)] mx-auto mb-2" />
                <p className="text-sm text-[var(--dash-text-muted)]">All content is up to date!</p>
              </div>
            ) : (
              staleDocuments.map((doc) => (
                <div 
                  key={doc.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group cursor-pointer"
                  onClick={() => handleDocumentClick(doc.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${doc.status === 'critical' ? 'bg-[var(--status-error)]' : doc.status === 'warning' ? 'bg-[var(--status-warning)]' : 'bg-[var(--status-info)]'}`} />
                    <div>
                      <p className="text-sm font-medium text-[var(--dash-text-primary)]">{doc.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">Updated {doc.last_updated}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--dash-text-muted)]">{doc.views} views</span>
                    <button 
                      className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDocumentClick(doc.id);
                      }}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
          <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--status-info)]" />
                Review Queue
              </h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Scheduled reviews</p>
            </div>
            <button className="text-sm text-[var(--brand)] hover:underline px-2 py-1 rounded-md hover:bg-[var(--surface-hover)]">View All</button>
          </div>
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {reviewQueue.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Calendar className="w-8 h-8 text-[var(--dash-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--dash-text-muted)]">No scheduled reviews</p>
              </div>
            ) : (
              reviewQueue.map((item) => (
                <div 
                  key={item.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group cursor-pointer"
                  onClick={() => handleDocumentClick(item.document_id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.priority === 'high' ? 'bg-[var(--status-error-bg)] text-[var(--status-error)]' : item.priority === 'medium' ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]' : 'bg-[var(--status-info-bg)] text-[var(--status-info)]'}`}>
                      {item.priority}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--dash-text-primary)]">{item.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">{item.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--dash-text-muted)]">{item.due_date}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100" />
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
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors">
            <AlertCircle className="w-4 h-4" />
            Archive Stale Content
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors">
            <Calendar className="w-4 h-4" />
            Schedule Batch Review
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors">
            <Eye className="w-4 h-4" />
            Generate Health Report
          </button>
        </div>
      </div>

      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { 
  AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp, TrendingDown,
  Eye, Edit3, Calendar, Download, RefreshCw, ChevronRight, AlertCircle
} from "lucide-react";

const auditStats = [
  { label: "Content Health", value: "78%", change: "+5%", positive: true, icon: CheckCircle2, color: "#10b981" },
  { label: "Total Documents", value: "156", change: "34 this month", positive: true, icon: FileText, color: "#3b82f6" },
  { label: "Needs Review", value: "12", change: "3 due this week", positive: false, icon: AlertTriangle, color: "#f59e0b" },
  { label: "Stale Content", value: "8", change: "90+ days old", positive: false, icon: Clock, color: "#ef4444" },
];

const contentHealth = [
  { label: "Excellent", count: 89, percentage: 57, color: "#10b981" },
  { label: "Good", count: 43, percentage: 28, color: "#3b82f6" },
  { label: "Needs Review", count: 16, percentage: 10, color: "#f59e0b" },
  { label: "Poor", count: 8, percentage: 5, color: "#ef4444" },
];

const staleDocuments = [
  { id: 1, title: "Legacy API Documentation", lastUpdated: "8 months ago", views: 234, status: "critical" },
  { id: 2, title: "Old Pricing Guide", lastUpdated: "6 months ago", views: 89, status: "warning" },
  { id: 3, title: "Deprecated Features", lastUpdated: "5 months ago", views: 156, status: "warning" },
  { id: 4, title: "2024 Release Notes", lastUpdated: "4 months ago", views: 445, status: "info" },
];

const reviewQueue = [
  { id: 1, title: "Security Best Practices", reason: "Scheduled review", dueDate: "Today", priority: "high" },
  { id: 2, title: "Getting Started Guide", reason: "User feedback", dueDate: "Tomorrow", priority: "medium" },
  { id: 3, title: "API Rate Limits", reason: "Policy change", dueDate: "In 3 days", priority: "high" },
  { id: 4, title: "Team Permissions", reason: "Quarterly review", dueDate: "In 5 days", priority: "low" },
];

const topPerformers = [
  { id: 1, title: "Getting Started Guide", views: 12453, trend: "+23%", positive: true },
  { id: 2, title: "API Authentication", views: 8921, trend: "+15%", positive: true },
  { id: 3, title: "Webhook Setup", views: 6234, trend: "+8%", positive: true },
  { id: 4, title: "Billing FAQ", views: 5102, trend: "-3%", positive: false },
];

export default function AuditPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

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
            <button className="flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)]">
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
              <span className="text-sm text-[var(--dash-text-muted)]">Last audit: 2 hours ago</span>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-ground)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]">
                <RefreshCw className="w-4 h-4" />
                Run Full Audit
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
            {topPerformers.map((doc, index) => (
              <div key={doc.id} className="flex items-center gap-3">
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
            ))}
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
            {staleDocuments.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${doc.status === 'critical' ? 'bg-[var(--status-error)]' : doc.status === 'warning' ? 'bg-[var(--status-warning)]' : 'bg-[var(--status-info)]'}`} />
                  <div>
                    <p className="text-sm font-medium text-[var(--dash-text-primary)]">{doc.title}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">Updated {doc.lastUpdated}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--dash-text-muted)]">{doc.views} views</span>
                  <button className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] opacity-0 group-hover:opacity-100">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
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
            {reviewQueue.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group">
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
                  <span className="text-xs text-[var(--dash-text-muted)]">{item.dueDate}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))}
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

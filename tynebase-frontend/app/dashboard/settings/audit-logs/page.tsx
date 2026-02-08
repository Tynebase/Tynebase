"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, exportAuditLogs, type AuditLog as AuditLogType } from "@/lib/api/audit";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Activity,
  Download,
  Search,
  FileText,
  User,
  Settings,
  Trash2,
  Edit3,
  Plus,
  Eye,
  LogIn,
  LogOut,
  Key,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

const activityTypes = [
  { id: "all", label: "All Activity", icon: Activity },
  { id: "document", label: "Documents", icon: FileText },
  { id: "user", label: "Users", icon: User },
  { id: "auth", label: "Authentication", icon: Key },
  { id: "settings", label: "Settings", icon: Settings },
];

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const getActionIcon = (action: string) => {
  if (action.includes("created") || action.includes("invited")) return Plus;
  if (action.includes("deleted")) return Trash2;
  if (action.includes("updated") || action.includes("published") || action.includes("role_changed")) return Edit3;
  if (action.includes("login")) return LogIn;
  if (action.includes("logout")) return LogOut;
  if (action.includes("viewed")) return Eye;
  return Activity;
};

const getActionColor = (action: string) => {
  if (action.includes("created") || action.includes("invited") || action.includes("login")) return "brand";
  if (action.includes("deleted") || action.includes("logout")) return "red";
  if (action.includes("updated") || action.includes("published")) return "brand";
  return "brand";
};

const formatAction = (action: string) => {
  return action
    .split(".")
    .pop()
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase()) || action;
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function AuditLogsPage() {
  const [activeType, setActiveType] = useState<'all' | 'document' | 'user' | 'auth' | 'settings'>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogType[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, [activeType, pagination.page]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAuditLogs({
        page: pagination.page,
        limit: pagination.limit,
        action_type: activeType,
        search: searchQuery.trim() || undefined,
      });

      setAuditLogs(response.logs);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAuditLogs();
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleTypeChange = (type: 'all' | 'document' | 'user' | 'auth' | 'settings') => {
    setActiveType(type);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setActiveType("all");
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery.trim() !== "" || activeType !== "all";

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAuditLogs({
        action_type: activeType,
        search: searchQuery.trim() || undefined,
      });
    } catch (err: any) {
      console.error('Error exporting audit logs:', err);
      setError(err.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Audit Logs</h1>
          <p className="text-[var(--text-tertiary)] mt-1">Track all activity in your workspace</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleExport}
            disabled={exporting || loading}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Logs'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative w-full lg:flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search by user, action or target..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-10 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); handleSearch(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activityTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id as 'all' | 'document' | 'user' | 'auth' | 'settings')}
                  disabled={loading}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeType === type.id
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-card)]"
                    }`}
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          {/* Active Filters & Clear */}
          {hasActiveFilters && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Active filters:</span>
              <div className="flex flex-wrap items-center gap-2">
                {searchQuery.trim() !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <Search className="w-3 h-3" />
                    Search: &quot;{searchQuery.trim()}&quot;
                  </span>
                )}
                {activeType !== "all" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    {(() => {
                      const type = activityTypes.find(t => t.id === activeType);
                      if (type) {
                        const Icon = type.icon;
                        return <Icon className="w-3 h-3" />;
                      }
                      return null;
                    })()}
                    {activityTypes.find(t => t.id === activeType)?.label}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-xs text-[var(--text-tertiary)] hover:text-red-500"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear all
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)] mx-auto mb-4"></div>
                <p className="text-[var(--text-secondary)]">Loading audit logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <p className="text-red-500 mb-2">{error}</p>
                <Button onClick={fetchAuditLogs} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <Activity className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-[var(--text-secondary)]">No audit logs found</p>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">Activity will appear here as users interact with the system</p>
              </div>
            </div>
          ) : (
          <div className="divide-y divide-[var(--border-subtle)] overflow-auto">
            {auditLogs.map((log) => {
              const ActionIcon = getActionIcon(log.action);
              const actionColor = getActionColor(log.action);

              return (
                <div key={log.id} className="p-5 hover:bg-[var(--surface-ground)] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start gap-4">
                      {/* Action Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${actionColor === "red" ? "bg-red-500/10 text-red-500" :
                          "bg-[var(--brand)]/10 text-[var(--brand)]"
                        }`}>
                        <ActionIcon className="w-5 h-5" />
                      </div>

                      {/* Mobile Metadata (Top Right) -> Hidden on Desktop */}
                      <div className="text-right flex-shrink-0 sm:hidden ml-auto">
                        <p className="text-xs text-[var(--text-secondary)]">
                          {formatTimestamp(log.timestamp)}
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pl-14 sm:pl-0 -mt-8 sm:mt-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--text-primary)]">
                          {log.actor.name}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {formatAction(log.action).toLowerCase()}
                        </span>
                        {log.target && (
                          <span className="font-medium text-[var(--text-primary)]">
                            {log.target}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      {Object.keys(log.details).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--text-tertiary)]">
                          {Object.entries(log.details).map(([key, value]) => (
                            <span key={key} className="flex items-center gap-1">
                              <span className="capitalize">{key}:</span>
                              <span className="font-medium">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Mobile IP */}
                      <p className="text-xs text-[var(--text-tertiary)] sm:hidden mt-2">
                        IP: {log.ip}
                      </p>
                    </div>

                    {/* Desktop Metadata */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {formatTimestamp(log.timestamp)}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        IP: {log.ip}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && !error && pagination.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-tertiary)]">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="px-3" 
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
              let pageNum;
              if (pagination.total_pages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.total_pages - 2) {
                pageNum = pagination.total_pages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant="outline"
                  size="sm"
                  className={`px-3 ${pagination.page === pageNum ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : ''}`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              className="px-3"
              disabled={pagination.page === pagination.total_pages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Retention Notice */}
      <Card className="bg-[var(--surface-ground)] border-[var(--border-subtle)]">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-[var(--text-tertiary)]" />
            <div className="flex-1 sm:hidden">
              <p className="text-sm text-[var(--text-secondary)]">
                Audit logs are retained for <span className="font-medium">90 days</span> on your current plan.
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1">
            <p className="text-sm text-[var(--text-secondary)]">
              Audit logs are retained for <span className="font-medium">90 days</span> on your current plan.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-sm text-[var(--brand-primary)] w-full sm:w-auto justify-start sm:justify-center pl-10 sm:pl-4" onClick={() => window.location.href = '/dashboard/settings/billing'}>
            Upgrade for longer retention →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

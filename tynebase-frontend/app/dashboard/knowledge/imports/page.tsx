"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { deleteJob } from "@/lib/api/ai";
import {
  Download,
  Upload,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  ExternalLink,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

type ImportStatus = "queued" | "running" | "completed" | "failed";

type ImportJob = {
  id: string;
  source: string;
  status: ImportStatus;
  items: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

type ImportSource = {
  name: string;
  description: string;
  cta: string;
  href?: string;
  comingSoon?: boolean;
};

const sources: ImportSource[] = [
  {
    name: "Markdown",
    description: "Batch import .md files with automatic RAG indexing and embedding generation.",
    cta: "Import Files",
    href: "/dashboard/knowledge/imports/markdown",
    comingSoon: false,
  },
  {
    name: "Notion",
    description: "Connect a workspace and import pages, databases, and attachments.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "Confluence",
    description: "Bring in spaces and pages and keep content in sync.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "Google Docs",
    description: "Import documents and folder structures from Drive.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "Slack",
    description: "Import messages and threads from Slack channels.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "Dropbox",
    description: "Sync documents and files from your Dropbox folders.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "SharePoint",
    description: "Import documents and wikis from Microsoft SharePoint.",
    cta: "Coming Soon",
    comingSoon: true,
  },
  {
    name: "Zendesk",
    description: "Bring in help center articles and knowledge base content.",
    cta: "Coming Soon",
    comingSoon: true,
  },
];

function StatusBadge({ status }: { status: ImportStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success)]">
        <CheckCircle className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--status-error-bg)] text-[var(--status-error)]">
        <AlertTriangle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--status-warning-bg)] text-[var(--status-warning)]">
        <Clock className="w-3.5 h-3.5" />
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
      Queued
    </span>
  );
}

export default function ImportsPage() {
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ImportStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<ImportJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Import jobs endpoint not yet implemented - show empty state
    // Will be enabled when integrations are available in Milestone 3
    setLoading(false);
    setJobs([]);
  }, []);

  const filtered = useMemo(() => {
    let result = jobs;
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((j) => `${j.source} ${j.status} ${j.notes ?? ""}`.toLowerCase().includes(q));
    }
    return result;
  }, [query, jobs, statusFilter]);

  const handleDeleteClick = (job: ImportJob) => {
    setJobToDelete(job);
    setDeleteModalOpen(true);
  };

  const handleDeleteCancel = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setJobToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    
    try {
      setDeleting(true);
      // Call API to delete import job
      await deleteJob(jobToDelete.id);
      
      // Update local state
      setJobs(prev => prev.filter(j => j.id !== jobToDelete.id));
      setDeleteModalOpen(false);
      setJobToDelete(null);
    } catch (err) {
      console.error('Failed to delete import job:', err);
      addToast({ type: 'error', title: 'Delete failed', description: err instanceof Error ? err.message : 'Failed to delete import job' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-[70vh]">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Imports</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Import your existing knowledge. Track your jobs and retry failures.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
          <Link
            href="/dashboard/knowledge"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <FileText className="w-4 h-4" />
            Browse Docs
          </Link>
          <Link
            href="/dashboard/knowledge/imports/markdown"
            className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Upload className="w-4 h-4" />
            Start Import
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search import jobs..."
            className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--surface-card)] border rounded-xl text-sm font-medium transition-all ${
              statusFilter !== "all" ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters{statusFilter !== "all" ? " (1)" : ""}
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-20 py-1">
              {(["all", "queued", "running", "completed", "failed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setShowFilters(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    statusFilter === s ? "bg-[var(--brand-primary-muted)] text-[var(--brand)] font-medium" : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--dash-text-primary)]">Import sources</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              Choose a source to connect, then start an import job.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {sources.map((s) => (
            <div
              key={s.name}
              className={`rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] p-4 flex flex-col ${s.comingSoon ? "opacity-75" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-[var(--dash-text-primary)]">{s.name}</div>
                <span className="w-9 h-9 rounded-xl bg-[var(--surface-card)] flex items-center justify-center border border-[var(--dash-border-subtle)]">
                  <Download className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                </span>
              </div>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-2 flex-1">{s.description}</p>
              {s.comingSoon ? (
                <div className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-muted)] cursor-not-allowed">
                  <Clock className="w-4 h-4" />
                  Coming Soon
                </div>
              ) : s.href ? (
                <Link
                  href={s.href}
                  className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  {s.cta}
                </Link>
              ) : (
                <button className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
                  {s.cta}
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)] text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
          <div className="col-span-3">Source</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Items</div>
          <div className="col-span-2">Started</div>
          <div className="col-span-2">Updated</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="divide-y divide-[var(--dash-border-subtle)]">
          {loading ? (
            <div className="px-5 py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)] mx-auto mb-2" />
              <p className="text-sm text-[var(--dash-text-tertiary)]">Loading import jobs...</p>
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center">
              <AlertTriangle className="w-6 h-6 text-[var(--status-error)] mx-auto mb-2" />
              <p className="text-sm font-medium text-[var(--dash-text-primary)]">{error}</p>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">Please try again later.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-[var(--dash-text-primary)]">No import jobs found</p>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">Import jobs will appear here once integrations are available.</p>
            </div>
          ) : (
            filtered.map((job) => (
              <div key={job.id} className="block hover:bg-[var(--surface-hover)] transition-colors">
                {/* Desktop Table View */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-4 items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] flex items-center justify-center">
                      <Download className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    </span>
                    <div>
                      <p className="font-medium text-[var(--dash-text-primary)]">{job.source}</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">{job.id}</p>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={job.status} />
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-[var(--dash-text-secondary)]">{job.items.toLocaleString()}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-[var(--dash-text-secondary)]">{job.createdAt}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-[var(--dash-text-secondary)]">{job.updatedAt}</p>
                    {job.notes && <p className="text-xs text-[var(--dash-text-muted)] truncate">{job.notes}</p>}
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <button className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline">
                      Details
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(job)}
                      className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                      title="Delete Import"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="flex md:hidden flex-col gap-3 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] flex items-center justify-center">
                        <Download className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                      </span>
                      <div>
                        <p className="font-medium text-[var(--dash-text-primary)]">{job.source}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
                          <span>{job.id}</span>
                          <span>•</span>
                          <span>{job.items} items</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>

                  {job.notes && <p className="text-sm text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)] p-2 rounded-lg">{job.notes}</p>}

                  <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] pt-2 border-t border-[var(--dash-border-subtle)]">
                    <span>Updated {job.updatedAt}</span>
                    <div className="flex items-center gap-2">
                      <button className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">
                        Details <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(job)}
                        className="p-1 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                        title="Delete Import"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[var(--dash-border-subtle)]">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Delete Import</h2>
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[var(--dash-text-secondary)]">
                Are you sure you want to delete the import job from{' '}
                <span className="font-semibold text-[var(--dash-text-primary)]">{jobToDelete?.source}</span>?
              </p>
              <p className="text-sm text-[var(--status-error)]">
                This action cannot be undone. The import job will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--dash-border-subtle)]">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-6 py-2.5 rounded-xl border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-6 py-2.5 rounded-xl bg-[var(--status-error)] hover:bg-[var(--status-error)]/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

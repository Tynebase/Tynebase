"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

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

const mockSources: Source[] = [
  {
    id: "src_1",
    title: "Security Best Practices",
    filename: "security-best-practices.pdf",
    type: "pdf",
    status: "embedded",
    sizeMb: 4.2,
    updatedAt: "10 min ago",
    chunks: 128,
    tokens: 51234,
  },
  {
    id: "src_2",
    title: "API Authentication",
    filename: "api-authentication.docx",
    type: "docx",
    status: "normalized",
    sizeMb: 0.9,
    updatedAt: "1 hour ago",
    chunks: 42,
    tokens: 16420,
  },
  {
    id: "src_3",
    title: "Onboarding Runbook",
    filename: "onboarding.md",
    type: "md",
    status: "chunking",
    sizeMb: 0.2,
    updatedAt: "Today",
    notes: "Splitting by headings + semantic merge (hybrid).",
  },
  {
    id: "src_4",
    title: "Legacy IT SOP",
    filename: "legacy-it-sop.pdf",
    type: "pdf",
    status: "failed",
    sizeMb: 12.6,
    updatedAt: "Yesterday",
    notes: "OCR failed on scanned pages (placeholder).",
  },
];

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockSources;
    return mockSources.filter((s) => `${s.title} ${s.filename}`.toLowerCase().includes(q));
  }, [query]);

  const stats = useMemo(() => {
    const total = mockSources.length;
    const embedded = mockSources.filter((s) => s.status === "embedded").length;
    const processing = mockSources.filter((s) =>
      ["normalizing", "normalized", "chunking"].includes(s.status)
    ).length;
    const failed = mockSources.filter((s) => s.status === "failed").length;
    return { total, embedded, processing, failed };
  }, []);

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
            <p className="text-xs text-[var(--dash-text-muted)]">Total Sources</p>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Embedded</p>
            <p className="text-2xl font-bold text-[var(--status-success)] mt-1">{stats.embedded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Processing</p>
            <p className="text-2xl font-bold text-[var(--status-warning)] mt-1">{stats.processing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-[var(--dash-text-muted)]">Failed</p>
            <p className="text-2xl font-bold text-[var(--status-error)] mt-1">{stats.failed}</p>
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

      <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl overflow-hidden flex flex-col">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)] text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
          <div className="col-span-5">Source</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Signals</div>
          <div className="col-span-1 text-right">Open</div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto divide-y divide-[var(--dash-border-subtle)]">
          {filtered.map((s) => (
            <div key={s.id} className="block hover:bg-[var(--surface-hover)] transition-colors">
              {/* Desktop Table View */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-5 items-center">
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center">
                    <Database className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--dash-text-primary)] truncate">{s.title}</p>
                    <p className="text-xs text-[var(--dash-text-muted)] truncate">{s.filename} • {s.sizeMb.toFixed(1)}MB • Updated {s.updatedAt}</p>
                    {s.notes && <p className="text-xs text-[var(--dash-text-tertiary)] mt-1 truncate">{s.notes}</p>}
                  </div>
                </div>

                <div className="col-span-2">
                  <TypeBadge type={s.type} />
                </div>

                <div className="col-span-2">
                  <StatusBadge status={s.status} />
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-[var(--dash-text-secondary)]">
                    {s.chunks ? `${s.chunks} chunks` : "-"}
                  </p>
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    {s.tokens ? `${s.tokens.toLocaleString()} tokens` : ""}
                  </p>
                </div>

                <div className="col-span-1 flex justify-end">
                  <Link
                    href="/dashboard/sources/normalized"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] hover:underline"
                  >
                    View
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="flex md:hidden flex-col gap-4 p-5 border-b border-[var(--dash-border-subtle)] last:border-0 pointer-events-none sm:pointer-events-auto">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    </span>
                    <div className="min-w-0 pointer-events-auto">
                      <p className="font-semibold text-[var(--dash-text-primary)] line-clamp-1">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <TypeBadge type={s.type} />
                        <span className="text-xs text-[var(--dash-text-muted)]">{s.sizeMb.toFixed(1)}MB</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                {s.notes && <p className="text-xs text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)] p-2 rounded-lg">{s.notes}</p>}

                <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] pt-2 border-t border-[var(--dash-border-subtle)] pointer-events-auto">
                  <div className="flex flex-col gap-0.5">
                    <span>Updated {s.updatedAt}</span>
                    <span>{s.chunks || 0} chunks • {s.tokens?.toLocaleString() || 0} tokens</span>
                  </div>
                  <Link
                    href="/dashboard/sources/normalized"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)]"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-[var(--dash-text-muted)]">
        This is a UI scaffold aligned to PRD Part IV: documents are normalized to Markdown before semantic chunking + embeddings.
      </div>
    </div>
  );
}

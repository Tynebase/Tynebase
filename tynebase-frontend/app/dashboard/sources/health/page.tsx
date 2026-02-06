"use client";

import Link from "next/link";
import {
  HeartPulse,
  ArrowLeft,
  Database,
  Sparkles,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export default function SourcesHealthPage() {
  return (
    <div className="min-h-full flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/sources" className="hover:text-[var(--brand)] inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Sources
            </Link>
            <span>/</span>
            <span>Index Health</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Index Health</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Monitor normalisation, chunking, embeddings and retrieval readiness.
          </p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all w-full sm:w-auto">
          <RefreshCcw className="w-4 h-4" />
          Re-run health checks
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Sources</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">4</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">2 embedded • 1 processing • 1 failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Total chunks</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">170</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Hybrid semantic chunking</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--brand)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Embedding jobs</p>
            </div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-2">1</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Queue: 0 • Running: 1</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-[var(--status-success)]" />
              <p className="text-xs text-[var(--dash-text-muted)]">Retrieval readiness</p>
            </div>
            <p className="text-2xl font-bold text-[var(--status-success)] mt-2">Good</p>
            <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Avg similarity {">"} 0.80</p>
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
            <div className="p-5 flex items-start gap-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#10b98115" }}>
                <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Embeddings up to date</p>
                <p className="text-sm text-[var(--dash-text-secondary)] mt-1">Security Best Practices → 128 chunks embedded</p>
                <p className="text-xs text-[var(--dash-text-muted)] mt-2">10 min ago</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#f59e0b15" }}>
                <Clock className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Chunking in progress</p>
                <p className="text-sm text-[var(--dash-text-secondary)] mt-1">Onboarding Runbook → splitting by headings + semantic merge</p>
                <p className="text-xs text-[var(--dash-text-muted)] mt-2">Today</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ef444415" }}>
                <AlertTriangle className="w-5 h-5" style={{ color: "#ef4444" }} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Normalisation failed</p>
                <p className="text-sm text-[var(--dash-text-secondary)] mt-1">Legacy IT SOP → OCR failed (placeholder)</p>
                <p className="text-xs text-[var(--dash-text-muted)] mt-2">Yesterday</p>
              </div>
            </div>
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
                <button className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors">
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Retry failed normalisations</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Run OCR / convert again for scanned PDFs.</p>
                </button>
                <button className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors">
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Review normalised Markdown</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Fix headings/tables that harm chunking quality.</p>
                </button>
                <button className="w-full text-left rounded-xl border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] bg-[var(--surface-card)] px-5 py-4 transition-colors">
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Run a test query</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Validate citations and retrieval relevance.</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

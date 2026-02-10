"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import {
  FileSearch,
  Search,
  Filter,
  Database,
  ArrowLeft,
  Copy,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ListTree,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { listNormalizedDocuments, type NormalizedDocument } from "@/lib/api/documents";
import { ApiClientError } from "@/lib/api/client";

type NormalizedDoc = {
  id: string;
  title: string;
  normalizedMd: string;
  status?: string | null;
  visibility?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type OutlineItem = {
  id: string;
  text: string;
  level: number;
};


function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split("\n");
  const items: OutlineItem[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    if (!text) continue;

    const base = toSlug(text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;

    items.push({ id, text, level });
  }

  return items;
}

function countMatches(text: string, re: RegExp) {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export default function NormalizedMarkdownPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<NormalizedDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listNormalizedDocuments(100);
      const mapped: NormalizedDoc[] = response.documents.map((doc: NormalizedDocument) => ({
        id: doc.id,
        title: doc.title,
        normalizedMd: doc.normalizedMd,
        status: doc.status,
        visibility: doc.visibility,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));

      setDocs(mapped);
      setSelectedId((prev) => {
        if (prev && mapped.some((d) => d.id === prev)) return prev;
        return mapped[0]?.id ?? null;
      });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load documents';
      setError(message);
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((d) => `${d.title} ${d.status ?? ""}`.toLowerCase().includes(q));
    }
    return result;
  }, [docs, query, statusFilter]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return docs.find((d) => d.id === selectedId) ?? null;
  }, [docs, selectedId]);

  const selectedSignals = useMemo(() => {
    if (!selected) {
      return {
        headings: 0,
        tables: 0,
        images: 0,
        words: 0,
        outline: [] as OutlineItem[],
      };
    }

    const md = selected.normalizedMd || '';
    const outline = extractOutline(md);
    const words = md.trim().length ? md.trim().split(/\s+/).length : 0;
    const headings = outline.length;
    const tables = countMatches(md, /\n\|.+\|\n\|[-:|\s]+\|/g);
    const images = countMatches(md, /!\[[^\]]*\]\([^\)]+\)/g);

    return { headings, tables, images, words, outline };
  }, [selected]);

  const onCopy = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.normalizedMd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, [selected]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 lg:col-span-3">
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Normalised Markdown (RAG View)</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Read the exact normalised Markdown stored for retrieval and chunking.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-3 flex items-center justify-start lg:justify-end gap-2">
          <button
            onClick={() => loadDocs()}
            className="inline-flex items-center gap-2 h-9 px-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={onCopy}
            disabled={!selected}
            className="inline-flex items-center gap-2 h-9 px-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all disabled:opacity-50 disabled:hover:border-[var(--dash-border-subtle)] disabled:hover:text-[var(--dash-text-secondary)]"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copied" : "Copy Markdown"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/5 px-4 py-3 text-sm text-[var(--dash-text-secondary)] flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[var(--status-error)] mt-0.5" />
          <div>
            <p className="font-semibold text-[var(--dash-text-primary)]">Couldn't load documents from the database</p>
            <p className="text-[var(--dash-text-tertiary)] mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 xl:col-span-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search normalised docs…"
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--surface-card)] border rounded-xl text-sm font-semibold transition-all ${
                  statusFilter !== "all" ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]"
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-20 py-1">
                  {(["all", "published", "draft"] as const).map((s) => (
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

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Documents</p>
              </div>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)]">
              {isLoading && (
                <div className="px-4 py-8 text-sm text-[var(--dash-text-tertiary)]">Loading documents…</div>
              )}

              {!isLoading && filtered.length === 0 && (
                <div className="px-4 py-8 text-sm text-[var(--dash-text-tertiary)]">
                  No normalised documents found.
                </div>
              )}

              {!isLoading &&
                filtered.map((d) => {
                  const active = d.id === selectedId;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors ${active ? "bg-[var(--brand)]/10" : ""
                        }`}
                    >
                      <p className="font-semibold text-[var(--dash-text-primary)] truncate">{d.title}</p>
                      <p className="text-xs text-[var(--dash-text-muted)] truncate mt-0.5">
                        {(d.status ?? "draft").charAt(0).toUpperCase() + (d.status ?? "draft").slice(1)}
                        {d.updatedAt ? ` • Updated ${new Date(d.updatedAt).toLocaleString()}` : ""}
                      </p>
                    </button>
                  );
                })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
              <div className="flex items-center gap-2">
                <ListTree className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Outline</p>
              </div>
            </div>
            <div className="px-4 py-3">
              {!selected && (
                <p className="text-sm text-[var(--dash-text-tertiary)]">Select a document to see its headings.</p>
              )}

              {selected && selectedSignals.outline.length === 0 && (
                <p className="text-sm text-[var(--dash-text-tertiary)]">No headings detected in this markdown.</p>
              )}

              {selected && selectedSignals.outline.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {selectedSignals.outline.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        const element = document.getElementById(h.id);
                        const scrollContainer = document.getElementById('markdown-reader-scroll');
                        if (element && scrollContainer) {
                          const containerRect = scrollContainer.getBoundingClientRect();
                          const elementRect = element.getBoundingClientRect();
                          const scrollTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top) - 24;
                          scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
                        }
                      }}
                      className="block text-left w-full text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                      style={{ paddingLeft: `${Math.min(20, (h.level - 1) * 10)}px` }}
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Normalisation signals</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                <p className="text-xs text-[var(--dash-text-muted)]">Headings</p>
                <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.headings}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                <p className="text-xs text-[var(--dash-text-muted)]">Tables</p>
                <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.tables}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                <p className="text-xs text-[var(--dash-text-muted)]">Images</p>
                <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.images}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                <p className="text-xs text-[var(--dash-text-muted)]">Words</p>
                <p className="text-lg font-semibold text-[var(--dash-text-primary)]">
                  {selectedSignals.words.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-[var(--dash-text-tertiary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--brand)]" />
              PRD Part IV: normalise to Markdown before semantic chunking.
            </div>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-8">
          {!selected && (
            <Card className="overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">No document selected</p>
                </div>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                  Pick a document on the left to preview the normalised markdown used for retrieval.
                </p>
              </div>
              <div className="px-6 py-10 text-sm text-[var(--dash-text-tertiary)]">
                Your normalised markdown is stored as `documents.content`.
              </div>
            </Card>
          )}

          {selected && (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--dash-text-primary)] truncate">{selected.title}</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                        {(selected.status ?? "draft").charAt(0).toUpperCase() + (selected.status ?? "draft").slice(1)} • {(selected.visibility ?? "team").charAt(0).toUpperCase() + (selected.visibility ?? "team").slice(1)}
                        {selected.updatedAt ? ` • Updated ${new Date(selected.updatedAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                    <p className="text-xs text-[var(--dash-text-muted)]">Words</p>
                    <p className="text-lg font-semibold text-[var(--dash-text-primary)]">
                      {selectedSignals.words.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                    <p className="text-xs text-[var(--dash-text-muted)]">Headings</p>
                    <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.headings}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                    <p className="text-xs text-[var(--dash-text-muted)]">Tables</p>
                    <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.tables}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-ground)] p-3">
                    <p className="text-xs text-[var(--dash-text-muted)]">Images</p>
                    <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedSignals.images}</p>
                  </div>
                </div>
              </Card>

              <MarkdownReader content={selected.normalizedMd || ''} id="markdown-reader" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

type NormalizedDoc = {
  id: string;
  title: string;
  normalizedMd: string;
  fileType?: string | null;
  fileUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type OutlineItem = {
  id: string;
  text: string;
  level: number;
};

const demoDocs: NormalizedDoc[] = [
  {
    id: "n1",
    title: "Security Best Practices",
    normalizedMd: `# Security Best Practices\n\n## Overview\n\nThis document represents the **normalized markdown** that the RAG pipeline chunks + embeds.\n\n## Authentication\n\n- Prefer **OAuth 2.0** for user-facing clients\n- Prefer **API keys** for server-to-server\n\n## Checklist\n\n- [ ] Enforce MFA\n- [ ] Rotate secrets\n- [ ] Review access quarterly\n\n> Note: This content is what the model sees. Any formatting issues here will hurt retrieval quality.\n`,
    fileType: "application/pdf",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "n2",
    title: "API Authentication",
    normalizedMd: `# API Authentication\n\n## Authentication Methods\n\n1. API Keys\n2. OAuth 2.0\n\n## Example\n\n\`\`\`bash\ncurl -H \"Authorization: Bearer $API_KEY\" https://api.tynebase.com/v1/documents\n\`\`\`\n\n## Rate Limits\n\n| Plan | Requests/min |\n|---|---:|\n| Pro | 1000 |\n| Enterprise | 5000 |\n`,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

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
  const [docs, setDocs] = useState<NormalizedDoc[]>(demoDocs);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadDocs = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setIsConfigured(supabase !== null);
    setIsLoading(true);
    setError(null);

    if (!supabase) {
      setDocs(demoDocs);
      setSelectedId((prev) => prev ?? demoDocs[0]?.id ?? null);
      setIsLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("documents")
      .select("id,title,normalized_md,file_type,file_url,created_at,updated_at")
      .not("normalized_md", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setDocs(demoDocs);
      setSelectedId((prev) => prev ?? demoDocs[0]?.id ?? null);
      setError(queryError.message);
      setIsLoading(false);
      return;
    }

    const mapped: NormalizedDoc[] = (data ?? [])
      .map((row: Record<string, unknown>) => ({
        id: String(row.id),
        title: String(row.title ?? "Untitled"),
        normalizedMd: String(row.normalized_md ?? ""),
        fileType: (row.file_type as string | null) ?? null,
        fileUrl: (row.file_url as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        updatedAt: (row.updated_at as string | null) ?? null,
      }))
      .filter((d: NormalizedDoc) => d.normalizedMd.trim().length > 0);

    setDocs(mapped.length ? mapped : []);
    setSelectedId((prev) => {
      if (prev && mapped.some((d) => d.id === prev)) return prev;
      return mapped[0]?.id ?? null;
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => `${d.title} ${d.fileType ?? ""}`.toLowerCase().includes(q));
  }, [docs, query]);

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

    const md = selected.normalizedMd;
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
            <Link href="/dashboard/sources" className="hover:text-[var(--brand)] inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Sources
            </Link>
            <span>/</span>
            <span>Normalized Markdown</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Normalized Markdown (RAG View)</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Read the exact normalized Markdown stored for retrieval and chunking.
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

      {!isConfigured && (
        <div className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--dash-text-tertiary)]">
          Supabase is not configured. Showing demo data. Add `NEXT_PUBLIC_SUPABASE_URL` and
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` to load your real knowledge base.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/5 px-4 py-3 text-sm text-[var(--dash-text-secondary)] flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[var(--status-error)] mt-0.5" />
          <div>
            <p className="font-semibold text-[var(--dash-text-primary)]">Couldn’t load documents from the database</p>
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
                placeholder="Search normalized docs…"
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
              />
            </div>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
              <Filter className="w-4 h-4" />
            </button>
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
                  No normalized documents found.
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
                        {d.fileType ?? "Unknown type"}
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
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="block text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                      style={{ paddingLeft: `${Math.min(20, (h.level - 1) * 10)}px` }}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Normalization signals</p>
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
              PRD Part IV: normalize to Markdown before semantic chunking.
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
                  Pick a document on the left to preview the normalized markdown used for retrieval.
                </p>
              </div>
              <div className="px-6 py-10 text-sm text-[var(--dash-text-tertiary)]">
                Your normalized markdown is stored as `documents.normalized_md`.
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
                        {selected.fileType ?? "Unknown type"}
                        {selected.updatedAt ? ` • Updated ${new Date(selected.updatedAt).toLocaleString()}` : ""}
                        {selected.fileUrl ? " • Source attached" : ""}
                      </p>
                    </div>
                    {selected.fileUrl && (
                      <a
                        href={selected.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-9 px-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
                      >
                        Open source
                      </a>
                    )}
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

              <MarkdownReader content={selected.normalizedMd} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

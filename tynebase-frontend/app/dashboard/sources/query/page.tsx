"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  ArrowLeft,
  Search,
  RefreshCw,
  ExternalLink,
  Maximize2,
  AlertTriangle,
} from "lucide-react";

type NormalizedDoc = {
  id: string;
  title: string;
  normalizedMd: string;
  fileType?: string | null;
  fileUrl?: string | null;
  updatedAt?: string | null;
};

const demoDocs: NormalizedDoc[] = [
  {
    id: "n1",
    title: "Security Best Practices",
    normalizedMd: `# Security Best Practices\n\n## Overview\n\nThis is a demo document. Configure Supabase to load your real knowledge base.\n\n## Authentication\n\n- Prefer **OAuth 2.0** for user-facing clients\n- Prefer **API keys** for server-to-server\n\n## Checklist\n\n- [ ] Enforce MFA\n- [ ] Rotate secrets\n- [ ] Review access quarterly\n`,
    fileType: "application/pdf",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "n2",
    title: "API Authentication",
    normalizedMd: `# API Authentication\n\n## Authentication Methods\n\n1. API Keys\n2. OAuth 2.0\n\n## Example\n\n\`\`\`bash\ncurl -H \"Authorization: Bearer $API_KEY\" https://api.tynebase.com/v1/documents\n\`\`\`\n`,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

export default function QueryWorkspacePage() {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<NormalizedDoc[]>(demoDocs);
  const [selectedId, setSelectedId] = useState<string | null>(demoDocs[0]?.id ?? null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadDocs = useCallback(async () => {
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
      .select("id,title,normalized_md,file_type,file_url,updated_at")
      .not("normalized_md", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200);

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
        updatedAt: (row.updated_at as string | null) ?? null,
      }))
      .filter((d) => d.normalizedMd.trim().length > 0);

    setDocs(mapped);
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

  return (
    <div className="min-h-full flex flex-col gap-6 max-w-7xl mx-auto px-2 sm:px-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/sources" className="hover:text-[var(--brand)] inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Sources
            </Link>
            <span>/</span>
            <span>Reader</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Workspace Document Reader</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Browse the normalized Markdown stored in your database and preview what the model uses for retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => loadDocs()} className="gap-2" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/dashboard/sources/normalized" className={buttonVariants({ variant: "secondary" })}>
            <ExternalLink className="w-4 h-4" />
            Full inspector
          </Link>
        </div>
      </div>

      {!isConfigured && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--dash-text-tertiary)]">
            Supabase is not configured. Showing demo data. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to load your real knowledge base.
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border border-[var(--status-error)]/30 bg-[var(--status-error)]/5">
          <CardContent className="pt-6 text-sm text-[var(--dash-text-secondary)] flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[var(--status-error)] mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--dash-text-primary)]">Couldn’t load documents from the database</p>
              <p className="text-[var(--dash-text-tertiary)] mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 xl:col-span-4 space-y-4 min-h-0">
          <Card>
            <CardHeader className="pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)] truncate">Documents</p>
                </div>
                <p className="text-xs text-[var(--dash-text-muted)]">{filtered.length}</p>
              </div>

              <div className="rounded-xl border border-[var(--dash-border-subtle)] overflow-hidden divide-y divide-[var(--dash-border-subtle)]">
                {isLoading && (
                  <div className="px-4 py-8 text-sm text-[var(--dash-text-tertiary)]">Loading documents…</div>
                )}

                {!isLoading && filtered.length === 0 && (
                  <div className="px-4 py-8 text-sm text-[var(--dash-text-tertiary)]">No normalized documents found.</div>
                )}

                {!isLoading &&
                  filtered.map((d) => {
                    const active = d.id === selectedId;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={
                          "w-full text-left px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors " +
                          (active ? "bg-[var(--brand)]/10" : "")
                        }
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
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-8 min-h-0">
          {!selected && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">No document selected</p>
                </div>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Pick a document to preview its normalized markdown.</p>
              </CardHeader>
              <CardContent className="text-sm text-[var(--dash-text-tertiary)]">
                Your normalized markdown is stored as `documents.normalized_md`.
              </CardContent>
            </Card>
          )}

          {selected && (
            <div className="space-y-4 min-h-0">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--dash-text-primary)] truncate">{selected.title}</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                        {selected.fileType ?? "Unknown type"}
                        {selected.updatedAt ? ` • Updated ${new Date(selected.updatedAt).toLocaleString()}` : ""}
                        {selected.fileUrl ? " • Source attached" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
                        <Maximize2 className="w-4 h-4" />
                        Open
                      </Button>

                      {selected.fileUrl && (
                        <a
                          href={selected.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Open source
                        </a>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-[var(--dash-text-tertiary)]">
                  This view reads from `documents.normalized_md` and renders it as Markdown.
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <MarkdownReader content={selected.normalizedMd} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selected?.title ?? "Document"}
        description={selected ? "Normalized markdown preview" : undefined}
        size="full"
        className="max-h-[85vh] overflow-hidden"
      >
        {!selected && <div className="text-sm text-[var(--dash-text-tertiary)]">No document selected.</div>}
        {selected && (
          <div className="h-[70vh] overflow-auto">
            <div className="mb-4 text-xs text-[var(--dash-text-tertiary)]">
              {selected.fileType ?? "Unknown type"}
              {selected.updatedAt ? ` • Updated ${new Date(selected.updatedAt).toLocaleString()}` : ""}
            </div>
            <MarkdownReader content={selected.normalizedMd} />
          </div>
        )}
      </Modal>
    </div>
  );
}

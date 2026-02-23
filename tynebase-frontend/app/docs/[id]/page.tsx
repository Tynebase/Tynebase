"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FileText, User, Clock, Eye, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { getPublicDocument, Document } from "@/lib/api/documents";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function PublicDocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPublicDocument(documentId);
        setDocument(response.document);
      } catch (err) {
        console.error("Failed to fetch document:", err);
        setError(err instanceof Error ? err.message : "Document not found or not public");
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-ground)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--dash-text-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-[var(--surface-ground)] flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)] mb-2">
            Document Not Found
          </h1>
          <p className="text-[var(--dash-text-tertiary)] mb-6">
            {error || "This document doesn't exist or is not publicly accessible."}
          </p>
          <Link
            href="/dashboard/community/shared-documents"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg hover:bg-[var(--brand-dark)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Public Documents
          </Link>
        </div>
      </div>
    );
  }

  const authorName = (document as any).users?.full_name || "Unknown Author";
  const categoryName = (document as any).categories?.name;
  const categoryColor = (document as any).categories?.color || "#6b7280";

  return (
    <div className="min-h-screen bg-[var(--surface-ground)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--dash-border-subtle)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/dashboard/community/shared-documents"
            className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Link>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
            <Eye className="w-4 h-4" />
            {document.view_count || 0} views
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Document Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--brand-primary-muted)] flex items-center justify-center">
              <FileText className="w-6 h-6 text-[var(--brand)]" />
            </div>
            <div>
              {categoryName && (
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-1"
                  style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                >
                  {categoryName}
                </span>
              )}
              <h1 className="text-3xl font-bold text-[var(--dash-text-primary)]">
                {document.title}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-[var(--dash-text-muted)]">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {authorName}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDate(document.created_at)}
            </span>
          </div>
        </div>

        {/* Document Content */}
        <article className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8">
          <div className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:text-[var(--dash-text-primary)]
            prose-p:text-[var(--dash-text-secondary)]
            prose-a:text-[var(--brand)]
            prose-strong:text-[var(--dash-text-primary)]
            prose-code:bg-[var(--surface-ground)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-[var(--surface-ground)] prose-pre:border prose-pre:border-[var(--dash-border-subtle)]
            prose-blockquote:border-l-[var(--brand)] prose-blockquote:text-[var(--dash-text-tertiary)]
            prose-ul:text-[var(--dash-text-secondary)]
            prose-ol:text-[var(--dash-text-secondary)]
            prose-li:text-[var(--dash-text-secondary)]
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {document.content || "No content available."}
            </ReactMarkdown>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--dash-border-subtle)] mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-[var(--dash-text-muted)]">
          Shared via{" "}
          <Link href="/" className="text-[var(--brand)] hover:underline">
            Tynebase
          </Link>
        </div>
      </footer>
    </div>
  );
}

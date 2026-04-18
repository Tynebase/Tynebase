"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, User, Clock, Eye } from "lucide-react";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import { getPublicDocument, Document } from "@/lib/api/documents";
import { listSharedDocuments } from "@/lib/api/documents";
import { estimateReadTime } from "@/lib/api/kb";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SharedDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<Document[]>([]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPublicDocument(documentId);
        setDoc(response.document);

        // Fetch related documents
        const relatedResponse = await listSharedDocuments({ page: 1, limit: 10 });
        setRelatedDocs(relatedResponse.documents.filter(d => d.id !== documentId));
      } catch (err) {
        console.error("Failed to fetch document:", err);
        setError("Failed to load document. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-[var(--dash-text-muted)] mb-4" />
        <h1 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Document Not Found</h1>
        <p className="text-[var(--dash-text-tertiary)] mb-4">{error || "This document doesn't exist or is not publicly accessible."}</p>
        <button
          onClick={() => router.push("/dashboard/community/shared-documents")}
          className="px-4 py-2 bg-[var(--brand)] text-white rounded-lg hover:bg-[var(--brand-dark)] transition-colors"
        >
          Back to Shared Documents
        </button>
      </div>
    );
  }

  const authorName = doc.users?.full_name || doc.users?.email || "Unknown";
  const readTime = estimateReadTime(doc.content || "");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--dash-border-subtle)] flex-shrink-0">
        <button
          onClick={() => router.push("/dashboard/community/shared-documents")}
          className="p-2 hover:bg-[var(--dash-border-subtle)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--dash-text-secondary)]" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--dash-text-primary)]">{doc.title}</h1>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--dash-border-subtle)] flex-shrink-0 text-sm">
        <span className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
          <User className="w-4 h-4" />
          {authorName}
        </span>
        <span className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
          <Clock className="w-4 h-4" />
          {readTime} min read
        </span>
        <span className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
          <Eye className="w-4 h-4" />
          {doc.view_count || 0} views
        </span>
        <span className="text-[var(--dash-text-secondary)]">
          {formatDate(doc.updated_at || doc.created_at)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <MarkdownReader
          title={doc.title}
          content={doc.content || "No content available."}
        />
      </div>

      {/* Related Documents */}
      {relatedDocs.length > 0 && (
        <div className="px-4 py-4 border-t border-[var(--dash-border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--dash-text-primary)] mb-3">Related Documents</h3>
          <div className="space-y-2">
            {relatedDocs.map((d) => (
              <Link
                key={d.id}
                href={`/dashboard/community/shared-documents/${d.id}`}
                className="block p-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg hover:border-[var(--brand)] transition-colors"
              >
                <div className="font-medium text-[var(--dash-text-primary)]">{d.title}</div>
                <div className="text-xs text-[var(--dash-text-muted)] mt-1">
                  {d.users?.full_name || d.users?.email || "Unknown"} · {formatDate(d.created_at)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

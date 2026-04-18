"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, User, Clock, Eye } from "lucide-react";
import { DocsLayout, type DocsNavSection } from "@/components/docs/DocsLayout";
import { getPublicDocument, Document } from "@/lib/api/documents";
import { listSharedDocuments } from "@/lib/api/documents";
import { estimateReadTime } from "@/lib/api/kb";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SharedDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = params.id as string;
  const fromDashboard = searchParams.get('from') === 'dashboard';

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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
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

  // Build sections from related docs
  const sections: DocsNavSection[] = relatedDocs.length > 0 ? [
    {
      id: "related",
      title: "Related Documents",
      articles: relatedDocs.map(d => ({
        slug: d.id,
        title: d.title,
        href: `/dashboard/community/shared-documents/${d.id}`,
      })),
    },
  ] : [];

  // Fallback to prevent layout collapse when no related docs
  const finalSections: DocsNavSection[] = sections.length > 0
    ? sections
    : [{
        id: '__current__',
        title: 'Documents',
        articles: [{ slug: documentId, title: doc?.title || 'Document', href: `/dashboard/community/shared-documents/${documentId}` }],
      }];

  const header = (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--dash-border-subtle)]">
      <button
        onClick={() => router.push("/dashboard/community/shared-documents")}
        className="p-2 hover:bg-[var(--dash-border-subtle)] rounded-lg transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--dash-text-secondary)]" />
      </button>
      <h1 className="text-lg font-semibold text-[var(--dash-text-primary)]">Shared Document</h1>
    </div>
  );

  const authorName = doc.users?.full_name || doc.users?.email || "Unknown";
  const readTime = estimateReadTime(doc.content || "");

  const meta = [
    { label: "Author", value: authorName },
    { label: "Read time", value: `${readTime} min` },
    { label: "Views", value: String(doc.view_count || 0) },
    { label: "Updated", value: formatDate(doc.updated_at || doc.created_at) },
  ];

  const breadcrumbs = [
    { label: "Community", href: "/dashboard/community" },
    { label: "Shared Documents", href: "/dashboard/community/shared-documents" },
    { label: doc.title },
  ];

  return (
    <DocsLayout
      sections={finalSections}
      currentSlug={documentId}
      title={doc.title}
      content={doc.content || "No content available."}
      meta={meta}
      basePath="/dashboard/community/shared-documents"
      breadcrumbs={breadcrumbs}
      header={header}
    />
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { DocsLayout, DocsNavSection } from "@/components/docs/DocsLayout";
import { getPublicDocument, listSharedDocuments, Document } from "@/lib/api/documents";
import { estimateReadTime } from "@/lib/api/kb";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SharedDocumentPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDocs, setAllDocs] = useState<Document[]>([]);

  // Reference to our wrapper div — used to walk up and find the dashboard's
  // scrollable <main> so DocsLayout can target it for sticky/scroll operations.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let el = wrapperRef.current?.parentElement;
    while (el) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scrollContainerRef.current = el;
        break;
      }
      el = el.parentElement;
    }
  }, []);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        const [docResponse, listResponse] = await Promise.all([
          getPublicDocument(documentId),
          listSharedDocuments({ page: 1, limit: 50 }),
        ]);
        setDoc(docResponse.document);
        setAllDocs(listResponse.documents);
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
      <div ref={wrapperRef} className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div ref={wrapperRef} className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-[var(--dash-text-muted)] mb-4" />
        <h1 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Document Not Found</h1>
        <p className="text-[var(--dash-text-tertiary)] mb-4">{error || "This document doesn't exist or is not publicly accessible."}</p>
      </div>
    );
  }

  const authorName = doc.users?.full_name || doc.users?.email || "Unknown";
  const readTime = estimateReadTime(doc.content || "");

  const sections: DocsNavSection[] = [
    {
      id: "shared-documents",
      title: "Shared Documents",
      defaultOpen: true,
      articles: allDocs.map((d) => ({
        slug: d.id,
        title: d.title,
        href: `/dashboard/community/shared-documents/${d.id}`,
      })),
    },
  ];

  const meta = [
    { label: "Author", value: authorName },
    { label: "Read time", value: `${readTime} min` },
    { label: "Views", value: String(doc.view_count || 0) },
    { label: "Updated", value: formatDate(doc.updated_at || doc.created_at) },
  ];

  return (
    <div ref={wrapperRef} className="min-h-full -mx-4 -my-6 sm:-mx-8 sm:-my-8 lg:-mx-10">
      <DocsLayout
        sections={sections}
        currentSlug={documentId}
        basePath="/dashboard/community/shared-documents"
        title={doc.title}
        content={doc.content || "No content available."}
        meta={meta}
        breadcrumbs={[
          { label: "Community", href: "/dashboard/community" },
          { label: "Shared Documents", href: "/dashboard/community/shared-documents" },
          { label: doc.title },
        ]}
        scrollContainerRef={scrollContainerRef}
        stickyTopOffset={0}
      />
    </div>
  );
}

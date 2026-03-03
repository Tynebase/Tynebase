"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { User, Clock, Eye, ArrowLeft, Loader2, AlertCircle, Building2, Tag } from "lucide-react";
import { getPublicDocument, Document } from "@/lib/api/documents";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

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
            href="/public-documents"
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
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      {/* Content */}
      <main style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        <div className="container" style={{ maxWidth: '860px' }}>
          {/* Back link */}
          <Link
            href="/public-documents"
            className="inline-flex items-center gap-2 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Public Documents
          </Link>

          {/* Document Meta */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            {categoryName && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                {categoryName}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <User className="w-4 h-4" />
              {authorName}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <Clock className="w-4 h-4" />
              {formatDate(document.created_at)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <Eye className="w-4 h-4" />
              {document.view_count || 0} views
            </span>
          </div>

          {/* Document Content - using same MarkdownReader as main app */}
          <MarkdownReader 
            content={document.content || "No content available."} 
            title={document.title}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

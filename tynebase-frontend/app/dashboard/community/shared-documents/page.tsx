"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  FileText, Search, Eye, Clock, User, Loader2, FolderOpen, BookOpen, X, ArrowLeft
} from "lucide-react";
import { DocsLayout, type DocsNavSection } from "@/components/docs/DocsLayout";
import { getPublicDocument } from "@/lib/api/documents";
import { listSharedDocuments, Document } from "@/lib/api/documents";
import { listPublicTemplates, Template } from "@/lib/api/templates";
import { useAuth } from "@/contexts/AuthContext";

// Strip markdown/HTML for plain text preview
const stripMarkdown = (text: string): string => {
  return text
    .replace(/#{1,6}\s?/g, '') // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1') // bold alt
    .replace(/_([^_]+)_/g, '$1') // italic alt
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '') // images
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/^>\s?/gm, '') // blockquotes
    .replace(/^[-*+]\s/gm, '') // list items
    .replace(/^\d+\.\s/gm, '') // numbered lists
    .replace(/<[^>]*>/g, '') // HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
};

type TabType = "documents" | "templates";

export default function SharedDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const tabFromUrl = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl === 'templates' ? 'templates' : 'documents');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Update URL to preserve tab state in browser history
    router.replace(`/dashboard/community/shared-documents${tab === 'templates' ? '?tab=templates' : ''}`, { scroll: false });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [docLoading, setDocLoading] = useState(false);

  const fetchDocuments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await listSharedDocuments({ page, limit: 20 });
      setDocuments(response.documents);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (err) {
      console.error("Failed to fetch shared documents:", err);
      setError("Failed to load shared documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await listPublicTemplates({ page, limit: 20 });
      setTemplates(response.templates);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (err) {
      console.error("Failed to fetch shared templates:", err);
      setError("Failed to load shared templates. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenDocument = async (doc: Document) => {
    setSelectedDoc(doc);
    setDocLoading(true);
    try {
      const response = await getPublicDocument(doc.id);
      setDocContent(response.document.content || "");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      setDocContent("");
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "documents") {
      fetchDocuments(1);
    } else {
      fetchTemplates(1);
    }
  }, [activeTab, fetchDocuments, fetchTemplates]);

  const filteredDocuments = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-full min-h-0 w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6 flex-shrink-0 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Shared Documents</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Browse documents and templates shared with the community
          </p>
        </div>
        <Button variant="outline" size="md" asChild>
          <Link href="/dashboard/community">
            ← Back to Forum
          </Link>
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => handleTabChange("documents")}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
            ${activeTab === "documents"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "bg-[var(--surface-card)] text-[var(--dash-text-secondary)] border border-[var(--dash-border-subtle)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          <FileText className="w-4 h-4" />
          Documents
        </button>
        <button
          onClick={() => handleTabChange("templates")}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
            ${activeTab === "templates"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "bg-[var(--surface-card)] text-[var(--dash-text-secondary)] border border-[var(--dash-border-subtle)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          <BookOpen className="w-4 h-4" />
          Templates
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
        />
      </div>

      {/* Content */}
      <Card className="flex-1 min-h-0 flex flex-col relative">
        <CardHeader className="px-5 py-3 border-b border-[var(--dash-border-subtle)]">
          <CardTitle className="text-base flex items-center gap-2">
            {activeTab === "documents" ? (
              <>
                <FileText className="w-4 h-4 text-[var(--brand)]" />
                Public Documents
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 text-[var(--brand)]" />
                Community Templates
              </>
            )}
            <span className="text-xs text-[var(--dash-text-muted)] font-normal ml-2">
              {pagination.total} {activeTab === "documents" ? "documents" : "templates"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto dashboard-scroll">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
              <span className="ml-2 text-[var(--dash-text-secondary)]">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[var(--dash-text-tertiary)]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => activeTab === "documents" ? fetchDocuments(1) : fetchTemplates(1)}
              >
                Try Again
              </Button>
            </div>
          ) : activeTab === "documents" ? (
            filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="w-12 h-12 text-[var(--dash-text-muted)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--dash-text-primary)]">No shared documents yet</h3>
                <p className="text-[var(--dash-text-tertiary)] mt-1 max-w-md">
                  Publish a document with Public visibility to share it with the community.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredDocuments.map((doc) => {
                  const authorName = doc.users?.full_name || doc.users?.email || "Unknown";
                  return (
                    <div key={doc.id} className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-5 hover:shadow-md hover:border-[var(--brand)] transition-all group">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary-muted)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[var(--brand)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => handleOpenDocument(doc)}
                            className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] transition-colors truncate block text-left"
                          >
                            {doc.title}
                          </button>
                          <p className="text-xs text-[var(--dash-text-muted)] flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {authorName}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-2 mb-3">
                        {doc.content ? stripMarkdown(doc.content).slice(0, 150) : "No content preview available"}
                      </p>
                      <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(doc.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {doc.view_count || 0} views
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-12 h-12 text-[var(--dash-text-muted)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--dash-text-primary)]">No shared templates yet</h3>
                <p className="text-[var(--dash-text-tertiary)] mt-1 max-w-md">
                  Share your templates with the community by setting their visibility to Public.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredTemplates.map((template) => {
                  const authorName = template.users?.full_name || template.users?.email || "Unknown";
                  return (
                    <Link
                      key={template.id}
                      href={`/dashboard/templates/${template.id}`}
                      className="block bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-5 hover:shadow-md hover:border-[var(--brand)] transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                            {template.title}
                          </h3>
                          <p className="text-xs text-[var(--dash-text-muted)] flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {authorName}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-2 mb-3">
                        {template.description || "No description available"}
                      </p>
                      <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(template.created_at)}
                        </span>
                        <span className="capitalize px-2 py-0.5 bg-[var(--surface-card)] rounded">
                          {template.category || "General"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => activeTab === "documents" ? fetchDocuments(pagination.page - 1) : fetchTemplates(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--dash-text-secondary)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => activeTab === "documents" ? fetchDocuments(pagination.page + 1) : fetchTemplates(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDoc && (
        <div
          className="absolute inset-0 bg-[var(--surface-card)] z-10 flex flex-col"
          onClick={() => setSelectedDoc(null)}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border-subtle)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 hover:bg-[var(--dash-border-subtle)] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[var(--dash-text-secondary)]" />
              </button>
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedDoc.title}</h3>
            </div>
            <button
              onClick={() => setSelectedDoc(null)}
              className="p-2 hover:bg-[var(--dash-border-subtle)] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[var(--dash-text-secondary)]" />
            </button>
          </div>

          {/* Modal Content - Scrollable for DocsLayout */}
          <div className="flex-1 overflow-auto">
            {docLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
              </div>
            ) : (
              <DocsLayout
                sections={[]}
                currentSlug={selectedDoc.id}
                title={selectedDoc.title}
                content={docContent}
                meta={[
                  { label: "Author", value: selectedDoc.users?.full_name || selectedDoc.users?.email || "Unknown" },
                  { label: "Views", value: String(selectedDoc.view_count || 0) },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

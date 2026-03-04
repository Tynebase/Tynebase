"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search, FileText, Eye, Clock, User, Loader2, AlertCircle,
  BookOpen, FolderOpen, ChevronRight, ArrowLeft, Globe,
} from "lucide-react";
import { getKBLanding, getKBDocuments, estimateReadTime } from "@/lib/api/kb";
import type { KBTenant, KBCategory, KBDocumentsData } from "@/lib/api/kb";

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function KBPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomain = params.subdomain as string;

  const [tenant, setTenant] = useState<KBTenant | null>(null);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document list state (when a category is selected or searching)
  const [selectedCategory, setSelectedCategory] = useState<KBCategory | null>(null);
  const [documents, setDocuments] = useState<KBDocumentsData | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Check URL params for initial state
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search");

  // Fetch KB landing data
  useEffect(() => {
    const fetchKB = async () => {
      try {
        setLoading(true);
        const data = await getKBLanding(subdomain);
        setTenant(data.tenant);
        setCategories(data.categories);
        setTotalDocs(data.totalDocuments);

        // Apply branding
        if (data.tenant.branding.primary_color) {
          document.documentElement.style.setProperty("--brand", data.tenant.branding.primary_color);
          document.documentElement.style.setProperty("--brand-primary", data.tenant.branding.primary_color);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Knowledge base not found");
      } finally {
        setLoading(false);
      }
    };
    fetchKB();
  }, [subdomain]);

  // Fetch documents when category changes or search
  const fetchDocuments = useCallback(async (categoryId?: string, search?: string) => {
    try {
      setDocsLoading(true);
      const data = await getKBDocuments(subdomain, {
        category_id: categoryId,
        search: search || undefined,
        limit: 50,
      });
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [subdomain]);

  // Handle category param from URL on initial load
  useEffect(() => {
    if (!loading && categories.length > 0) {
      if (categoryParam) {
        const cat = categories.find(c => c.id === categoryParam);
        if (cat) {
          setSelectedCategory(cat);
          fetchDocuments(cat.id);
        }
      }
      if (searchParam) {
        setSearchQuery(searchParam);
        setSearchInput(searchParam);
        fetchDocuments(undefined, searchParam);
      }
    }
  }, [loading, categories, categoryParam, searchParam, fetchDocuments]);

  const handleCategoryClick = (category: KBCategory) => {
    setSelectedCategory(category);
    setSearchQuery("");
    setSearchInput("");
    fetchDocuments(category.id);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setDocuments(null);
    setSearchQuery("");
    setSearchInput("");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim());
      setSelectedCategory(null);
      fetchDocuments(undefined, searchInput.trim());
    }
  };

  const handleViewAll = () => {
    setSelectedCategory(null);
    fetchDocuments();
  };

  const brandColor = tenant?.branding.primary_color || "#E85002";
  const companyName = tenant?.branding.company_name || tenant?.name || "Knowledge Base";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading knowledge base...</span>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Not Found</h1>
          <p className="text-gray-400 mb-6">{error || "This knowledge base doesn't exist."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.branding.logo_url ? (
              <img src={tenant.branding.logo_url} alt={companyName} className="h-8 w-auto" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: brandColor }}
              >
                {companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-white text-lg leading-tight">{companyName}</h1>
              <p className="text-xs text-gray-500">Help Center</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div
        className="relative py-16 sm:py-24"
        style={{
          background: `linear-gradient(135deg, ${brandColor}15 0%, transparent 50%, ${brandColor}08 100%)`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            How can we help?
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Search our knowledge base or browse by category
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all text-base"
            />
          </form>

          <p className="text-sm text-gray-500 mt-4">
            {totalDocs} article{totalDocs !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Search results or category documents */}
        {(selectedCategory || searchQuery || documents) ? (
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-8">
              <button
                onClick={handleBackToCategories}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All Categories
              </button>
              {selectedCategory && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-white font-medium">{selectedCategory.name}</span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({selectedCategory.document_count} article{selectedCategory.document_count !== 1 ? 's' : ''})
                  </span>
                </>
              )}
              {searchQuery && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-400">
                    Results for &ldquo;<span className="text-white">{searchQuery}</span>&rdquo;
                  </span>
                </>
              )}
            </div>

            {docsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : documents && documents.documents.length > 0 ? (
              <div className="space-y-3">
                {documents.documents.map((doc) => {
                  const authorName = (doc as any).users?.full_name || "Unknown";
                  const readTime = estimateReadTime(doc.content || "");
                  const snippet = stripHtml(doc.content || "").slice(0, 180);

                  return (
                    <Link
                      key={doc.id}
                      href={`/kb/${subdomain}/${doc.id}`}
                      className="block p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white group-hover:text-[var(--brand)] transition-colors mb-1.5">
                            {doc.title}
                          </h3>
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                            {snippet || "No description"}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {authorName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {readTime} min read
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {doc.view_count || 0} views
                            </span>
                            {doc.published_at && (
                              <span>{formatDate(doc.published_at)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-[var(--brand)] transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No articles found</p>
              </div>
            )}
          </div>
        ) : (
          /* Category cards grid */
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-semibold text-white">Browse by Category</h3>
              <button
                onClick={handleViewAll}
                className="text-sm font-medium hover:underline transition-colors"
                style={{ color: brandColor }}
              >
                View all articles
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  className="text-left p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      <FolderOpen className="w-5 h-5" style={{ color: category.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white group-hover:text-[var(--brand)] transition-colors mb-1">
                        {category.name}
                      </h4>
                      {category.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{category.description}</p>
                      )}
                      <p className="text-xs text-gray-600">
                        {category.document_count} article{category.document_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-[var(--brand)] transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} {companyName}
          </p>
          <p className="text-xs text-gray-700">
            Powered by <span className="text-gray-500">TyneBase</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

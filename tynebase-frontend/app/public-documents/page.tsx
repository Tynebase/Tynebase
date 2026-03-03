"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  FileText,
  Eye,
  Clock,
  User,
  Loader2,
  FolderOpen,
  Filter,
  X,
  Tag,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { listPublicDocuments, Document } from "@/lib/api/documents";

interface FilterOptions {
  tenants: Array<{ id: string; name: string; subdomain: string }>;
  categories: Array<{ id: string; name: string; color: string }>;
  tags: Array<{ id: string; name: string; description: string | null }>;
}

type PublicDocument = Document & {
  tags?: Array<{ id: string; name: string; description: string | null }>;
  tenants?: { id: string; name: string; subdomain: string };
};

const stripMarkdown = (text: string): string => {
  return text
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s/gm, "")
    .replace(/^\d+\.\s/gm, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
};

function PublicDocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ tenants: [], categories: [], tags: [] });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filter state from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedTenant, setSelectedTenant] = useState(searchParams.get("tenant") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listPublicDocuments({
        page: currentPage,
        limit: 18,
        tenant_id: selectedTenant || undefined,
        category_id: selectedCategory || undefined,
        tag_id: selectedTag || undefined,
        search: searchQuery || undefined,
      });
      setDocuments(response.documents);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
      setFilters(response.filters);
    } catch (err) {
      console.error("Failed to fetch public documents:", err);
      setError("Failed to load documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedTenant, selectedCategory, selectedTag, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams();
      const merged = {
        search: searchQuery,
        tenant: selectedTenant,
        category: selectedCategory,
        tag: selectedTag,
        page: String(currentPage),
        ...params,
      };
      Object.entries(merged).forEach(([key, value]) => {
        if (value && value !== "1" && key === "page") newParams.set(key, value);
        else if (value && key !== "page") newParams.set(key, value);
      });
      const qs = newParams.toString();
      router.replace(`/public-documents${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchQuery, selectedTenant, selectedCategory, selectedTag, currentPage]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    updateUrl({ search: searchInput, page: "1" });
  };

  const handleFilterChange = (type: "tenant" | "category" | "tag", value: string) => {
    const setters: Record<string, (v: string) => void> = {
      tenant: setSelectedTenant,
      category: setSelectedCategory,
      tag: setSelectedTag,
    };
    setters[type](value);
    updateUrl({ [type]: value, page: "1" });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSearchInput("");
    setSelectedTenant("");
    setSelectedCategory("");
    setSelectedTag("");
    router.replace("/public-documents", { scroll: false });
  };

  const hasActiveFilters = searchQuery || selectedTenant || selectedCategory || selectedTag;

  const goToPage = (page: number) => {
    updateUrl({ page: String(page) });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      {/* Hero Section */}
      <section style={{ paddingTop: "140px", paddingBottom: "48px" }}>
        <div className="container">
          <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Globe className="w-7 h-7 text-white" />
              </div>
            </div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--brand)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "16px",
              }}
            >
              Community Knowledge
            </p>
            <h1
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                marginBottom: "16px",
                lineHeight: 1.15,
              }}
            >
              Public Documents
            </h1>
            <p
              style={{
                fontSize: "18px",
                color: "var(--text-secondary)",
                marginBottom: "32px",
                lineHeight: 1.6,
              }}
            >
              Browse knowledge shared by teams across TyneBase. Discover guides, documentation, and resources published by the community.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} style={{ maxWidth: "600px", margin: "0 auto", position: "relative" }}>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: "20px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "20px",
                    height: "20px",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search public documents..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "16px 120px 16px 56px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "8px 20px",
                    background: "var(--brand)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Filters + Content */}
      <section style={{ paddingTop: "0", paddingBottom: "80px" }}>
        <div className="container" style={{ maxWidth: "1200px" }}>
          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
              marginBottom: "32px",
            }}
          >
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--brand)",
                  }}
                />
              )}
            </button>

            {/* Active filter pills */}
            {selectedTenant && (
              <FilterPill
                label={filters.tenants.find((t) => t.id === selectedTenant)?.name || "Workspace"}
                icon={<Building2 className="w-3 h-3" />}
                onClear={() => handleFilterChange("tenant", "")}
              />
            )}
            {selectedCategory && (
              <FilterPill
                label={filters.categories.find((c) => c.id === selectedCategory)?.name || "Category"}
                color={filters.categories.find((c) => c.id === selectedCategory)?.color}
                onClear={() => handleFilterChange("category", "")}
              />
            )}
            {selectedTag && (
              <FilterPill
                label={filters.tags.find((t) => t.id === selectedTag)?.name || "Tag"}
                icon={<Tag className="w-3 h-3" />}
                onClear={() => handleFilterChange("tag", "")}
              />
            )}
            {searchQuery && (
              <FilterPill
                label={`"${searchQuery}"`}
                icon={<Search className="w-3 h-3" />}
                onClear={() => {
                  setSearchQuery("");
                  setSearchInput("");
                  updateUrl({ search: "", page: "1" });
                }}
              />
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Clear all
              </button>
            )}

            <div style={{ marginLeft: "auto", fontSize: "14px", color: "var(--text-muted)" }}>
              {pagination.total} document{pagination.total !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "32px",
                padding: "24px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
              }}
            >
              {/* Workspace Filter */}
              {filters.tenants.length > 0 && (
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Workspace
                  </label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => handleFilterChange("tenant", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">All Workspaces</option>
                    {filters.tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Filter */}
              {filters.categories.length > 0 && (
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleFilterChange("category", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">All Categories</option>
                    {filters.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag Filter */}
              {filters.tags.length > 0 && (
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Tag
                  </label>
                  <select
                    value={selectedTag}
                    onChange={(e) => handleFilterChange("tag", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">All Tags</option>
                    {filters.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Documents Grid */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand)" }} />
              <span style={{ marginLeft: "12px", color: "var(--text-secondary)" }}>Loading documents...</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>{error}</p>
              <button onClick={fetchDocuments} className="btn btn-primary">
                Try Again
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <FolderOpen
                style={{ width: "48px", height: "48px", color: "var(--text-muted)", margin: "0 auto 16px" }}
              />
              <h3
                style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}
              >
                No documents found
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
                {hasActiveFilters
                  ? "Try adjusting your filters or search query."
                  : "No public documents have been published yet."}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="btn btn-secondary">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: "20px",
                }}
              >
                {documents.map((doc) => {
                  const authorName = (doc as any).users?.full_name || "Unknown Author";
                  const categoryName = (doc as any).categories?.name;
                  const categoryColor = (doc as any).categories?.color || "#6b7280";
                  const tenantName = doc.tenants?.name;
                  const docTags = doc.tags || [];

                  return (
                    <Link
                      key={doc.id}
                      href={`/docs/${doc.id}`}
                      style={{
                        display: "block",
                        padding: "24px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "16px",
                        transition: "all 0.2s ease",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.12)";
                        e.currentTarget.style.borderColor = "var(--brand)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            background: "var(--brand-primary-muted, rgba(59,130,246,0.1))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileText className="w-5 h-5" style={{ color: "var(--brand)" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              marginBottom: "4px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {doc.title}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {tenantName && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Building2 className="w-3 h-3" />
                                {tenantName}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <User className="w-3 h-3" />
                              {authorName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          marginBottom: "16px",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {doc.content ? stripMarkdown(doc.content).slice(0, 200) : "No content preview available"}
                      </p>

                      {/* Tags + Category */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                        {categoryName && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 500,
                              backgroundColor: `${categoryColor}20`,
                              color: categoryColor,
                            }}
                          >
                            {categoryName}
                          </span>
                        )}
                        {docTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              background: "var(--bg-secondary)",
                              color: "var(--text-muted)",
                            }}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      {/* Footer */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock className="w-3 h-3" />
                          {formatDate(doc.created_at)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Eye className="w-3 h-3" />
                          {doc.view_count || 0} views
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    marginTop: "48px",
                  }}
                >
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="btn btn-ghost"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      opacity: currentPage <= 1 ? 0.5 : 1,
                      cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    Page {currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className="btn btn-ghost"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      opacity: currentPage >= pagination.totalPages ? 0.5 : 1,
                      cursor: currentPage >= pagination.totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FilterPill({
  label,
  icon,
  color,
  onClear,
}: {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  onClear: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        background: color ? `${color}15` : "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "8px",
        fontSize: "13px",
        color: color || "var(--text-secondary)",
      }}
    >
      {icon}
      {label}
      <button
        onClick={(e) => {
          e.preventDefault();
          onClear();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "var(--bg-tertiary)",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          marginLeft: "2px",
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function PublicDocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--brand)" }} />
        </div>
      }
    >
      <PublicDocumentsContent />
    </Suspense>
  );
}

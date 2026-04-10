"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Tag, Filter, ChevronLeft, ChevronRight, FileText, Clock, User, Loader2, X } from "lucide-react";
import { listPublicDocuments } from "@/lib/api/documents";

interface TenantBranding {
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  company_name?: string;
}

interface TenantInfo {
  id: string;
  subdomain: string;
  name: string;
  custom_domain?: string;
  custom_domain_verified?: boolean;
  branding: TenantBranding;
}

function PortalContent() {
  const searchParams = useSearchParams();
  // Use domain from search params (set by middleware) or fallback to current hostname
  const domain = searchParams.get("domain") || (typeof window !== 'undefined' ? window.location.hostname : null);

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");

  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // Fetch tenant info by domain
  useEffect(() => {
    if (!domain) {
      setTenantError("No domain specified");
      setTenantLoading(false);
      return;
    }

    async function fetchTenant() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/public/tenant-by-domain?domain=${encodeURIComponent(domain!)}`);
        if (!res.ok) {
          setTenantError("Workspace not found for this domain");
          setTenantLoading(false);
          return;
        }
        const data = await res.json();
        setTenant(data.data?.tenant || null);
      } catch {
        setTenantError("Failed to load workspace");
      } finally {
        setTenantLoading(false);
      }
    }
    fetchTenant();
  }, [domain]);

  // Apply tenant branding CSS
  useEffect(() => {
    if (tenant?.branding?.primary_color) {
      document.documentElement.style.setProperty("--brand", tenant.branding.primary_color);
      document.documentElement.style.setProperty("--brand-primary", tenant.branding.primary_color);
    }
    return () => {
      document.documentElement.style.removeProperty("--brand");
      document.documentElement.style.removeProperty("--brand-primary");
    };
  }, [tenant]);

  // Fetch documents filtered by tenant
  const fetchDocuments = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listPublicDocuments({
        page,
        limit: 12,
        tenant_id: tenant.id,
        category_id: categoryId || undefined,
        tag_id: tagId || undefined,
        search: search || undefined,
      });
      setDocuments(result.documents || []);
      setTotalPages(result.pagination?.totalPages || 1);
      if (result.filters) {
        setCategories(result.filters.categories || []);
        setTags(result.filters.tags || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [tenant, page, categoryId, tagId, search]);

  useEffect(() => {
    if (tenant) fetchDocuments();
  }, [fetchDocuments, tenant]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const primaryColor = tenant?.branding?.primary_color || "#E85002";
  const companyName = tenant?.branding?.company_name || tenant?.name || "Documentation";

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f", color: "#fff" }}>
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Not Found</h1>
          <p className="opacity-60">{tenantError || "This domain is not configured."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f", color: "#e5e5e5" }}>
      {/* Branded Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,10,15,0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {tenant.branding.logo_url ? (
              <img src={tenant.branding.logo_url} alt={companyName} style={{ height: "32px", width: "auto" }} />
            ) : (
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: primaryColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {companyName.charAt(0)}
              </div>
            )}
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>{companyName}</span>
          </div>
          <span style={{ fontSize: "13px", opacity: 0.5 }}>Documentation</span>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "60px 24px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "#fff", marginBottom: "12px" }}>
          {companyName} Documentation
        </h1>
        <p style={{ fontSize: "17px", opacity: 0.6, maxWidth: "600px", margin: "0 auto 32px" }}>
          Browse our published documentation and resources
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ maxWidth: "520px", margin: "0 auto", position: "relative" }}>
          <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "18px", height: "18px", opacity: 0.4 }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search documentation..."
            style={{
              width: "100%",
              padding: "14px 16px 14px 44px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "15px",
              outline: "none",
            }}
          />
        </form>
      </section>

      {/* Filters */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          {categories.length > 0 && (
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
              style={{
                padding: "8px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#e5e5e5",
                fontSize: "14px",
              }}
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {tags.length > 0 && (
            <select
              value={tagId}
              onChange={(e) => { setTagId(e.target.value); setPage(1); }}
              style={{
                padding: "8px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#e5e5e5",
                fontSize: "14px",
              }}
            >
              <option value="">All Tags</option>
              {tags.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {(search || categoryId || tagId) && (
            <button
              onClick={() => { setSearch(""); setSearchInput(""); setCategoryId(""); setTagId(""); setPage(1); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "8px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#e5e5e5",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <X style={{ width: "14px", height: "14px" }} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Documents Grid */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", margin: "0 auto", color: primaryColor }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 0", opacity: 0.5 }}>{error}</div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <FileText style={{ width: "48px", height: "48px", margin: "0 auto 16px", opacity: 0.2 }} />
            <p style={{ opacity: 0.5 }}>No documents found</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
              {documents.map((doc: any) => (
                <Link
                  key={doc.id}
                  href={`/docs/${doc.id}`}
                  style={{
                    display: "block",
                    padding: "24px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "14px",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = primaryColor + "40";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>
                    {doc.title}
                  </h3>
                  {doc.content && (
                    <p style={{ fontSize: "14px", opacity: 0.5, lineHeight: 1.5, marginBottom: "16px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {doc.content.replace(/[#*`>\-\[\]()]/g, "").substring(0, 200)}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", opacity: 0.4 }}>
                    {doc.users?.full_name && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <User style={{ width: "13px", height: "13px" }} />
                        {doc.users.full_name}
                      </span>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock style={{ width: "13px", height: "13px" }} />
                      {new Date(doc.published_at || doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
                      {doc.tags.map((tag: any) => (
                        <span
                          key={tag.id}
                          style={{
                            padding: "2px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            background: primaryColor + "18",
                            color: primaryColor,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "40px" }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e5e5e5",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.3 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <ChevronLeft style={{ width: "16px", height: "16px" }} /> Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", fontSize: "14px", opacity: 0.5 }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e5e5e5",
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.3 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Next <ChevronRight style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", opacity: 0.3 }}>
          Powered by <a href="https://tynebase.com" style={{ color: primaryColor, textDecoration: "none" }}>TyneBase</a>
        </p>
      </footer>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
      </div>
    }>
      <PortalContent />
    </Suspense>
  );
}

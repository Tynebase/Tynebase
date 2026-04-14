"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, BookOpen, Zap, Shield, ArrowRight, Code, Bot, FileText, Lock, BarChart3, FolderSync, Globe, Video, FileCheck, FolderOpen, ChevronRight, Eye, Clock, User, Users, Loader2, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DocModal } from "@/components/docs/DocModal";
import { CategoryModal } from "@/components/docs/CategoryModal";
import { categories, searchDocs, allArticles, type DocArticle } from "@/lib/docs";
import { getKBLanding, getKBDocuments, estimateReadTime } from "@/lib/api/kb";
import type { KBTenant, KBCategory, KBDocumentsData } from "@/lib/api/kb";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  BookOpen,
  Bot,
  Shield,
  Code,
  Users,
};

const aiFeatures = [
  { 
    icon: Video, 
    title: "From Video", 
    description: "Upload YouTube links or video files. AI extracts key information and generates structured documentation automatically."
  },
  { 
    icon: FileText, 
    title: "From Prompt", 
    description: "Describe what you need in natural language. AI creates comprehensive articles, guides and runbooks."
  },
  { 
    icon: Search, 
    title: "AI Search (RAG)", 
    description: "Ask questions in plain English. Semantic search finds answers across your entire knowledge base with cited sources."
  },
];

const enterpriseFeatures = [
  { icon: Lock, title: "SSO/SAML Integration", description: "Okta, Azure AD and Google Workspace" },
  { icon: Shield, title: "SOC 2 Type II", description: "Enterprise-grade compliance" },
  { icon: Globe, title: "GDPR Compliant", description: "EU data residency options" },
  { icon: BarChart3, title: "Analytics Dashboard", description: "Usage insights and adoption metrics" },
  { icon: FileCheck, title: "Content Audit", description: "Document health and verification" },
  { icon: FolderSync, title: "Automated Backups", description: "Data protection and recovery" },
];

const apiDocs = [
  { icon: Code, title: "REST API Reference", description: "Complete API documentation with examples and SDKs", slug: "api-overview" },
  { icon: Globe, title: "Webhooks", description: "Real-time event notifications for document changes", slug: "webhooks" },
  { icon: FileText, title: "Local Development", description: "Set up local environment for API integration", slug: "local-development" },
];

function stripHtmlForSnippet(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatKBDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  const parts = hostname.split('.');
  const baseParts = baseDomain.split('.');
  if (parts.length <= baseParts.length) return null;
  const sub = parts.slice(0, parts.length - baseParts.length).join('.');
  if (!sub || sub === 'www') return null;
  return sub;
}

/** Tenant KB page — rendered when visiting companyname.tynebase.com/docs */
function TenantKBPage({ subdomain }: { subdomain: string }) {
  const [tenant, setTenant] = useState<KBTenant | null>(null);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KBCategory | null>(null);
  const [documents, setDocuments] = useState<KBDocumentsData | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const fetchKB = async () => {
      try {
        setLoading(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
        const [kbData, tagsRes] = await Promise.all([
          getKBLanding(subdomain),
          fetch(`${API_BASE}/api/public/community/${subdomain}/tags?limit=12`),
        ]);
        setTenant(kbData.tenant);
        setCategories(kbData.categories);
        setTotalDocs(kbData.totalDocuments);
        if (kbData.tenant.branding.primary_color) {
          document.documentElement.style.setProperty("--brand", kbData.tenant.branding.primary_color);
        }
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setTags(tagsData.data?.tags || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Knowledge base not found");
      } finally {
        setLoading(false);
      }
    };
    fetchKB();
  }, [subdomain]);

  const fetchDocuments = useCallback(async (categoryId?: string, search?: string) => {
    try {
      setDocsLoading(true);
      const data = await getKBDocuments(subdomain, { category_id: categoryId, search: search || undefined, limit: 50 });
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [subdomain]);

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

  const brandColor = tenant?.branding.primary_color || "var(--brand)";
  const companyName = tenant?.branding.company_name || tenant?.name || "Knowledge Base";
  const kbEyebrow = (tenant?.branding as any)?.kb_eyebrow || "Help Center";
  const kbHeading = (tenant?.branding as any)?.kb_heading || "How can we help?";
  const kbSubheading = (tenant?.branding as any)?.kb_subheading || "Search our knowledge base or browse by category";

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        <SiteNavbar currentPage="docs" />
        <div style={{ paddingTop: '200px', textAlign: 'center' }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        <SiteNavbar currentPage="docs" />
        <div style={{ paddingTop: '200px', textAlign: 'center', maxWidth: '500px', margin: '0 auto', padding: '0 20px' }}>
          <AlertCircle className="w-12 h-12 mx-auto" style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Not Found</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{error || "This knowledge base doesn't exist."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      {/* Custom header with tenant branding */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {tenant.branding.logo_url ? (
                <img src={tenant.branding.logo_url} alt={companyName} style={{ height: '32px', width: 'auto' }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', background: brandColor }}>
                  {companyName.charAt(0)}
                </div>
              )}
              <div>
                <h1 style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{companyName}</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{kbEyebrow}</p>
              </div>
            </div>
            <Link href="/community" style={{ fontSize: '14px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
              Community →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero - same style as /docs */}
      <section style={{ paddingTop: '80px', paddingBottom: '60px' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: brandColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
              {kbEyebrow}
            </p>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '24px', lineHeight: 1.1 }}>
              {kbHeading}
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '48px', lineHeight: 1.6 }}>
              {kbSubheading}
            </p>

            {/* Search - same style as /docs */}
            <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
              <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '18px 20px 18px 56px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                />
              </form>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
              {totalDocs} article{totalDocs !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section style={{ paddingTop: '8px', paddingBottom: '80px' }}>
        <div className="container">
          {(selectedCategory || searchQuery || documents) ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
                <button
                  onClick={handleBackToCategories}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ← All Categories
                </button>
                {selectedCategory && (
                  <>
                    <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{selectedCategory.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>({selectedCategory.document_count})</span>
                  </>
                )}
                {searchQuery && (
                  <>
                    <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Results for &ldquo;<span style={{ color: 'var(--text-primary)' }}>{searchQuery}</span>&rdquo;</span>
                  </>
                )}
              </div>

              {docsLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : documents && documents.documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {documents.documents.map((doc) => {
                    const authorName = (doc as any).users?.full_name || "Unknown";
                    const readTime = estimateReadTime(doc.content || "");
                    const snippet = stripHtmlForSnippet(doc.content || "").slice(0, 180);
                    const updatedDate = doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

                    return (
                      <Link
                        key={doc.id}
                        href={`/docs/${doc.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '20px 24px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '12px',
                          transition: 'all 0.2s ease',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = brandColor;
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: 0 }}>
                          <FileText style={{ width: '20px', height: '20px', color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {doc.title}
                            </h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {snippet || 'No description'}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User style={{ width: '11px', height: '11px' }} />{authorName}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock style={{ width: '11px', height: '11px' }} />{readTime} min read</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Eye style={{ width: '11px', height: '11px' }} />{doc.view_count || 0} views</span>
                              {updatedDate && <span>Updated {updatedDate}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight style={{ width: '16px', height: '16px', color: 'var(--text-muted)', flexShrink: 0 }} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <FileText style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>No articles found</p>
                </div>
              )}
            </div>
          ) : (
            /* Category cards - Match help page design */
            <div>
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  Browse by category
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                  Find the article you need, organised by topic.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ maxWidth: '1024px', margin: '0 auto' }}>
                {categories.map((category) => {
                  const Icon = category.icon && iconMap[category.icon] ? iconMap[category.icon] : FolderOpen;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category)}
                      className="bento-item cursor-pointer group block"
                      style={{ padding: '24px', display: 'flex', flexDirection: 'column', cursor: 'pointer', border: 'none', background: 'var(--bg-elevated)', textAlign: 'left', width: '100%' }}
                    >
                      <div className="feature-icon feature-icon-brand mb-4" style={{ color: category.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{category.description || "Articles in this category"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{category.document_count} article{category.document_count !== 1 ? 's' : ''}</p>
                    </button>
                  );
                })}
              </div>

              {/* View all link */}
              <div style={{ textAlign: 'center', marginTop: '48px' }}>
                <button
                  onClick={handleViewAll}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 500, color: brandColor, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  View all articles
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>


      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '32px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} {companyName}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Powered by <span style={{ color: 'var(--text-secondary)' }}>TyneBase</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function DocsPage() {
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSubdomain(getSubdomainFromHost());
    setChecked(true);
  }, []);

  // If on a tenant subdomain, show their KB
  if (!checked) return null;
  if (subdomain) return <TenantKBPage subdomain={subdomain} />;

  // Otherwise, show TyneBase's own documentation
  return <TyneBaseDocsPage />;
}

function renderMarkdown(content: string): string {
  const blocks: string[] = [];

  // Protect fenced code blocks
  let md = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idx = blocks.length;
    blocks.push(`<pre style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:8px;padding:16px 20px;overflow-x:auto;margin:16px 0;"><code style="font-family:monospace;font-size:13px;color:var(--text-primary);white-space:pre;">${escaped}</code></pre>`);
    return `\x02${idx}\x03`;
  });

  // Convert markdown tables to HTML
  md = md.replace(/((?:^\|[^\n]*(?:\n|$))+)/gm, (block) => {
    const lines = block.trim().split('\n').filter(Boolean);
    const isSep = (l: string) => /^\|[\s|:=-]+\|$/.test(l.trim());
    const nonSep = lines.filter(l => !isSep(l));
    if (nonSep.length < 2) return block;
    const parse = (l: string) => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const cellInner = (t: string) => t
      .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600;color:var(--text-primary);">$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary);padding:1px 5px;border-radius:3px;font-size:12px;font-family:monospace;color:var(--text-primary);">$1</code>');
    const [header, ...rows] = nonSep;
    const ths = parse(header).map(h =>
      `<th style="padding:10px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-primary);background:var(--bg-secondary);border-bottom:2px solid var(--border-subtle);white-space:nowrap;">${cellInner(h)}</th>`
    ).join('');
    const trs = rows.map(r =>
      `<tr>${parse(r).map(c =>
        `<td style="padding:10px 16px;font-size:13px;color:var(--text-secondary);border-bottom:1px solid var(--border-subtle);">${cellInner(c)}</td>`
      ).join('')}</tr>`
    ).join('');
    const idx = blocks.length;
    blocks.push(`<div style="overflow-x:auto;margin:20px 0;border-radius:8px;border:1px solid var(--border-subtle);"><table style="width:100%;border-collapse:collapse;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`);
    return `\x02${idx}\x03`;
  });

  // Protect image blocks before paragraph transform
  // Supports optional max-width via pipe in alt: ![caption|240px](url)
  md = md.replace(/^!\[([^\]]*)\]\(([^)]+)\)$/gm, (_, alt, src) => {
    let displayAlt = alt;
    let maxWidth = '100%';
    const pipeIdx = alt.indexOf('|');
    if (pipeIdx !== -1) {
      displayAlt = alt.slice(0, pipeIdx).trim();
      maxWidth = alt.slice(pipeIdx + 1).trim();
    }
    const idx = blocks.length;
    blocks.push(`<figure style="margin:24px 0;"><img src="${src}" alt="${displayAlt}" style="width:100%;max-width:${maxWidth};border-radius:10px;border:1px solid var(--border-subtle);display:block;" />${displayAlt ? `<figcaption style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;">${displayAlt}</figcaption>` : ''}</figure>`);
    return `\x02${idx}\x03`;
  });

  // Apply remaining inline/block transforms
  md = md
    .replace(/^### (.+)$/gm, '<h3 id="$1" style="font-size:17px;font-weight:600;color:var(--text-primary);margin:28px 0 12px;letter-spacing:-0.01em;">$1</h3>')
    .replace(/^## (.+)$/gm, (_, t) => `<h2 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}" style="font-size:22px;font-weight:600;color:var(--text-primary);margin:40px 0 16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">${t}</h2>`)
    .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:700;color:var(--text-primary);margin:40px 0 20px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600;color:var(--text-primary);">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace;">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;padding-left:4px;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, match => `<ul style="margin:12px 0 20px 20px;list-style:disc;">${match}</ul>`)
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--brand);padding:12px 16px;margin:16px 0;background:var(--bg-secondary);border-radius:0 8px 8px 0;font-style:italic;color:var(--text-secondary);">$1</blockquote>')
    .replace(/\n{2,}/g, '</p><p style="margin-bottom:16px;">')
    .replace(/^(?!\x02)(?!<[hublop])(.+)$/gm, '<p style="margin-bottom:16px;color:var(--text-secondary);">$1</p>');

  // Restore protected blocks
  md = md.replace(/\x02(\d+)\x03/g, (_, i) => blocks[+i] ?? '');
  return md;
}

function extractHeadings(content: string) {
  const lines = content.split('\n');
  const headings: { id: string; text: string; level: number }[] = [];
  lines.forEach(line => {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      headings.push({ id, text, level: match[1].length });
    }
  });
  return headings;
}

function TyneBaseDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DocArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<DocArticle | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeHeading, setActiveHeading] = useState("");
  const router = useRouter();

  const headings = selectedArticle ? extractHeadings(selectedArticle.content) : [];

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 2) {
      setIsSearching(true);
      const results = searchDocs(query);
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, []);

  const openArticle = (article: DocArticle) => {
    setSelectedArticle(article);
    setIsSearching(false);
    setSearchQuery("");
    setMobileSidebar(false);
    setActiveHeading("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.replaceState(null, '', `/docs?slug=${article.slug}`);
  };

  const goHome = () => {
    setSelectedArticle(null);
    setIsSearching(false);
    setSearchQuery("");
    setActiveHeading("");
    router.replace('/help');
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Expand the category of the selected article
  useEffect(() => {
    if (selectedArticle) {
      const cat = categories.find(c => c.articles.some(a => a.id === selectedArticle.id));
      if (cat) setExpandedCategories(prev => ({ ...prev, [cat.id]: true }));
    }
  }, [selectedArticle]);

  // On mount: open article from ?slug= param, sessionStorage tutorial flag, or default first article
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug');

    const shouldOpenTutorial = sessionStorage.getItem("tynebase_open_tutorial");
    if (shouldOpenTutorial) sessionStorage.removeItem("tynebase_open_tutorial");

    const targetSlug = slugParam || (shouldOpenTutorial ? 'getting-started-tutorial' : null);
    const article = targetSlug
      ? allArticles.find(a => a.slug === targetSlug) ?? allArticles[0]
      : allArticles[0];

    if (article) {
      setSelectedArticle(article);
      const cat = categories.find(c => c.articles.some(a => a.id === article.id));
      if (cat) setExpandedCategories(prev => ({ ...prev, [cat.id]: true }));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('doc-search')?.focus();
      }
      if (e.key === 'Escape' && selectedArticle) {
        goHome();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedArticle]);

  // Find prev/next articles
  const currentIndex = selectedArticle ? allArticles.findIndex(a => a.id === selectedArticle.id) : -1;
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextArticle = currentIndex >= 0 && currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  // ======================== ARTICLE VIEW ========================
  if (selectedArticle) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        <SiteNavbar currentPage="docs" />

        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', paddingTop: '80px' }}>
          {/* Left Sidebar - Navigation */}
          <aside
            className="hidden lg:block"
            style={{
              width: '280px',
              flexShrink: 0,
              position: 'sticky',
              top: '80px',
              height: 'calc(100vh - 80px)',
              overflowY: 'auto',
              padding: '24px 16px 24px 24px',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={goHome}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
            >
              <ArrowRight style={{ width: '14px', height: '14px', transform: 'rotate(180deg)' }} />
              All Documentation
            </button>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-muted)' }} />
              <input
                id="doc-search"
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              {isSearching && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: '300px', overflowY: 'auto',
                }}>
                  {searchResults.length > 0 ? searchResults.map(a => (
                    <button key={a.id} onClick={() => openArticle(a)}
                      style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{a.category}</div>
                    </button>
                  )) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results</div>
                  )}
                </div>
              )}
            </div>

            {/* Category Tree */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {categories.map(cat => {
                const isExpanded = expandedCategories[cat.id] ?? false;
                const IconComponent = iconMap[cat.icon] || Zap;
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                        padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                        borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                        color: 'var(--text-primary)', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-muted)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                      <IconComponent className="w-4 h-4 text-[var(--brand)]" />
                      {cat.title}
                      {cat.id === 'api-reference' && (
                        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.04em', flexShrink: 0 }}>SOON</span>
                      )}
                    </button>
                    {isExpanded && (
                      <div style={{ paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {cat.articles.map(article => (
                          <button
                            key={article.id}
                            onClick={() => openArticle(article)}
                            style={{
                              display: 'block', width: '100%', padding: '6px 10px',
                              background: selectedArticle?.id === article.id ? 'var(--bg-secondary)' : 'transparent',
                              border: 'none', borderRadius: '6px', textAlign: 'left', cursor: 'pointer',
                              fontSize: '13px', color: selectedArticle?.id === article.id ? 'var(--brand)' : 'var(--text-secondary)',
                              fontWeight: selectedArticle?.id === article.id ? 500 : 400,
                              transition: 'all 0.15s',
                              borderLeft: selectedArticle?.id === article.id ? '2px solid var(--brand)' : '2px solid transparent',
                            }}
                            onMouseEnter={e => { if (selectedArticle?.id !== article.id) e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { if (selectedArticle?.id !== article.id) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          >
                            {article.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main style={{ flex: 1, minWidth: 0, padding: '24px 32px 80px 48px', maxWidth: '820px' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button onClick={goHome} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--brand)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >Docs</button>
              <ChevronRight style={{ width: '12px', height: '12px' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{selectedArticle.category}</span>
              <ChevronRight style={{ width: '12px', height: '12px' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedArticle.title}</span>
            </div>

            {/* Article Header */}
            <div style={{ marginBottom: '32px' }}>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
                fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--brand)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px',
              }}>
                {selectedArticle.category}
              </span>
              <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '12px' }}>
                {selectedArticle.title}
              </h1>
              <p style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                {selectedArticle.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock style={{ width: '14px', height: '14px' }} /> {selectedArticle.readTime}
                </span>
                <span>Updated {selectedArticle.lastUpdated}</span>
              </div>
              {selectedArticle.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {selectedArticle.tags.map(tag => (
                    <span key={tag} style={{ padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Article Content (Markdown) */}
            <div className="docs-prose" style={{ lineHeight: 1.8, color: 'var(--text-primary)' }}>
              <div
                style={{ fontSize: '15px' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArticle.content) }}
              />
            </div>

            {/* Prev / Next Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--border-subtle)' }}>
              {prevArticle ? (
                <button
                  onClick={() => openArticle(prevArticle)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>← Previous</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{prevArticle.title}</span>
                </button>
              ) : <div />}
              {nextArticle ? (
                <button
                  onClick={() => openArticle(nextArticle)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer', textAlign: 'right', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Next →</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{nextArticle.title}</span>
                </button>
              ) : <div />}
            </div>
          </main>

          {/* Right Sidebar - Table of Contents */}
          {headings.length > 0 && (
            <aside
              className="hidden xl:block"
              style={{
                width: '220px', flexShrink: 0, position: 'sticky', top: '80px',
                height: 'calc(100vh - 80px)', overflowY: 'auto', padding: '24px 24px 24px 16px',
              }}
            >
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                On this page
              </p>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {headings.map(h => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setActiveHeading(h.id);
                    }}
                    style={{
                      fontSize: '12px', color: activeHeading === h.id ? 'var(--brand)' : 'var(--text-muted)',
                      textDecoration: 'none', padding: '3px 0',
                      borderLeft: activeHeading === h.id ? '2px solid var(--brand)' : '2px solid transparent',
                      paddingLeft: h.level === 3 ? '16px' : '8px',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { if (activeHeading !== h.id) (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { if (activeHeading !== h.id) (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </aside>
          )}
        </div>

        <SiteFooter currentPage="docs" />
      </div>
    );
  }

  // ======================== HOME VIEW ========================
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <SiteNavbar currentPage="docs" />

      {/* Hero Section */}
      <section style={{ paddingTop: '160px', paddingBottom: '80px' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <Image
                src="/docs_logo1.webp"
                alt="Documentation"
                width={60}
                height={60}
                style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
              Documentation
            </p>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '24px', lineHeight: 1.1 }}>
              Discover TyneBase
            </h1>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '48px', lineHeight: 1.6 }}>
              Everything you need to build, manage and scale your knowledge base.
              From quick start guides to advanced AI features and enterprise security.
            </p>

            {/* Search Box */}
            <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: 'var(--text-muted)' }} />
                <input
                  id="doc-search"
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '18px 100px 18px 56px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)', borderRadius: '12px',
                    color: 'var(--text-primary)', fontSize: '16px', outline: 'none',
                  }}
                />
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <kbd style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>⌘</kbd>
                  <kbd style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>K</kbd>
                </div>
              </div>

              {isSearching && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 50,
                  maxHeight: '400px', overflowY: 'auto',
                }}>
                  {searchResults.length > 0 ? (
                    <div style={{ padding: '8px' }}>
                      {searchResults.map((article) => (
                        <button key={article.id} onClick={() => openArticle(article)}
                          style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{article.title}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{article.category} · {article.readTime} read</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No results found for &ldquo;{searchQuery}&rdquo;</div>
                  )}
                </div>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
              {allArticles.length} articles across {categories.length} categories
            </p>
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Browse by category</h2>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>Find the documentation you need, organised by topic.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto' }}>
            {categories.map((category) => {
              const IconComponent = iconMap[category.icon] || Zap;
              return (
                <div
                  key={category.id}
                  className="bento-item"
                  style={{ padding: '32px', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', textAlign: 'left', width: '100%', position: 'relative' }}
                >
                  {category.id === 'api-reference' && (
                    <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Coming soon</span>
                  )}
                  <div className={`feature-icon feature-icon-${category.color}`} style={{ marginBottom: '20px' }}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{category.title}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>{category.description}</p>
                  <div style={{ marginTop: 'auto' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>{category.articles.length} articles</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {category.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => openArticle(article)}
                          style={{ background: 'transparent', padding: '8px 12px', borderRadius: '6px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', border: 'none', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '8px' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--brand)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                          <FileText style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                          {article.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Features Highlight */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>AI-Powered</p>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Generate Documentation with AI</h2>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              TyneBase uses advanced AI models with EU-compliant data processing to help you create and find knowledge faster.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            {aiFeatures.map((feature) => (
              <div key={feature.title}
                style={{ padding: '32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => { const a = allArticles.find(a => a.title.toLowerCase().includes(feature.title.toLowerCase().replace('(rag)', '').trim())); if (a) openArticle(a); }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="feature-icon feature-icon-purple" style={{ marginBottom: '20px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{feature.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container">
          <div style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ position: 'absolute', inset: '-16px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple), var(--accent-pink))', opacity: 0.15, filter: 'blur(40px)', borderRadius: '24px' }} />
            <div style={{ position: 'relative', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '48px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Can&apos;t find what you need?</h2>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '32px' }}>Our support team is here to help you succeed.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <Link href="/contact" className="btn btn-primary">Contact Support<ArrowRight className="w-4 h-4" /></Link>
                <Link href="/community" className="btn btn-secondary">Join Community</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="docs" />
    </div>
  );
}

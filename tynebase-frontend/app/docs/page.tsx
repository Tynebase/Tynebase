"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Search, BookOpen, Zap, Shield, ArrowRight, Code, Bot, 
  FileText, Lock, BarChart3, FolderSync, Globe, 
  Video, FileCheck, FolderOpen, 
  ChevronRight, Eye, Clock, User, 
  Users, Loader2, AlertCircle, Star, 
  Filter, Grid, List, MoreHorizontal, 
  Sparkles, RotateCcw, Tag as TagIcon, ChevronDown,
  SortAsc, Square, CheckSquare, Minus, Plus, Trash2, X, Download
} from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { categories, allArticles } from "@/lib/docs";
import { getKBLanding, getKBDocuments, estimateReadTime } from "@/lib/api/kb";
import type { KBTenant, KBCategory, KBDocumentsData, KBDocumentData } from "@/lib/api/kb";
import React from "react";

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

const iconMap: Record<string, any> = {
  Zap,
  BookOpen,
  Bot,
  Shield,
  Code,
  Users,
  FileText,
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
  return date.toLocaleDateString();
}

function getSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  
  const parts = hostname.split('.');
  const baseParts = baseDomain.split('.');
  
  if (parts.length > baseParts.length && hostname.endsWith(`.${baseDomain}`)) {
    const sub = parts.slice(0, parts.length - baseParts.length).join('.');
    if (sub && sub !== 'www') return sub;
  }
  
  if (hostname !== 'localhost' && hostname !== baseDomain) {
    return hostname;
  }
  
  return null;
}

/** Tenant KB page — rendered when visiting companyname.tynebase.com/docs */
function TenantKBPage({ subdomain }: { subdomain: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // State from Dashboard Page
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('kb_view_mode') as 'grid' | 'list') || 'list';
    }
    return 'list';
  });

  const [tenant, setTenant] = useState<KBTenant | null>(null);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [documents, setDocuments] = useState<KBDocumentData[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'created'>('updated');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // UI State
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTagFilterDropdown, setShowTagFilterDropdown] = useState(false);

  // Resizable column widths
  const defaultColWidths = [4.3, 1, 1.5, 0.8, 0.8, 1.5, 0.8];
  const COL_WIDTHS_KEY = 'kb_portal_col_widths_v2'; // Bumped version to reset layout
  const [colWidths, setColWidths] = useState<number[]>(() => {
    if (typeof window === 'undefined') return defaultColWidths;
    try {
      const saved = localStorage.getItem(COL_WIDTHS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaultColWidths.length) return parsed;
      }
    } catch {}
    return defaultColWidths;
  });
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidths = useRef<number[]>([...defaultColWidths]);
  const tableRef = useRef<HTMLDivElement>(null);

  const gridStyle = useMemo(() => {
    const template = colWidths.map((w, i) => i === 0 ? `minmax(0,${w}fr)` : `${w}fr`).join(' ');
    return { gridTemplateColumns: template };
  }, [colWidths]);

  // Sync viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('kb_view_mode', viewMode);
  }, [viewMode]);

  // Initial Fetch - Landing Page Data
  useEffect(() => {
    const fetchKB = async () => {
      try {
        setLoading(true);
        const data = await getKBLanding(subdomain);
        setTenant(data.tenant);
        setCategories(data.categories);
        if (data.tenant.branding.primary_color) {
          document.documentElement.style.setProperty("--brand", data.tenant.branding.primary_color);
        }

        // Fetch available tags for this tenant/community
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
        const tagsRes = await fetch(`${API_BASE}/api/public/community/${subdomain}/tags?limit=50`);
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setAvailableTags(tagsData.data?.tags || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Knowledge base not found");
      } finally {
        setLoading(false);
      }
    };
    fetchKB();
  }, [subdomain]);

  // Fetch Documents with active filters
  const fetchDocuments = useCallback(async () => {
    try {
      setDocsLoading(true);
      const data = await getKBDocuments(subdomain, { 
        category_id: selectedCategory === "all" ? undefined : selectedCategory,
        search: searchQuery || undefined,
        limit: 20,
        page: currentPage
      });
      setDocuments(data.documents);
      setTotalDocs(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [subdomain, selectedCategory, searchQuery, currentPage]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Resize Handler
  const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIndex;
    resizeStartX.current = e.clientX;
    resizeStartWidths.current = [...colWidths];

    const handleMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current === null || !tableRef.current) return;
      const tableWidth = tableRef.current.getBoundingClientRect().width;
      const totalFr = resizeStartWidths.current.reduce((a, b) => a + b, 0);
      const pxPerFr = tableWidth / totalFr;
      const delta = ev.clientX - resizeStartX.current;
      const deltaFr = delta / pxPerFr;

      const idx = resizingCol.current;
      const minFr = 0.4;
      const newLeft = Math.max(minFr, resizeStartWidths.current[idx] + deltaFr);
      const newRight = Math.max(minFr, resizeStartWidths.current[idx + 1] - deltaFr);

      setColWidths(prev => {
        const next = [...resizeStartWidths.current];
        next[idx] = newLeft;
        next[idx + 1] = newRight;
        return next;
      });
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setColWidths(current => {
        try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(current)); } catch {}
        return current;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [colWidths]);

  // Filtering & Sorting Logic (Mapped from Dashboard)
  const filteredDocs = useMemo(() => {
    let filtered = [...documents];

    // Status Filter (Note: Client-side for now as KB API primarily returns published)
    if (filterStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === filterStatus);
    }

    // Tag Filter
    if (filterTagId) {
      filtered = filtered.filter(doc => doc.tags?.some(t => t.id === filterTagId));
    }

    // Sort
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'created') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [documents, filterStatus, filterTagId, sortBy, sortOrder]);

  const getStateColor = (state: string) => {
    switch (state) {
      case "published": return "bg-[#10b98120] text-[#10b981]";
      case "draft": return "bg-[var(--bg-secondary)] text-[var(--text-muted)]";
      default: return "bg-[var(--bg-secondary)] text-[var(--text-muted)]";
    }
  };

  const getAiScoreColor = (score: number | null) => {
    if (score === null) return "text-[var(--text-muted)]";
    if (score >= 90) return "text-[#10b981]";
    if (score >= 70) return "text-[#f59e0b]";
    return "text-[#ef4444]";
  };

  const getAiScoreLabel = (score: number | null) => {
    if (score === null) return 'Not Scored';
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
  };

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

  const brandColor = tenant.branding.primary_color || "var(--brand)";
  const companyName = tenant.branding.company_name || tenant.name;

  return (
    <div className="min-h-screen relative pb-20">
      <div className="hero-gradient" />

      {/* Branded Portal Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(var(--bg-primary-rgb), 0.8)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {tenant.branding.logo_url ? (
                <img src={tenant.branding.logo_url} alt={companyName} style={{ height: '32px', width: 'auto' }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, background: brandColor }}>
                  {companyName.charAt(0)}
                </div>
              )}
              <h1 style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)' }}>{companyName}</h1>
            </div>
            <nav style={{ display: 'flex', gap: '16px' }}>
              <Link href="/docs" style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>Docs</Link>
              <Link href="/community" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}>Community</Link>
            </nav>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             {/* Search in header toggle? */}
          </div>
        </div>
      </header>

      <div className="container" style={{ maxWidth: '1400px', margin: '40px auto', padding: '0 24px' }}>
        
        {/* Category Pills (Top Navigation) */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
              selectedCategory === "all"
                ? "bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/20"
                : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedCategory === "all" ? "white" : "#6b7280" }} />
            All
            <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${selectedCategory === "all" ? "bg-white/20" : "bg-[var(--bg-tertiary)]"}`}>
              {totalDocs}
            </span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/20"
                  : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || brandColor }} />
              {cat.name}
              <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${selectedCategory === cat.id ? "bg-white/20" : "bg-[var(--bg-tertiary)]"}`}>
                {cat.document_count || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search, Sort, and View Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder="Search by title, content or author..."
              className="w-full h-12 pl-12 pr-4 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Toggle */}
            <div className="relative">
              <button 
                onClick={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}
                className="flex items-center gap-2 px-4 h-12 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-secondary)] hover:border-[var(--brand)] transition-all"
              >
                <SortAsc className="w-4 h-4" />
                <span className="text-sm">Sort: {sortBy === 'title' ? 'Title' : sortBy === 'updated' ? 'Updated' : 'Created'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-[100] overflow-hidden">
                  <button onClick={() => { setSortBy('updated'); setSortOrder('desc'); setShowSortDropdown(false); }} className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] ${sortBy === 'updated' ? 'text-[var(--brand)]' : 'text-[var(--text-secondary)]'}`}>Recently Updated</button>
                  <button onClick={() => { setSortBy('title'); setSortOrder('asc'); setShowSortDropdown(false); }} className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] ${sortBy === 'title' && sortOrder === 'asc' ? 'text-[var(--brand)]' : 'text-[var(--text-secondary)]'}`}>Title (A-Z)</button>
                  <button onClick={() => { setSortBy('created'); setSortOrder('desc'); setShowSortDropdown(false); }} className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] ${sortBy === 'created' ? 'text-[var(--brand)]' : 'text-[var(--text-secondary)]'}`}>Newest First</button>
                </div>
              )}
            </div>

            {/* Filter Toggle */}
            <div className="relative">
              <button 
                onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
                className={`flex items-center gap-2 px-4 h-12 bg-[var(--bg-secondary)] border rounded-xl transition-all ${filterStatus !== 'all' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)]'}`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">{filterStatus === 'all' ? 'Status' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-[100] overflow-hidden">
                   <button onClick={() => { setFilterStatus('all'); setShowFilterDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)]">All Status</button>
                   <button onClick={() => { setFilterStatus('published'); setShowFilterDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)]">Published</button>
                   <button onClick={() => { setFilterStatus('draft'); setShowFilterDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)]">Drafts</button>
                </div>
              )}
            </div>

            {/* Tag Filter Toggle */}
            <div className="relative">
              <button 
                onClick={() => { setShowTagFilterDropdown(!showTagFilterDropdown); setShowFilterDropdown(false); setShowSortDropdown(false); }}
                className={`flex items-center gap-2 px-4 h-12 bg-[var(--bg-secondary)] border rounded-xl transition-all ${filterTagId ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)]'}`}
              >
                <TagIcon className="w-4 h-4" />
                <span className="text-sm">{filterTagId ? availableTags.find(t => t.id === filterTagId)?.name : 'Tag'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTagFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-[100] overflow-hidden max-h-80 overflow-y-auto">
                  <button onClick={() => { setFilterTagId(null); setShowTagFilterDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)]">All Tags</button>
                  {availableTags.map(tag => (
                    <button key={tag.id} onClick={() => { setFilterTagId(tag.id); setShowTagFilterDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)]">#{tag.name}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden ml-2 h-12">
              <button 
                onClick={() => setViewMode('list')}
                className={`w-12 flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`w-12 flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Document Listing */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredDocs.length}</strong> documents
          </p>
        </div>

        {docsLoading ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: 'var(--brand)' }} />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '24px', border: '1px dashed var(--border-subtle)' }}>
            <FileText className="w-12 h-12 mx-auto" style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>No articles found</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div>
            {viewMode === 'list' ? (
              <div ref={tableRef} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden flex flex-col shadow-sm">
                {/* Table Header */}
                <div className="hidden md:grid px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider" style={gridStyle}>
                  {[
                    <div key="doc" className="flex items-center gap-2 pr-2">DOCUMENT</div>,
                    <div key="cat" className="px-2">CATEGORY</div>,
                    <div key="tags" className="px-2">TAGS</div>,
                    <div key="vis" className="text-center px-2">VISIBILITY</div>,
                    <div key="status" className="text-center px-2">STATUS</div>,
                    <div key="updated" className="px-2">UPDATED</div>,
                    <div key="views" className="text-right pl-2">VIEWS</div>,
                  ].flatMap((header, i, arr) => {
                    const elements = [<div key={`h-c-${i}`} className="relative min-w-0">{header}</div>];
                    if (i < arr.length - 1) {
                      elements.push(
                        <div
                          key={`resizer-${i}`}
                          className="w-1 cursor-col-resize hover:bg-[var(--brand)] transition-colors"
                          onMouseDown={(e) => handleResizeStart(e, i)}
                        />
                      );
                    }
                    return elements;
                  })}
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {filteredDocs.map((doc) => (
                    <Link key={doc.id} href={`/docs/${doc.id}`} className="block group hover:bg-[var(--bg-tertiary)] transition-colors">
                      <div className="hidden md:grid px-6 py-5 items-center" style={gridStyle}>
                        <div className="flex items-center gap-4 min-w-0 pr-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (doc.category?.color || brandColor) + '15' }}>
                            <FileText className="w-5 h-5" style={{ color: doc.category?.color || brandColor }} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--brand)] truncate transition-colors">{doc.title}</h3>
                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">Author: {doc.author?.full_name || 'System'}</p>
                          </div>
                        </div>
                        <div className="px-2">
                          <span className="text-xs text-[var(--text-secondary)] font-medium bg-[var(--bg-tertiary)] px-2 py-1 rounded-md">{doc.category?.name || 'Uncategorised'}</span>
                        </div>
                        <div className="px-2 flex gap-1 flex-wrap">
                          {doc.tags?.slice(0, 2).map(tag => (
                            <span key={tag.id} className="text-[10px] text-[var(--text-muted)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-full">#{tag.name}</span>
                          ))}
                          {doc.tags && doc.tags.length > 2 && <span className="text-[10px] text-[var(--text-muted)]">+{doc.tags.length - 2}</span>}
                        </div>
                        <div className="text-center px-2">
                          <span title={doc.visibility} className="flex justify-center">
                            {doc.visibility === 'public' ? <Globe className="w-4 h-4 text-[#10b981]" /> : doc.visibility === 'team' ? <Users className="w-4 h-4 text-[var(--brand)]" /> : <Lock className="w-4 h-4 text-[var(--text-muted)]" />}
                          </span>
                        </div>
                        <div className="text-center px-2">
                           <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-tight ${getStateColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="px-2">
                          <p className="text-xs text-[var(--text-secondary)] font-medium">{formatRelativeTime(doc.updated_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[var(--text-primary)]">{doc.view_count || 0}</p>
                        </div>
                      </div>

                      {/* Mobile Row */}
                      <div className="flex md:hidden flex-col p-4 gap-3">
                        <div className="flex gap-3">
                           <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (doc.category?.color || brandColor) + '15' }}>
                            <FileText className="w-5 h-5" style={{ color: doc.category?.color || brandColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{doc.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                               <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${getStateColor(doc.status)}`}>{doc.status}</span>
                               <span className="text-[10px] text-[var(--text-muted)]">{formatRelativeTime(doc.updated_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredDocs.map((doc) => (
                    <Link key={doc.id} href={`/docs/${doc.id}`} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6 hover:border-[var(--brand)] hover:shadow-xl transition-all group flex flex-col h-full active:scale-[0.98]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300" style={{ backgroundColor: (doc.category?.color || brandColor) + '15' }}>
                          <FileText className="w-6 h-6" style={{ color: doc.category?.color || brandColor }} />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors line-clamp-2">{doc.title}</h3>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 flex-1 leading-relaxed mb-6">
                        {doc.content ? doc.content.replace(/<[^>]*>/g, '').slice(0, 150) : 'No description available'}...
                      </p>

                      <div className="pt-4 border-t border-[var(--border-subtle)] mt-auto">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold px-2 py-1 bg-[var(--bg-tertiary)] rounded-md text-[var(--text-muted)] uppercase tracking-tight">{doc.category?.name || 'Article'}</span>
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-tight ${getStateColor(doc.status)}`}>{doc.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <Eye className="w-3.5 h-3.5" />
                              {doc.view_count || 0}
                            </div>
                            <span className="text-[10px] font-bold uppercase">{formatRelativeTime(doc.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                 ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-6 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm font-bold text-[var(--text-primary)] disabled:opacity-40 hover:border-[var(--brand)] transition-all"
                >
                  Previous
                </button>
                <span className="text-sm font-bold text-[var(--text-muted)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-6 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm font-bold text-[var(--text-primary)] disabled:opacity-40 hover:border-[var(--brand)] transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

/** TyneBase main docs page — rendered when visiting tynebase.com/docs */
function MainKBPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(cat);

  const filteredArticles = selectedCategory
    ? allArticles.filter((a) => a.category === selectedCategory)
    : allArticles;

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <SiteNavbar currentPage="docs" />

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div className="badge-modern mx-auto" style={{ marginBottom: '24px' }}>
              <Zap className="w-4 h-4 text-[var(--brand)]" />
              <span>Knowledge Base & Docs</span>
            </div>
            <h1 className="h1-premium" style={{ marginBottom: '24px' }}>
              The smartest way to <span className="text-gradient">document</span> your work.
            </h1>
            <p className="p-premium" style={{ marginBottom: '48px' }}>
              Search across our guides, API documentation, and community resources to find exactly what you need.
            </p>

            {/* Search Bar */}
            <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                className="input-premium"
                placeholder="Search for documentation..."
                style={{ paddingLeft: '64px', height: '64px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section style={{ paddingBottom: '100px' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          
          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ marginBottom: '80px' }}>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`card-premium transition-all ${selectedCategory === category.id ? 'active' : ''}`}
                style={{ textAlign: 'left', padding: '40px' }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center" 
                  style={{ backgroundColor: `${category.color}15`, marginBottom: '24px' }}
                >
                  {iconMap[category.icon] && React.createElement(iconMap[category.icon], { 
                    className: "w-6 h-6", 
                    style: { color: category.color } 
                  })}
                </div>
                <h3 className="h3-premium" style={{ marginBottom: '12px' }}>{category.name}</h3>
                <p className="p-premium" style={{ fontSize: '15px' }}>{category.description}</p>
                <div className="flex items-center gap-2 mt-6 font-medium" style={{ color: category.color }}>
                  <span>{category.articles.length} articles</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>

          {/* Featured Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-20 border-t border-[var(--border-subtle)]">
            <div>
              <h2 className="h2-premium" style={{ marginBottom: '32px' }}>Enterprise Readiness</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {enterpriseFeatures.map((f) => (
                  <div key={f.title} className="flex gap-4">
                    <f.icon className="w-5 h-5 text-[var(--brand)] flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)]" style={{ fontSize: '15px', marginBottom: '4px' }}>{f.title}</h4>
                      <p className="text-sm text-[var(--text-secondary)]">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="h2-premium" style={{ marginBottom: '32px' }}>Developer API</h2>
              <div className="flex flex-col gap-4">
                {apiDocs.map((f) => (
                  <Link key={f.title} href={`/docs/${f.slug}`} className="card-premium flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--brand-faint)] flex items-center justify-center">
                        <f.icon className="w-5 h-5 text-[var(--brand)]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[var(--text-primary)]" style={{ fontSize: '15px' }}>{f.title}</h4>
                        <p className="text-sm text-[var(--text-secondary)]">{f.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[var(--text-muted)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export default function DocsPage() {
  const searchParams = useSearchParams();
  const subdomainFromParams = searchParams.get('community_id');
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    const sub = getSubdomainFromHost();
    setSubdomain(sub || subdomainFromParams);
  }, [subdomainFromParams]);

  if (subdomain) {
    return <TenantKBPage subdomain={subdomain} />;
  }

  return <MainKBPage />;
}

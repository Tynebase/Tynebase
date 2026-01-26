"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Search, Filter, Grid, List, MoreHorizontal, FileText,
  Clock, Users, Star, Eye, Sparkles,
  TrendingUp, GitBranch, MessageSquare, Share2, Download,
  Copy, ChevronDown, SortAsc,
  CheckCircle, AlertCircle, Zap,
  Globe, Lock, BookOpen, Database, FileSearch, HeartPulse,
  Loader2, AlertTriangle
} from "lucide-react";
import { listDocuments, type Document } from "@/lib/api/documents";

interface UIDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  updatedAt: string;
  author: string;
  authorAvatar: string;
  starred: boolean;
  state: string;
  views: number;
  comments: number;
  version: string;
  lastEditor: string;
  visibility: string;
  aiScore: number;
}

const categories = [
  { name: "All", count: 47, color: "#6b7280", icon: BookOpen },
  { name: "Onboarding", count: 8, color: "#3b82f6", icon: Zap },
  { name: "API Docs", count: 15, color: "#8b5cf6", icon: FileText },
  { name: "Admin", count: 6, color: "#ec4899", icon: Users },
  { name: "Integrations", count: 12, color: "#06b6d4", icon: Share2 },
  { name: "Security", count: 4, color: "#10b981", icon: Lock },
  { name: "Product", count: 2, color: "#f59e0b", icon: TrendingUp },
];

const quickActions = [
  { label: "AI Generate", icon: Sparkles, color: "#ec4899", href: "/dashboard/ai-assistant" },
  { label: "Import", icon: Download, color: "#3b82f6", href: "/dashboard/knowledge/import" },
  { label: "Templates", icon: Copy, color: "#8b5cf6", href: "/dashboard/templates" },
];

export default function KnowledgePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [documents, setDocuments] = useState<UIDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  const getStateColor = (state: string) => {
    switch (state) {
      case "published": return "bg-[var(--status-success-bg)] text-[var(--status-success)]";
      case "draft": return "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]";
      case "in_review": return "bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
      case "needs_update": return "bg-[var(--status-error-bg)] text-[var(--status-error)]";
      default: return "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]";
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "public": return <Globe className="w-3.5 h-3.5 text-[var(--status-success)]" />;
      case "team": return <Users className="w-3.5 h-3.5 text-[var(--status-info)]" />;
      case "private": return <Lock className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />;
      default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  const getAiScoreColor = (score: number) => {
    if (score >= 90) return "text-[var(--status-success)]";
    if (score >= 70) return "text-[var(--status-warning)]";
    return "text-[var(--status-error)]";
  };

  const formatRelativeTime = useCallback((dateString: string): string => {
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
  }, []);

  const mapDocumentToUI = useCallback((doc: Document): UIDocument => {
    const authorName = doc.users?.full_name || doc.users?.email || 'Unknown';
    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    return {
      id: doc.id,
      title: doc.title,
      description: doc.content.slice(0, 150) || 'No description',
      category: 'General',
      updatedAt: formatRelativeTime(doc.updated_at),
      author: authorName,
      authorAvatar: initials,
      starred: false,
      state: doc.status,
      views: 0,
      comments: 0,
      version: '1.0',
      lastEditor: authorName,
      visibility: doc.is_public ? 'public' : 'private',
      aiScore: 85,
    };
  }, [formatRelativeTime]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await listDocuments({
          page: currentPage,
          limit: 20,
        });
        
        const uiDocs = response.data.documents.map(mapDocumentToUI);
        setDocuments(uiDocs);
        setTotalPages(response.data.pagination.totalPages);
        setTotalDocs(response.data.pagination.total);
        setHasNextPage(response.data.pagination.hasNextPage);
        setHasPrevPage(response.data.pagination.hasPrevPage);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [currentPage, mapDocumentToUI]);

  const filteredDocs = documents.filter(doc => {
    if (selectedCategory !== "All" && doc.category !== selectedCategory) return false;
    if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex min-h-full flex-col gap-8">
      {/* Header with Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Knowledge Base</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            {totalDocs} documents • {loading ? 'Loading...' : `Page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <button
                className="flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
              >
                <span style={{ color: action.color }}>
                  <action.icon className="w-4 h-4" />
                </span>
                {action.label}
              </button>
            </Link>
          ))}
          <Link href="/dashboard/knowledge/new">
            <button className="flex items-center gap-2 h-10 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-medium transition-all">
              <Plus className="w-4 h-4" />
              New Document
            </button>
          </Link>
        </div>
      </div>

      {/* Articles vs Knowledge Sources (RAG) */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Two layers of knowledge</p>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              <span className="font-semibold text-[var(--dash-text-secondary)]">Articles</span> are authored content.
              <span className="mx-2">•</span>
              <span className="font-semibold text-[var(--dash-text-secondary)]">Knowledge Sources (RAG)</span> are PDFs/DOCX/MD normalized to Markdown, chunked, embedded and used for retrieval.
            </p>
          </div>
          <Link
            href="/dashboard/sources"
            className="inline-flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <Database className="w-4 h-4" />
            Manage Sources
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link
            href="/dashboard/sources"
            className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] hover:border-[var(--brand)] transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#0ea5e915" }}>
                <Database className="w-5 h-5" style={{ color: "#0ea5e9" }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Sources</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Upload PDF/DOCX/MD + track status</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/sources/normalized"
            className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] hover:border-[var(--brand)] transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#8b5cf615" }}>
                <FileSearch className="w-5 h-5" style={{ color: "#8b5cf6" }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Normalized Markdown</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Inspect what the model sees</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/sources/query"
            className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] hover:border-[var(--brand)] transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ec489915" }}>
                <Sparkles className="w-5 h-5" style={{ color: "#ec4899" }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Query Workspace</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Ask w/ citations (RAG)</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/sources/health"
            className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] hover:border-[var(--brand)] transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#10b98115" }}>
                <HeartPulse className="w-5 h-5" style={{ color: "#10b981" }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Index Health</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Chunking + embeddings readiness</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f615' }}>
            <FileText className="w-5 h-5" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">47</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Documents</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b98115' }}>
            <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">38</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Published</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b15' }}>
            <AlertCircle className="w-5 h-5" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">5</p>
            <p className="text-xs text-[var(--dash-text-muted)]">In Review</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ec489915' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#ec4899' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">89%</p>
            <p className="text-xs text-[var(--dash-text-muted)]">AI Score</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf615' }}>
            <Eye className="w-5 h-5" style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">12.4K</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Total Views</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${selectedCategory === cat.name
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                }`}
            >
              <span style={{ color: selectedCategory === cat.name ? 'white' : cat.color }}>
                <Icon className="w-4 h-4" />
              </span>
              {cat.name}
              <span className={`px-1.5 py-0.5 text-xs rounded-md ${selectedCategory === cat.name
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--surface-ground)] text-[var(--dash-text-muted)]'
                }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, Sort, and View Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
          <input
            type="text"
            placeholder="Search by title, content or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
            <SortAsc className="w-4 h-4" />
            <span className="text-sm">Sort</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>
          <div className="flex items-center bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-[var(--brand)] text-white' : 'text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)]'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-[var(--brand)] text-white' : 'text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)]'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <span className="ml-3 text-[var(--dash-text-secondary)]">Loading documents...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--status-error)] mb-1">Failed to load documents</h3>
            <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-[var(--status-error)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Documents Header */}
      {!loading && !error && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--dash-text-tertiary)]">
            Showing <span className="font-medium text-[var(--dash-text-primary)]">{filteredDocs.length}</span> documents
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-[var(--status-success)]" /> Published</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[var(--dash-text-muted)]" /> Draft</span>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-1 min-h-0 flex-col gap-4">
        {/* Documents List/Grid */}
        {viewMode === 'list' ? (
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)] text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
              <div className="col-span-5">Document</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-center">AI Score</div>
              <div className="col-span-2">Updated</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)] flex-1 min-h-0 overflow-auto">
              {filteredDocs.map((doc) => (
                <Link key={doc.id} href={`/dashboard/knowledge/${doc.id}`}>
                  <div className="block hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group">
                    {/* Desktop Table View */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                      {/* Document Info */}
                      <div className="col-span-5 flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: categories.find(c => c.name === doc.category)?.color + '15' }}>
                          <FileText className="w-5 h-5" style={{ color: categories.find(c => c.name === doc.category)?.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] truncate">
                              {doc.title}
                            </h3>
                            {doc.starred && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
                            {getVisibilityIcon(doc.visibility)}
                          </div>
                          <p className="text-sm text-[var(--dash-text-tertiary)] truncate">{doc.description}</p>
                        </div>
                      </div>
                      {/* Category */}
                      <div className="col-span-2">
                        <span className="text-sm text-[var(--dash-text-secondary)]">{doc.category}</span>
                      </div>
                      {/* Status */}
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex px-3 py-1.5 text-xs font-medium rounded-full ${getStateColor(doc.state)}`}>
                          {doc.state.replace("_", " ")}
                        </span>
                      </div>
                      {/* AI Score */}
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${getAiScoreColor(doc.aiScore)}`}>
                          <Sparkles className="w-3.5 h-3.5" />
                          {doc.aiScore}%
                        </span>
                      </div>
                      {/* Updated */}
                      <div className="col-span-2">
                        <p className="text-sm text-[var(--dash-text-secondary)]">{doc.updatedAt}</p>
                        <p className="text-xs text-[var(--dash-text-muted)]">by {doc.lastEditor}</p>
                      </div>
                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <div className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
                          <Eye className="w-3.5 h-3.5" />
                          {doc.views.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] ml-2">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {doc.comments}
                        </div>
                        <button
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="flex md:hidden flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: categories.find(c => c.name === doc.category)?.color + '15' }}>
                            <FileText className="w-5 h-5" style={{ color: categories.find(c => c.name === doc.category)?.color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-medium text-[var(--dash-text-primary)] text-sm line-clamp-1">{doc.title}</h3>
                              {doc.starred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${getStateColor(doc.state)}`}>
                                {doc.state.replace("_", " ")}
                              </span>
                              <span className="text-xs text-[var(--dash-text-secondary)] flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> {doc.aiScore}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <button className="p-1 text-[var(--dash-text-tertiary)]"><MoreHorizontal className="w-4 h-4" /></button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] pt-2 border-t border-[var(--dash-border-subtle)]">
                        <span className="truncate max-w-[120px]">by {doc.lastEditor}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {doc.views}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {doc.comments}</span>
                          <span>{doc.updatedAt}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <Link key={doc.id} href={`/dashboard/knowledge/${doc.id}`}>
                  <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 hover:shadow-lg hover:border-[var(--brand)] transition-all cursor-pointer group h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: categories.find(c => c.name === doc.category)?.color + '15' }}>
                        <FileText className="w-6 h-6" style={{ color: categories.find(c => c.name === doc.category)?.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.starred && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${getStateColor(doc.state)}`}>
                          {doc.state.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-[var(--dash-text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-2 mb-4 flex-1">{doc.description}</p>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] mb-3">
                      <span className="flex items-center gap-1">
                        {getVisibilityIcon(doc.visibility)}
                        {doc.visibility}
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${getAiScoreColor(doc.aiScore)}`}>
                        <Sparkles className="w-3 h-3" />
                        {doc.aiScore}% AI Score
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-[var(--dash-text-muted)] pt-3 border-t border-[var(--dash-border-subtle)]">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {doc.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {doc.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        v{doc.version}
                      </span>
                      <span className="ml-auto">{doc.updatedAt}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 flex-shrink-0">
            <p className="text-sm text-[var(--dash-text-muted)]">
              Showing {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, totalDocs)} of {totalDocs} documents
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!hasPrevPage}
                className="px-5 py-2.5 text-sm bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--dash-text-muted)] px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!hasNextPage}
                className="px-5 py-2.5 text-sm bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

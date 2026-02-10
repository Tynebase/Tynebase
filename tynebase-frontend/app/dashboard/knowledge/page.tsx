"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Plus, Search, Filter, Grid, List, MoreHorizontal, FileText,
  Clock, Users, Star, Eye, Sparkles,
  TrendingUp, GitBranch, MessageSquare, Share2, Download,
  Copy, ChevronDown, SortAsc,
  CheckCircle, AlertCircle, Zap,
  Globe, Lock, BookOpen, Database, FileSearch, HeartPulse,
  Loader2, AlertTriangle, Trash2, Square, CheckSquare, Minus,
  FolderInput, Tag as TagIcon, Library, X, RotateCcw
} from "lucide-react";
import { listDocuments, deleteDocument, updateDocument, type Document } from "@/lib/api/documents";
import { listCategories, type Category } from "@/lib/api/folders";
import { listCollections, addDocumentsToCollection, type Collection } from "@/lib/api/collections";
import { listTags, addTagToDocuments, type Tag as TagType } from "@/lib/api/tags";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { DocumentImportModal } from "@/components/docs/DocumentImportModal";
import { SortableCategories } from "@/components/ui/SortableCategories";

interface DocumentCollectionInfo {
  id: string;
  name: string;
  color: string;
}

interface DocumentTagInfo {
  id: string;
  name: string;
  description: string | null;
}

interface UIDocument {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
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
  aiScore: number | null;
  collections: DocumentCollectionInfo[];
  tags: DocumentTagInfo[];
}

// "All" category is always first, then dynamic categories from API
const ALL_CATEGORY = { id: "all", name: "All", color: "#6b7280", document_count: 0 };

const quickActions = [
  { label: "AI Generate", icon: Sparkles, color: "#ec4899", href: "/dashboard/ai-assistant" },
  { label: "Templates", icon: Copy, color: "#8b5cf6", href: "/dashboard/templates" },
];

export default function KnowledgePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tagParam = searchParams.get('tag');
  const categoryParam = searchParams.get('category');
  const statusParam = searchParams.get('status') as 'all' | 'published' | 'draft' | null;
  const searchParam = searchParams.get('search');
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState(searchParam || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam || "all");
  const [documents, setDocuments] = useState<UIDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<UIDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'created'>('updated');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>(statusParam || 'all');
  const [filterTagId, setFilterTagId] = useState<string | null>(tagParam);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTagFilterDropdown, setShowTagFilterDropdown] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Bulk action modals
  const [moveCategoryModalOpen, setMoveCategoryModalOpen] = useState(false);
  const [assignTagsModalOpen, setAssignTagsModalOpen] = useState(false);
  const [addToCollectionModalOpen, setAddToCollectionModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Confirmation screen states for bulk actions
  const [moveCategorySuccess, setMoveCategorySuccess] = useState(false);
  const [moveCategoryTargetName, setMoveCategoryTargetName] = useState<string>('');
  const [addToCollectionSuccess, setAddToCollectionSuccess] = useState(false);
  const [addToCollectionTargetName, setAddToCollectionTargetName] = useState<string>('');

  // Tags and Collections for bulk actions
  const [tags, setTags] = useState<TagType[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCategoryForMove, setSelectedCategoryForMove] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await listCategories({ limit: 50 });
        setApiCategories(response.categories);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

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
      case "team": return <Users className="w-3.5 h-3.5 text-[var(--brand)]" />;
      case "private": return <Lock className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />;
      default: return <Users className="w-3.5 h-3.5 text-[var(--brand)]" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case "public": return "Public — visible to everyone";
      case "team": return "Team — visible to workspace members";
      case "private": return "Private — only visible to you";
      default: return "Team — visible to workspace members";
    }
  };

  const getAiScoreColor = (score: number | null) => {
    if (score === null) return "text-[var(--dash-text-tertiary)]";
    if (score >= 90) return "text-[var(--status-success)]";
    if (score >= 70) return "text-[var(--status-warning)]";
    return "text-[var(--status-error)]";
  };

  const getAiScoreLabel = (score: number | null) => {
    if (score === null) return 'Not Scored';
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
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
      description: (doc.content || '').slice(0, 150) || 'No description',
      categoryId: doc.category_id,
      updatedAt: formatRelativeTime(doc.updated_at),
      author: authorName,
      authorAvatar: initials,
      starred: false,
      state: doc.status,
      views: doc.view_count || 0,
      comments: 0,
      version: '1.0',
      lastEditor: authorName,
      visibility: doc.visibility || (doc.is_public ? 'public' : 'team'),
      aiScore: (doc as any).ai_score || null,
      collections: doc.collections || [],
      tags: doc.tags || [],
    };
  }, [formatRelativeTime]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Build API params from filters
        const apiParams: Parameters<typeof listDocuments>[0] = {
          page: currentPage,
          limit: 20,
        };
        
        // Only pass category filter if not "all"
        if (selectedCategory !== 'all') {
          apiParams.category_id = selectedCategory;
        }
        
        // Only pass status filter if not "all"
        if (filterStatus !== 'all') {
          apiParams.status = filterStatus;
        }
        
        // Pass tag filter if set
        if (filterTagId) {
          apiParams.tag_id = filterTagId;
        }
        
        const response = await listDocuments(apiParams);
        
        const uiDocs = response.documents.map(mapDocumentToUI);
        setDocuments(uiDocs);
        setTotalPages(response.pagination.totalPages);
        setTotalDocs(response.pagination.total);
        setHasNextPage(response.pagination.hasNextPage);
        setHasPrevPage(response.pagination.hasPrevPage);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [currentPage, selectedCategory, filterStatus, filterTagId, mapDocumentToUI]);

  const handleDeleteClick = useCallback((doc: UIDocument, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;
    
    try {
      setDeleting(true);
      await deleteDocument(documentToDelete.id);
      
      setDocuments(prev => prev.filter(doc => doc.id !== documentToDelete.id));
      setTotalDocs(prev => prev - 1);
      
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
    } catch (err) {
      console.error('Failed to delete document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
  };

  // Fetch tags and collections for bulk actions
  useEffect(() => {
    const fetchTagsAndCollections = async () => {
      try {
        const [tagsResponse, collectionsResponse] = await Promise.all([
          listTags({ limit: 50 }),
          listCollections({ limit: 50 }),
        ]);
        setTags(tagsResponse.tags);
        setCollections(collectionsResponse.collections);
      } catch (err) {
        console.error('Failed to fetch tags/collections:', err);
      }
    };
    fetchTagsAndCollections();
  }, []);

  // Selection handlers
  const handleSelectDocument = useCallback((docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((filteredDocIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = filteredDocIds.every(id => prev.has(id));
      if (allSelected) {
        // Deselect all filtered docs
        const newSet = new Set(prev);
        filteredDocIds.forEach(id => newSet.delete(id));
        return newSet;
      } else {
        // Select all filtered docs
        const newSet = new Set(prev);
        filteredDocIds.forEach(id => newSet.add(id));
        return newSet;
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk action handlers
  const handleBulkMoveCategory = async () => {
    if (!selectedCategoryForMove || selectedIds.size === 0) return;
    
    try {
      setBulkActionLoading(true);
      const promises = Array.from(selectedIds).map(id =>
        updateDocument(id, { category_id: selectedCategoryForMove === 'none' ? null : selectedCategoryForMove })
      );
      await Promise.all(promises);
      
      // Update local state
      setDocuments(prev => prev.map(doc => 
        selectedIds.has(doc.id) 
          ? { ...doc, categoryId: selectedCategoryForMove === 'none' ? null : selectedCategoryForMove }
          : doc
      ));
      
      // Get target category name for confirmation
      const targetName = selectedCategoryForMove === 'none' 
        ? 'Uncategorized' 
        : apiCategories.find(c => c.id === selectedCategoryForMove)?.name || 'Unknown';
      setMoveCategoryTargetName(targetName);
      
      // Show success confirmation instead of closing
      setMoveCategorySuccess(true);
    } catch (err) {
      console.error('Failed to move documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to move documents');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const closeMoveCategoryModal = () => {
    setMoveCategoryModalOpen(false);
    setSelectedCategoryForMove(null);
    setMoveCategorySuccess(false);
    setMoveCategoryTargetName('');
    clearSelection();
  };

  const handleBulkAssignTag = async () => {
    if (!selectedTagId || selectedIds.size === 0) return;
    
    try {
      setBulkActionLoading(true);
      await addTagToDocuments(selectedTagId, Array.from(selectedIds));
      
      // Refetch documents to get updated tags
      const response = await listDocuments({
        page: currentPage,
        limit: 20,
      });
      const uiDocs = response.documents.map(mapDocumentToUI);
      setDocuments(uiDocs);
      
      setAssignTagsModalOpen(false);
      setSelectedTagId(null);
      clearSelection();
    } catch (err) {
      console.error('Failed to assign tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign tag');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkAddToCollection = async () => {
    if (!selectedCollectionId || selectedIds.size === 0) return;
    
    try {
      setBulkActionLoading(true);
      await addDocumentsToCollection(selectedCollectionId, Array.from(selectedIds));
      
      // Get target collection name for confirmation
      const targetName = collections.find(c => c.id === selectedCollectionId)?.name || 'Unknown';
      setAddToCollectionTargetName(targetName);
      
      // Show success confirmation instead of closing
      setAddToCollectionSuccess(true);
    } catch (err) {
      console.error('Failed to add to collection:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to collection');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const closeAddToCollectionModal = () => {
    setAddToCollectionModalOpen(false);
    setSelectedCollectionId(null);
    setAddToCollectionSuccess(false);
    setAddToCollectionTargetName('');
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setBulkActionLoading(true);
      const promises = Array.from(selectedIds).map(id => deleteDocument(id));
      await Promise.all(promises);
      
      // Update local state
      setDocuments(prev => prev.filter(doc => !selectedIds.has(doc.id)));
      setTotalDocs(prev => prev - selectedIds.size);
      
      setBulkDeleteModalOpen(false);
      clearSelection();
    } catch (err) {
      console.error('Failed to delete documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete documents');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Build categories list with "All" first, then API categories with counts
  const categories = [
    { id: "all", name: "All", color: "#6b7280", count: documents.length },
    ...apiCategories.map((cat: Category) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color || '#3b82f6',
      count: cat.document_count || 0,
    }))
  ];

  const filteredDocs = useMemo(() => documents
    .filter(doc => {
      if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else {
        // For 'updated' and 'created', we compare the updatedAt string
        // Since it's relative time, we'll just use the original order from API
        comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }), [documents, searchQuery, sortBy, sortOrder]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, filterStatus, filterTagId, searchQuery]);

  // Sync filter state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }
    
    if (filterStatus !== 'all') {
      params.set('status', filterStatus);
    }
    
    if (filterTagId) {
      params.set('tag', filterTagId);
    }
    
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    router.replace(newUrl, { scroll: false });
  }, [selectedCategory, filterStatus, filterTagId, searchQuery, currentPage, pathname, router]);

  // Selection state for filtered docs
  const filteredDocIds = useMemo(() => filteredDocs.map(doc => doc.id), [filteredDocs]);
  const selectedCount = useMemo(() => 
    filteredDocIds.filter(id => selectedIds.has(id)).length, 
    [filteredDocIds, selectedIds]
  );
  const allFilteredSelected = filteredDocIds.length > 0 && selectedCount === filteredDocIds.length;
  const someFilteredSelected = selectedCount > 0 && selectedCount < filteredDocIds.length;

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
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <span style={{ color: "#3b82f6" }}>
              <Download className="w-4 h-4" />
            </span>
            Import
          </button>
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
              <span className="font-semibold text-[var(--dash-text-secondary)]">Knowledge Sources (RAG)</span> are PDFs/DOCX/MD normalised to Markdown, chunked, embedded and used for retrieval.
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
                <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Normalised Markdown</p>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Inspect what the model sees</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/ai-assistant/ask"
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f615' }}>
            <FileText className="w-5 h-5" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">{totalDocs}</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Total Documents</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b98115' }}>
            <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">{documents.filter(d => d.state === 'published').length}</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Published</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b15' }}>
            <AlertCircle className="w-5 h-5" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--dash-text-primary)]">{documents.filter(d => d.state === 'draft').length}</p>
            <p className="text-xs text-[var(--dash-text-muted)]">Drafts</p>
          </div>
        </div>
      </div>

      {/* Categories with Drag and Drop */}
      <div className="flex flex-wrap gap-2">
        {/* Static "All" button — not draggable/reorderable */}
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            selectedCategory === "all"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
          }`}
        >
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: selectedCategory === "all" ? "white" : "#6b7280" }}
          />
          All
          <span
            className={`px-1.5 py-0.5 text-xs rounded-md ${
              selectedCategory === "all"
                ? "bg-white/20 text-white"
                : "bg-[var(--surface-ground)] text-[var(--dash-text-muted)]"
            }`}
          >
            {documents.length}
          </span>
        </button>

        {/* Only real API categories (with UUID IDs) go into SortableCategories */}
        <SortableCategories
          categories={apiCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            color: cat.color || '#3b82f6',
            count: cat.document_count || 0,
            sort_order: cat.sort_order ?? 0,
            description: cat.description || null,
            icon: cat.icon || 'folder',
            parent_id: cat.parent_id || null,
            document_count: cat.document_count || 0,
            subcategory_count: cat.subcategory_count || 0,
            author_id: cat.author_id || '',
            created_at: cat.created_at || '',
            updated_at: cat.updated_at || '',
          }))}
          selectedCategoryId={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onReorder={(newCategories) => {
            // Update the categories order in the local state
            const updatedCategories = newCategories.map((cat) => ({
              id: cat.id,
              name: cat.name,
              color: cat.color,
              count: cat.count,
            }));
            // We don't need to do anything else since the API already updated the sort_order
            console.log('Categories reordered:', updatedCategories);
          }}
        />
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
          {/* Sort Dropdown */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowSortDropdown(!showSortDropdown);
                setShowFilterDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all"
            >
              <SortAsc className="w-4 h-4" />
              <span className="text-sm">Sort: {sortBy === 'title' ? 'Title' : sortBy === 'updated' ? 'Updated' : 'Created'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => { setSortBy('updated'); setSortOrder('desc'); setShowSortDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${sortBy === 'updated' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  Recently Updated
                </button>
                <button
                  onClick={() => { setSortBy('title'); setSortOrder('asc'); setShowSortDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${sortBy === 'title' && sortOrder === 'asc' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  Title (A-Z)
                </button>
                <button
                  onClick={() => { setSortBy('title'); setSortOrder('desc'); setShowSortDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${sortBy === 'title' && sortOrder === 'desc' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  Title (Z-A)
                </button>
              </div>
            )}
          </div>
          
          {/* Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setShowSortDropdown(false);
                setShowTagFilterDropdown(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border rounded-xl transition-all ${filterStatus !== 'all' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">
                {filterStatus === 'all' ? 'Status' : filterStatus === 'published' ? 'Published' : 'Drafts'}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-40 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => { setFilterStatus('all'); setShowFilterDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${filterStatus === 'all' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  All Status
                </button>
                <button
                  onClick={() => { setFilterStatus('published'); setShowFilterDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${filterStatus === 'published' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  Published
                </button>
                <button
                  onClick={() => { setFilterStatus('draft'); setShowFilterDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${filterStatus === 'draft' ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  Drafts
                </button>
              </div>
            )}
          </div>

          {/* Tag Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowTagFilterDropdown(!showTagFilterDropdown);
                setShowSortDropdown(false);
                setShowFilterDropdown(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border rounded-xl transition-all ${filterTagId ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]'}`}
            >
              <TagIcon className="w-4 h-4" />
              <span className="text-sm">
                {filterTagId ? tags.find(t => t.id === filterTagId)?.name || 'Tag' : 'Tag'}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showTagFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setFilterTagId(null); setShowTagFilterDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${!filterTagId ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                >
                  All Tags
                </button>
                {tags.length === 0 ? (
                  <div className="px-4 py-2.5 text-sm text-[var(--dash-text-tertiary)]">
                    No tags available
                  </div>
                ) : (
                  tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => { setFilterTagId(tag.id); setShowTagFilterDropdown(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-hover)] ${filterTagId === tag.id ? 'text-[var(--brand)] bg-[var(--brand)]/5' : 'text-[var(--dash-text-secondary)]'}`}
                    >
                      {tag.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Clear Filters Button - shows when any filter is active */}
          {(filterStatus !== 'all' || filterTagId || selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterTagId(null);
                setSelectedCategory('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm text-[var(--dash-text-secondary)] hover:border-[var(--status-error)] hover:text-[var(--status-error)] transition-all"
              title="Clear all filters"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          )}
          
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
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[var(--brand)]">
                ({selectedIds.size} selected)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-[var(--status-success)]" /> Published</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[var(--dash-text-muted)]" /> Draft</span>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[var(--brand)]/10 border border-[var(--brand)]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--brand)]">
              {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMoveCategoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
            >
              <FolderInput className="w-4 h-4" />
              Assign a Category
            </button>
            <button
              onClick={() => setAssignTagsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
            >
              <TagIcon className="w-4 h-4" />
              Assign Tag
            </button>
            <button
              onClick={() => setAddToCollectionModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
            >
              <Library className="w-4 h-4" />
              Add to Collection
            </button>
            <button
              onClick={() => setBulkDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 rounded-lg text-sm text-[var(--status-error)] hover:bg-[var(--status-error)] hover:text-white transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-1 min-h-0 flex-col gap-4">
        {/* Documents List/Grid */}
        {viewMode === 'list' ? (
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[minmax(0,3.5fr)_1fr_1.5fr_0.8fr_0.8fr_0.8fr_1.5fr_0.8fr] gap-4 px-6 py-3 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)] text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSelectAll(filteredDocIds)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                  title={allFilteredSelected ? "Deselect all" : "Select all"}
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                  ) : someFilteredSelected ? (
                    <Minus className="w-4 h-4 text-[var(--brand)]" />
                  ) : (
                    <Square className="w-4 h-4 text-[var(--dash-text-muted)]" />
                  )}
                </button>
                Document
              </div>
              <div>Category</div>
              <div>Tags</div>
              <div className="text-center">Visibility</div>
              <div className="text-center">Status</div>
              <div className="text-center">AI Score</div>
              <div>Updated</div>
              <div className="text-right">Views</div>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)] flex-1 min-h-0 overflow-auto">
              {filteredDocs.map((doc) => (
                <Link key={doc.id} href={`/dashboard/knowledge/${doc.id}`}>
                  <div className="block hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group">
                    {/* Desktop Table View */}
                    <div className="hidden md:grid grid-cols-[minmax(0,3.5fr)_1fr_1.5fr_0.8fr_0.8fr_0.8fr_1.5fr_0.8fr] gap-4 px-6 py-4 items-center">
                      {/* Document Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={(e) => handleSelectDocument(doc.id, e)}
                          className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          {selectedIds.has(doc.id) ? (
                            <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-text-secondary)]" />
                          )}
                        </button>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: categories.find(c => c.id === doc.categoryId)?.color + '15' }}>
                          <FileText className="w-5 h-5" style={{ color: categories.find(c => c.id === doc.categoryId)?.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] truncate">
                              {doc.title}
                            </h3>
                            {doc.starred && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-[var(--dash-text-tertiary)] truncate flex-1">{doc.description}</p>
                          </div>
                        </div>
                      </div>
                      {/* Category */}
                      <div>
                        <span className="text-sm text-[var(--dash-text-secondary)]">{categories.find(c => c.id === doc.categoryId)?.name || 'Uncategorized'}</span>
                      </div>
                      {/* Tags */}
                      <div>
                        {doc.tags?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.slice(0, 2).map((tag) => (
                              <span key={tag.id} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-[var(--surface-hover)] text-[var(--dash-text-secondary)]">
                                {tag.name}
                              </span>
                            ))}
                            {doc.tags.length > 2 && (
                              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)]">
                                +{doc.tags.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--dash-text-tertiary)]">-</span>
                        )}
                      </div>
                      {/* Visibility */}
                      <div className="text-center">
                        <span
                          className="inline-flex items-center justify-center"
                          title={getVisibilityLabel(doc.visibility)}
                        >
                          {getVisibilityIcon(doc.visibility)}
                        </span>
                      </div>
                      {/* Status */}
                      <div className="text-center">
                        <span className={`inline-flex px-3 py-1.5 text-xs font-medium rounded-full ${getStateColor(doc.state)}`}>
                          {doc.state.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                      {/* AI Score */}
                      <div className="text-center">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${getAiScoreColor(doc.aiScore)}`}>
                          <Sparkles className="w-3.5 h-3.5" />
                          {doc.aiScore !== null ? `${doc.aiScore}%` : '--'}
                          <span className="text-[var(--dash-text-muted)] font-normal">·</span>
                          <span className="text-xs">{getAiScoreLabel(doc.aiScore)}</span>
                        </span>
                      </div>
                      {/* Updated */}
                      <div>
                        <p className="text-sm text-[var(--dash-text-secondary)]">{doc.updatedAt}</p>
                        <p className="text-xs text-[var(--dash-text-muted)]">by {doc.lastEditor}</p>
                      </div>
                      {/* Views */}
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
                          <Eye className="w-3.5 h-3.5" />
                          {doc.views.toLocaleString()}
                        </div>
                        <button
                          className="p-1.5 rounded-lg hover:bg-[var(--status-error-bg)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] ml-2 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={(e) => handleDeleteClick(doc, e)}
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="flex md:hidden flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            onClick={(e) => handleSelectDocument(doc.id, e)}
                            className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors mt-1"
                          >
                            {selectedIds.has(doc.id) ? (
                              <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                            ) : (
                              <Square className="w-4 h-4 text-[var(--dash-text-muted)]" />
                            )}
                          </button>
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: categories.find(c => c.id === doc.categoryId)?.color + '15' }}>
                            <FileText className="w-5 h-5" style={{ color: categories.find(c => c.id === doc.categoryId)?.color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-medium text-[var(--dash-text-primary)] text-sm line-clamp-1">{doc.title}</h3>
                              {doc.starred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${getStateColor(doc.state)}`}>
                                {doc.state.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                              <span className={`text-xs flex items-center gap-1 ${getAiScoreColor(doc.aiScore)}`}>
                                <Sparkles className="w-3 h-3" /> {doc.aiScore !== null ? `${doc.aiScore}%` : '--'} · {getAiScoreLabel(doc.aiScore)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          className="p-1 text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-lg transition-all"
                          onClick={(e) => handleDeleteClick(doc, e)}
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] pt-2 border-t border-[var(--dash-border-subtle)]">
                        <span className="truncate max-w-[120px]">by {doc.lastEditor}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {doc.views}</span>
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
                  <div className={`bg-[var(--surface-card)] border rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col ${selectedIds.has(doc.id) ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/20' : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleSelectDocument(doc.id, e)}
                          className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          {selectedIds.has(doc.id) ? (
                            <CheckSquare className="w-5 h-5 text-[var(--brand)]" />
                          ) : (
                            <Square className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-text-secondary)]" />
                          )}
                        </button>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: categories.find(c => c.id === doc.categoryId)?.color + '15' }}>
                          <FileText className="w-6 h-6" style={{ color: categories.find(c => c.id === doc.categoryId)?.color }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.starred && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${getStateColor(doc.state)}`}>
                          {doc.state.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-[var(--dash-text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-2 mb-4 flex-1">{doc.description}</p>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)] mb-3">
                      <span className="flex items-center gap-1" title={getVisibilityLabel(doc.visibility)}>
                        {getVisibilityIcon(doc.visibility)}
                        {doc.visibility.charAt(0).toUpperCase() + doc.visibility.slice(1)}
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${getAiScoreColor(doc.aiScore)}`}>
                        <Sparkles className="w-3 h-3" />
                        {doc.aiScore !== null ? `${doc.aiScore}%` : '--'} · {getAiScoreLabel(doc.aiScore)}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-[var(--dash-text-muted)] pt-3 border-t border-[var(--dash-border-subtle)]">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {doc.views.toLocaleString()}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Document"
        description="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to delete <span className="font-semibold text-[var(--dash-text-primary)]">"{documentToDelete?.title}"</span>?
          </p>
          <p className="text-sm text-[var(--status-error)]">
            This will permanently remove the document and all its content.
          </p>
        </div>
        
        <ModalFooter>
          <button
            onClick={handleDeleteCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--status-error)] rounded-lg hover:bg-[var(--status-error)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Document
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Document Import Modal */}
      <DocumentImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={(documentId) => {
          setImportModalOpen(false);
          window.location.reload();
        }}
      />

      {/* Move to Category Modal */}
      <Modal
        isOpen={moveCategoryModalOpen}
        onClose={closeMoveCategoryModal}
        title={moveCategorySuccess ? 'Category Assigned' : 'Assign a Category'}
        description={moveCategorySuccess 
          ? `Successfully assigned documents to ${moveCategoryTargetName}`
          : `Assign ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} a category`
        }
        size="sm"
      >
        {moveCategorySuccess ? (
          // Success Confirmation Screen
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                Success!
              </h3>
              <p className="text-sm text-[var(--dash-text-secondary)]">
                {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} moved to <strong>{moveCategoryTargetName}</strong>
              </p>
            </div>
            
            <ModalFooter>
              <button
                onClick={closeMoveCategoryModal}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Done
              </button>
            </ModalFooter>
          </div>
        ) : (
          // Category Selection Screen
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--dash-text-primary)]">Select Category</label>
              <select
                value={selectedCategoryForMove || ''}
                onChange={(e) => setSelectedCategoryForMove(e.target.value || null)}
                className="w-full px-3 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              >
                <option value="">Select a category...</option>
                <option value="none">Remove from category</option>
                {apiCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <ModalFooter>
              <button
                onClick={closeMoveCategoryModal}
                disabled={bulkActionLoading}
                className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkMoveCategory}
                disabled={bulkActionLoading || !selectedCategoryForMove}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Moving...
                  </>
                ) : (
                  <>
                    <FolderInput className="w-4 h-4" />
                    Assign Category
                  </>
                )}
              </button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Assign Tag Modal */}
      <Modal
        isOpen={assignTagsModalOpen}
        onClose={() => {
          setAssignTagsModalOpen(false);
          setSelectedTagId(null);
        }}
        title="Assign a Tag"
        description={`Add a tag to ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--dash-text-primary)]">Select Tag</label>
            {(() => {
              // Get tags already assigned to all selected documents
              const selectedDocs = documents.filter(d => selectedIds.has(d.id));
              const alreadyAssignedTagIds = new Set(
                tags.filter(tag =>
                  selectedDocs.length > 0 &&
                  selectedDocs.every(doc => doc.tags.some(t => t.id === tag.id))
                ).map(tag => tag.id)
              );
              const availableTags = tags.filter(tag => !alreadyAssignedTagIds.has(tag.id));

              if (availableTags.length === 0) {
                return (
                  <p className="text-sm text-[var(--dash-text-tertiary)]">
                    No available tags to assign. All tags are already assigned to the selected documents.
                  </p>
                );
              }

              return (
                <select
                  value={selectedTagId || ''}
                  onChange={(e) => setSelectedTagId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                >
                  <option value="">Select a tag...</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              );
            })()}
          </div>
        </div>
        
        <ModalFooter>
          <button
            onClick={() => {
              setAssignTagsModalOpen(false);
              setSelectedTagId(null);
            }}
            disabled={bulkActionLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkAssignTag}
            disabled={bulkActionLoading || !selectedTagId}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {bulkActionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <TagIcon className="w-4 h-4" />
                Assign Tag
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Add to Collection Modal */}
      <Modal
        isOpen={addToCollectionModalOpen}
        onClose={closeAddToCollectionModal}
        title="Add to a collection"
        description={addToCollectionSuccess ? '' : `Add ${selectedIds.size} documents to a collection`}
        size="sm"
      >
        {addToCollectionSuccess ? (
          // Success Confirmation Screen
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                Success!
              </h3>
              <p className="text-sm text-[var(--dash-text-secondary)]">
                {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} added to <strong>{addToCollectionTargetName}</strong>
              </p>
            </div>
            
            <ModalFooter>
              <button
                onClick={closeAddToCollectionModal}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Done
              </button>
            </ModalFooter>
          </div>
        ) : (
          // Collection Selection Screen
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--dash-text-primary)]">Select Collection</label>
              {collections.length === 0 ? (
                <p className="text-sm text-[var(--dash-text-tertiary)]">
                  No collections available. <Link href="/dashboard/knowledge/collections" className="text-[var(--brand)] hover:underline">Create a collection</Link> first.
                </p>
              ) : (
                <select
                  value={selectedCollectionId || ''}
                  onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>{collection.name}</option>
                  ))}
                </select>
              )}
            </div>
            
            <ModalFooter>
              <button
                onClick={closeAddToCollectionModal}
                disabled={bulkActionLoading}
                className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAddToCollection}
                disabled={bulkActionLoading || !selectedCollectionId}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Library className="w-4 h-4" />
                    Add to Collection
                  </>
                )}
              </button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        title="Delete documents"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[var(--status-error)]">
            This action cannot be undone.
          </p>
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to delete these {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''}? This will permanently remove all of the selected documents and their content.
          </p>
        </div>
        
        <ModalFooter>
          <button
            onClick={() => setBulkDeleteModalOpen(false)}
            disabled={bulkActionLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkActionLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--status-error)] rounded-lg hover:bg-[var(--status-error)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {bulkActionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

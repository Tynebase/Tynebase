"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Edit3,
  Trash2,
  ChevronRight,
  Folder,
  FolderPlus,
  Loader2,
  AlertCircle,
  X,
  Book,
  Bookmark,
  Box,
  Briefcase,
  Code,
  Cog,
  Database,
  Globe,
  Heart,
  Home,
  Image,
  Key,
  Layers,
  Lock,
  Mail,
  Map,
  MessageSquare,
  Music,
  Package,
  Shield,
  Star,
  Tag,
  Users,
  Zap,
  Sparkles,
  Filter,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";
import { 
  listCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  getCategoryDocuments,
  type Category as APICategory,
  type DeleteCategoryResult 
} from "@/lib/api/folders";

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return diffMins === 0 ? 'Just now' : `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

const CATEGORY_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', 
  '#10b981', '#f59e0b', '#ef4444', '#6366f1',
];

const CATEGORY_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'folder', icon: Folder },
  { name: 'book', icon: Book },
  { name: 'bookmark', icon: Bookmark },
  { name: 'box', icon: Box },
  { name: 'briefcase', icon: Briefcase },
  { name: 'code', icon: Code },
  { name: 'cog', icon: Cog },
  { name: 'database', icon: Database },
  { name: 'file-text', icon: FileText },
  { name: 'globe', icon: Globe },
  { name: 'heart', icon: Heart },
  { name: 'home', icon: Home },
  { name: 'image', icon: Image },
  { name: 'key', icon: Key },
  { name: 'layers', icon: Layers },
  { name: 'lock', icon: Lock },
  { name: 'mail', icon: Mail },
  { name: 'map', icon: Map },
  { name: 'message-square', icon: MessageSquare },
  { name: 'music', icon: Music },
  { name: 'package', icon: Package },
  { name: 'shield', icon: Shield },
  { name: 'star', icon: Star },
  { name: 'tag', icon: Tag },
  { name: 'users', icon: Users },
  { name: 'zap', icon: Zap },
];

const getIconComponent = (iconName: string): LucideIcon => {
  const found = CATEGORY_ICONS.find(i => i.name === iconName);
  return found?.icon || Folder;
};

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<APICategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [categoryIcon, setCategoryIcon] = useState('folder');
  const [categories, setCategories] = useState<APICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<APICategory | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'migrate'>('confirm');
  const [selectedTargetCategory, setSelectedTargetCategory] = useState<string>('uncategorized');
  const [categoryDocuments, setCategoryDocuments] = useState<{id: string, title: string}[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteCategoryResult | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listCategories({ limit: 100 });
      setCategories(response.categories);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort states
  const [sortBy, setSortBy] = useState<'name' | 'documents' | 'created' | 'updated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    let result = categories.filter(category =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'documents') {
        comparison = (a.document_count || 0) - (b.document_count || 0);
      } else if (sortBy === 'created') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'updated') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [categories, searchQuery, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchQuery('');
    setSortBy('name');
    setSortOrder('asc');
  };

  const hasActiveFilters = searchQuery || sortBy !== 'name' || sortOrder !== 'asc';

  const toggleExpand = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalDocuments = categories.reduce((sum, c) => sum + (c.document_count || 0), 0);
  const totalSubcategories = categories.reduce((sum, c) => sum + (c.subcategory_count || 0), 0);

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryColor(CATEGORY_COLORS[0]);
    setCategoryIcon('folder');
    setShowCategoryModal(true);
  };

  const openEditModal = (category: APICategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setCategoryColor(category.color);
    setCategoryIcon(category.icon || 'folder');
    setShowCategoryModal(true);
  };

  const closeModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryColor(CATEGORY_COLORS[0]);
    setCategoryIcon('folder');
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    
    try {
      setSaving(true);
      setError(null);
      
      if (editingCategory) {
        const response = await updateCategory(editingCategory.id, {
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          color: categoryColor,
          icon: categoryIcon,
        });
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? response.category : c));
      } else {
        const response = await createCategory({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          color: categoryColor,
          icon: categoryIcon,
        });
        setCategories(prev => [response.category, ...prev]);
      }
      
      closeModal();
    } catch (err) {
      console.error('Failed to save category:', err);
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = async (category: APICategory) => {
    setDeletingCategory(category);
    setDeleteStep('confirm');
    setSelectedTargetCategory('uncategorized');
    setDeleteResult(null);
    setShowDeleteModal(true);
    
    // Load documents in this category
    if ((category.document_count || 0) > 0) {
      setLoadingDocuments(true);
      try {
        const result = await getCategoryDocuments(category.id);
        setCategoryDocuments(result.documents.map(d => ({ id: d.id, title: d.title })));
      } catch (err) {
        console.error('Failed to load category documents:', err);
      } finally {
        setLoadingDocuments(false);
      }
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingCategory(null);
    setDeleteStep('confirm');
    setSelectedTargetCategory('uncategorized');
    setCategoryDocuments([]);
    setDeleteResult(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    
    const hasDocuments = (deletingCategory.document_count || 0) > 0;
    const hasSubcategories = (deletingCategory.subcategory_count || 0) > 0;
    
    if (hasDocuments || hasSubcategories) {
      setDeleteStep('migrate');
    } else {
      // No documents or subcategories, delete immediately
      await executeDelete();
    }
  };

  const executeDelete = async () => {
    if (!deletingCategory) return;
    
    try {
      setDeleting(deletingCategory.id);
      
      // Determine target category ID
      let targetId: string | null = null;
      if (selectedTargetCategory === 'uncategorized') {
        targetId = null; // Will use Uncategorised
      } else if (selectedTargetCategory.startsWith('category:')) {
        targetId = selectedTargetCategory.replace('category:', '');
      }
      
      const result = await deleteCategory(deletingCategory.id, targetId);
      setDeleteResult(result);
      
      // Remove from list immediately after success
      setCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
      // Modal stays open to show success - user clicks button to close
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // This is now replaced by openDeleteModal - keeping for compatibility
    const category = categories.find(c => c.id === id);
    if (category) {
      openDeleteModal(category);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex min-h-full flex-col px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Categories</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Organise your documentation into logical groups
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 h-10 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium transition-all"
        >
          <FolderPlus className="w-4 h-4" />
          New Category
        </button>
      </div>

      <div className="h-8" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <Folder className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{categories.length}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Categories</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-purple-500/10">
            <FileText className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{totalDocuments}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Total Documents</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-green-500/10">
            <FolderOpen className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{totalSubcategories}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Subcategories</p>
          </div>
        </div>
      </div>

      <div className="h-8" />

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>
        
        {/* Filter Dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-2 h-10 px-4 border rounded-lg text-sm font-medium transition-all ${
              hasActiveFilters
                ? 'bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)]'
                : 'bg-[var(--surface-card)] border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
            )}
          </button>

          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-20 p-4 space-y-4">
              {/* Sort By */}
              <div>
                <label className="block text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <div className="space-y-1">
                  {[
                    { value: 'name', label: 'Name' },
                    { value: 'documents', label: 'Document count' },
                    { value: 'created', label: 'Most recently created' },
                    { value: 'updated', label: 'Last updated' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value as typeof sortBy)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                          : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortBy === option.value && <ArrowUpDown className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider mb-2">
                  Order
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortOrder('asc')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortOrder === 'asc'
                        ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                        : 'bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    A-Z / Oldest first
                  </button>
                  <button
                    onClick={() => setSortOrder('desc')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortOrder === 'desc'
                        ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                        : 'bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    Z-A / Newest first
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    clearFilters();
                    setShowFilterDropdown(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-6" />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <span className="ml-3 text-[var(--dash-text-secondary)]">Loading categories...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--status-error)] mb-1">Failed to load categories</h3>
            <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="w-16 h-16 text-[var(--dash-text-muted)] mb-4" />
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
            {searchQuery 
              ? 'No categories found. Try adjusting your search query.' 
              : 'There are no categories yet, click + New Category to create one'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              New Category
            </button>
          )}
        </div>
      )}

      {/* Categories List */}
      {!loading && !error && filteredCategories.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex-1 min-h-0">
          {/* Table Header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[2rem_2.5rem_1fr_8rem_3rem_7rem] items-center gap-3 px-4 py-2.5 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
            <span />
            <span />
            <span className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider">Category</span>
            <span className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider">Updated</span>
            <span className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider text-center">Docs</span>
            <span className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wider text-right">Actions</span>
          </div>

          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories.includes(category.id);
              const hasSubcategories = (category.subcategory_count || 0) > 0;

              return (
                <div key={category.id}>
                  <div className="p-4 hover:bg-[var(--surface-hover)] transition-colors group">
                    {/* Desktop grid layout */}
                    <div className="hidden sm:grid sm:grid-cols-[2rem_2.5rem_1fr_8rem_3rem_7rem] items-center gap-3">
                      {/* Expand chevron column */}
                      <div className="flex items-center justify-center">
                        {hasSubcategories ? (
                          <button
                            onClick={() => toggleExpand(category.id)}
                            className="p-1 rounded-lg hover:bg-[var(--surface-ground)]"
                          >
                            <ChevronRight className={`w-4 h-4 text-[var(--dash-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>

                      {/* Icon column */}
                      {(() => {
                        const IconComponent = getIconComponent(category.icon || 'folder');
                        return (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${category.color}15` }}
                          >
                            <IconComponent className="w-5 h-5" style={{ color: category.color }} />
                          </div>
                        );
                      })()}

                      {/* Name + description column */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{category.name}</h3>
                          <span className="px-2 py-0.5 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] rounded-full flex-shrink-0">
                            {category.document_count || 0} docs
                          </span>
                        </div>
                        {category.description && (
                          <p className="text-sm text-[var(--dash-text-tertiary)] mt-0.5 truncate">
                            {category.description}
                          </p>
                        )}
                      </div>

                      {/* Updated column */}
                      <p className="text-sm text-[var(--dash-text-muted)] truncate">
                        {formatRelativeTime(category.updated_at)}
                      </p>

                      {/* View docs column */}
                      <div className="flex items-center justify-center">
                        <Link
                          href={`/dashboard/knowledge?category=${category.id}`}
                          className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                          title="View documents"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                      </div>

                      {/* Actions column */}
                      <div className="flex items-center gap-0.5 justify-end">
                        <Link
                          href={`/dashboard/ai-assistant?category=${category.id}&categoryName=${encodeURIComponent(category.name)}`}
                          className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                          title="Generate content for this category"
                        >
                          <Sparkles className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(category)}
                          className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                          title="Edit category"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(category)}
                          disabled={deleting === category.id || category.is_system}
                          className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] disabled:opacity-50"
                          title={category.is_system ? 'System categories cannot be deleted' : 'Delete category'}
                        >
                          {deleting === category.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Mobile layout */}
                    <div className="flex items-center gap-3 sm:hidden">
                      {(() => {
                        const IconComponent = getIconComponent(category.icon || 'folder');
                        return (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${category.color}15` }}
                          >
                            <IconComponent className="w-5 h-5" style={{ color: category.color }} />
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{category.name}</h3>
                        <p className="text-xs text-[var(--dash-text-muted)] mt-0.5">
                          {category.document_count || 0} docs &middot; {formatRelativeTime(category.updated_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => setMobileMenuOpen(mobileMenuOpen === category.id ? null : category.id)}
                        className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mobile Action Menu */}
                    {mobileMenuOpen === category.id && (
                      <div className="sm:hidden mt-3 pt-3 border-t border-[var(--dash-border-subtle)]">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/knowledge?category=${category.id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] text-sm"
                            onClick={() => setMobileMenuOpen(null)}
                          >
                            <FileText className="w-4 h-4" />
                            View
                          </Link>
                          <Link
                            href={`/dashboard/ai-assistant?category=${category.id}&categoryName=${encodeURIComponent(category.name)}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] text-sm"
                            onClick={() => setMobileMenuOpen(null)}
                          >
                            <Sparkles className="w-4 h-4" />
                            Generate
                          </Link>
                          <button
                            onClick={() => {
                              setMobileMenuOpen(null);
                              openEditModal(category);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] text-sm"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                          <button 
                            onClick={() => {
                              setMobileMenuOpen(null);
                              openDeleteModal(category);
                            }}
                            disabled={category.is_system}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--status-error)] disabled:opacity-50 text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subcategories placeholder - would need additional API call */}
                  {hasSubcategories && isExpanded && (
                    <div className="bg-[var(--surface-ground)] border-t border-[var(--dash-border-subtle)] px-4 py-3 pl-16">
                      <p className="text-sm text-[var(--dash-text-tertiary)]">
                        {category.subcategory_count || 0} subcategory(s) - expand to view
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            {deleteResult ? (
              // Success State
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--dash-text-primary)] mb-2">
                  Category Deleted
                </h2>
                <p className="text-[var(--dash-text-secondary)] mb-4">
                  <strong>{deleteResult.categoryName}</strong> has been successfully deleted.
                </p>
                {deleteResult.migrated.documents > 0 && (
                  <p className="text-sm text-[var(--dash-text-tertiary)] mb-6">
                    {deleteResult.migrated.documents} document(s) moved to{' '}
                    <strong>{deleteResult.migrated.toCategory?.name || 'Uncategorised'}</strong>
                  </p>
                )}
                <button
                  onClick={closeDeleteModal}
                  className="h-11 px-8 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-semibold transition-all"
                >
                  Continue
                </button>
              </div>
            ) : deleteStep === 'confirm' ? (
              // Confirm Step
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">
                      Delete Category?
                    </h2>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">
                      {deletingCategory.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <p className="text-[var(--dash-text-secondary)]">
                    Are you sure you want to delete this category? This action cannot be undone.
                  </p>
                  
                  {/* Document Reassignment Notice */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                    <FolderOpen className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-600">
                      Documents and subcategories can be allocated to a new category.
                    </p>
                  </div>

                  {/* Content Summary */}
                  <div className="bg-[var(--surface-ground)] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">
                      Category Contents:
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--dash-text-muted)]" />
                        <span className="text-[var(--dash-text-primary)]">
                          {deletingCategory.document_count || 0} documents
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-[var(--dash-text-muted)]" />
                        <span className="text-[var(--dash-text-primary)]">
                          {deletingCategory.subcategory_count || 0} subcategories
                        </span>
                      </div>
                    </div>
                    
                    {loadingDocuments && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading documents...
                      </div>
                    )}
                  </div>

                  {/* Warning for system categories */}
                  {deletingCategory.is_system && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600">
                        This is a system category and cannot be deleted.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={closeDeleteModal}
                    disabled={deleting === deletingCategory.id}
                    className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting === deletingCategory.id || deletingCategory.is_system}
                    className="flex-1 h-11 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {deleting === deletingCategory.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Next'
                    )}
                  </button>
                </div>
              </>
            ) : (
              // Migrate Step
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">
                      Move Documents
                    </h2>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">
                      Choose where to migrate content
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <p className="text-[var(--dash-text-secondary)]">
                    <strong>{deletingCategory.name}</strong> contains{' '}
                    <strong>{deletingCategory.document_count || 0} documents</strong> and{' '}
                    <strong>{deletingCategory.subcategory_count || 0} subcategories</strong>.
                    Where would you like to move them?
                  </p>

                  {/* Migration Options */}
                  <div className="space-y-2">
                    {/* Uncategorised Option */}
                    <label className="flex items-start gap-3 p-4 bg-[var(--surface-ground)] rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-colors">
                      <input
                        type="radio"
                        name="targetCategory"
                        value="uncategorized"
                        checked={selectedTargetCategory === 'uncategorized'}
                        onChange={(e) => setSelectedTargetCategory(e.target.value)}
                        className="mt-1 w-4 h-4 text-[var(--brand)]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Folder className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-[var(--dash-text-primary)]">
                            Uncategorised (Default)
                          </span>
                        </div>
                        <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
                          Move all documents to the default Uncategorised category
                        </p>
                      </div>
                    </label>

                    {/* Other Categories */}
                    {categories
                      .filter(c => c.id !== deletingCategory.id && !c.is_system)
                      .map(category => (
                        <label
                          key={category.id}
                          className="flex items-start gap-3 p-4 bg-[var(--surface-ground)] rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <input
                            type="radio"
                            name="targetCategory"
                            value={`category:${category.id}`}
                            checked={selectedTargetCategory === `category:${category.id}`}
                            onChange={(e) => setSelectedTargetCategory(e.target.value)}
                            className="mt-1 w-4 h-4 text-[var(--brand)]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const IconComponent = getIconComponent(category.icon || 'folder');
                                return (
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${category.color}15` }}
                                  >
                                    <IconComponent className="w-4 h-4" style={{ color: category.color }} />
                                  </div>
                                );
                              })()}
                              <span className="font-medium text-[var(--dash-text-primary)]">
                                {category.name}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
                              {category.document_count || 0} documents, {category.subcategory_count || 0} subcategories
                            </p>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDeleteStep('confirm')}
                    disabled={deleting === deletingCategory.id}
                    className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={executeDelete}
                    disabled={deleting === deletingCategory.id}
                    className="flex-1 h-11 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {deleting === deletingCategory.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Migrating & Deleting...
                      </>
                    ) : (
                      'Confirm & Delete'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
              <button
                onClick={closeModal}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g., API Documentation"
                  disabled={saving}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="Brief description of this category..."
                  rows={3}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {CATEGORY_ICONS.map(({ name, icon: IconComponent }) => (
                    <button
                      key={name}
                      onClick={() => setCategoryIcon(name)}
                      disabled={saving}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        categoryIcon === name
                          ? 'bg-[var(--brand)] text-white ring-2 ring-offset-2 ring-[var(--brand)]'
                          : 'bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                      title={name}
                    >
                      <IconComponent className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCategoryColor(color)}
                      disabled={saving}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        categoryColor === color ? 'ring-2 ring-offset-2 ring-[var(--brand)]' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Preview
                </label>
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-ground)] rounded-xl">
                  {(() => {
                    const PreviewIcon = getIconComponent(categoryIcon);
                    return (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${categoryColor}15` }}
                      >
                        <PreviewIcon className="w-5 h-5" style={{ color: categoryColor }} />
                      </div>
                    );
                  })()}
                  <span className="font-medium text-[var(--dash-text-primary)]">
                    {categoryName || 'Category Name'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={!categoryName.trim() || saving}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editingCategory ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  editingCategory ? 'Save Changes' : 'Create Category'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

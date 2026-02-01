"use client";

import { useState, useEffect } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { listCategories, createCategory, updateCategory, deleteCategory, type Category as APICategory } from "@/lib/api/folders";

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

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? It must be empty.')) return;
    
    try {
      setDeleting(id);
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex min-h-full flex-col px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/knowledge" className="hover:text-[var(--brand)]">Knowledge Base</Link>
            <span>/</span>
            <span>Categories</span>
          </div>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
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
          <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
            {searchQuery ? 'No categories found' : 'No categories yet'}
          </h3>
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
            {searchQuery ? 'Try adjusting your search query.' : 'Create your first category to start organizing your documents.'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              Create Category
            </button>
          )}
        </div>
      )}

      {/* Categories List */}
      {!loading && !error && filteredCategories.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex-1 min-h-0">
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories.includes(category.id);
              const hasSubcategories = (category.subcategory_count || 0) > 0;

              return (
                <div key={category.id}>
                  <div className="p-4 hover:bg-[var(--surface-hover)] transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        {hasSubcategories ? (
                          <button
                            onClick={() => toggleExpand(category.id)}
                            className="p-2 -m-1 rounded-lg hover:bg-[var(--surface-ground)]"
                          >
                            <ChevronRight className={`w-4 h-4 text-[var(--dash-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        ) : (
                          <div className="w-6 hidden sm:block" />
                        )}

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
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-[var(--dash-text-primary)]">{category.name}</h3>
                            <span className="px-2 py-0.5 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] rounded-full">
                              {category.document_count || 0} docs
                            </span>
                          </div>
                          {category.description && (
                            <p className="text-sm text-[var(--dash-text-tertiary)] mt-0.5 truncate sm:hidden lg:block">
                              {category.description}
                            </p>
                          )}
                        </div>

                        <button className="sm:hidden p-2 text-[var(--dash-text-tertiary)] ml-auto">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-sm text-[var(--dash-text-muted)] flex-shrink-0 hidden sm:block">
                        Updated {formatRelativeTime(category.updated_at)}
                      </p>

                      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/dashboard/knowledge?category=${category.id}`}
                          className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(category)}
                          className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(category.id)}
                          disabled={deleting === category.id}
                          className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] disabled:opacity-50"
                        >
                          {deleting === category.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
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

      {/* Category Modal (Create/Edit) */}
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

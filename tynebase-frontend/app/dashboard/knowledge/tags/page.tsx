"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hash, Plus, Search, Sparkles, FileText, ArrowRight, TrendingUp, Filter, Loader2, AlertCircle, Trash2, ChevronDown, RotateCcw, Pencil, Tag as TagIcon, X, CheckCircle, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { listTags, createTag, deleteTag, updateTag, addTagToDocuments, reorderTags, type Tag as APITag } from "@/lib/api/tags";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Tag = {
  id: string;
  name: string;
  description: string;
  documents: number;
  updatedAt: string;
  trend: "up" | "flat" | "down";
  aiSuggested?: boolean;
  sortOrder?: number;
};

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

const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const mapAPITagToUI = (tag: APITag): Tag => ({
  id: tag.id,
  name: capitalizeFirstLetter(tag.name),
  description: tag.description || '',
  documents: tag.document_count,
  updatedAt: formatRelativeTime(tag.updated_at),
  trend: 'flat',
  aiSuggested: false,
  sortOrder: tag.sort_order ?? undefined,
});

function TrendBadge({ trend }: { trend: Tag["trend"] }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success)]">
        <TrendingUp className="w-3 h-3" />
        Trending
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--status-error-bg)] text-[var(--status-error)]">
        Cooling
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
      Stable
    </span>
  );
}

interface SortableTagCardProps {
  tag: Tag;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  onAssign: (tag: Tag) => void;
}

function SortableTagCard({ tag, onEdit, onDelete, onAssign }: SortableTagCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
      <Card className="hover:shadow-lg hover:border-[var(--brand)] transition-all group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <button
                  {...attributes}
                  {...listeners}
                  className="p-1 rounded-lg cursor-grab active:cursor-grabbing text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] transition-all opacity-0 group-hover:opacity-100"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <span className="w-10 h-10 rounded-xl bg-[var(--surface-ground)] flex items-center justify-center flex-shrink-0">
                  <Hash className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--dash-text-primary)] truncate">#{tag.name}</h3>
                  <p className="text-xs text-[var(--dash-text-muted)]">{tag.documents} docs</p>
                </div>
              </div>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-3 line-clamp-2">{tag.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <TrendBadge trend={tag.trend} />
              {tag.aiSuggested && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[var(--brand)]/10 text-[var(--brand)]">
                  <Sparkles className="w-3 h-3" />
                  AI
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-[var(--dash-text-muted)]">Updated {tag.updatedAt}</span>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/knowledge?tag=${tag.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
              >
                View Docs
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => onAssign(tag)}
                className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--brand)] hover:bg-[var(--surface-hover)] transition-all"
                title="Assign to documents"
              >
                <TagIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit(tag)}
                className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--brand)] hover:bg-[var(--surface-hover)] transition-all"
                title="Edit tag"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(tag)}
                className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                title="Delete tag"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TagsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer' && !user?.is_super_admin;
  const [query, setQuery] = useState("");
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
  // Edit modal state
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Delete confirmation state
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Assign modal state
  const [assigningTag, setAssigningTag] = useState<Tag | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [availableDocs, setAvailableDocs] = useState<{id: string; title: string; selected: boolean}[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssignSuccess, setShowAssignSuccess] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter states
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'documents' | 'updated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showUnused, setShowUnused] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await listTags({ limit: 100 });
        const uiTags = response.tags.map(mapAPITagToUI);
        setTags(uiTags);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  const filtered = useMemo(() => {
    let result = tags;
    
    // Search filter
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
    }
    
    // Show unused/used filter
    if (showUnused === true) {
      result = result.filter((t) => t.documents === 0);
    } else if (showUnused === false) {
      result = result.filter((t) => t.documents > 0);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'documents') {
        comparison = a.documents - b.documents;
      } else if (sortBy === 'updated') {
        // Sort by updatedAt string (which is relative time, so we need to compare original)
        comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [query, tags, sortBy, sortOrder, showUnused]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      setCreating(true);
      setError(null);
      const response = await createTag({
        name: newTagName.trim(),
        description: newTagDescription.trim() || undefined,
      });
      
      const newTag = mapAPITagToUI(response.tag);
      setTags(prev => [newTag, ...prev]);
      
      // Reset form and close modal
      setNewTagName("");
      setNewTagDescription("");
      setShowNewTagModal(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setCreating(false);
    }
  };

  // Edit tag handlers
  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditDescription(tag.description);
    setError(null);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editName.trim()) return;
    
    try {
      setSavingEdit(true);
      setError(null);
      const response = await updateTag(editingTag.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      
      const updatedTag = mapAPITagToUI(response.tag);
      setTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t));
      setEditingTag(null);
    } catch (err) {
      console.error('Failed to update tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete tag handlers
  const openDeleteModal = (tag: Tag) => {
    setDeletingTag(tag);
    setError(null);
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    
    try {
      setDeleting(true);
      setError(null);
      await deleteTag(deletingTag.id);
      setTags(prev => prev.filter(t => t.id !== deletingTag.id));
      setDeletingTag(null);
    } catch (err) {
      console.error('Failed to delete tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  // Assign tag handlers
  const openAssignModal = async (tag: Tag) => {
    setAssigningTag(tag);
    setAssignQuery("");
    setAvailableDocs([]);
    setError(null);
    
    // Fetch available documents
    try {
      setLoadingDocs(true);
      const response = await fetch('/api/documents?limit=50');
      if (response.ok) {
        const data = await response.json();
        const docs = data.documents || [];
        setAvailableDocs(docs.map((d: {id: string; title: string}) => ({ 
          id: d.id, 
          title: d.title, 
          selected: false 
        })));
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleAssignDocuments = async () => {
    if (!assigningTag) return;
    
    const selectedDocs = availableDocs.filter(d => d.selected);
    if (selectedDocs.length === 0) return;
    
    try {
      setAssigning(true);
      setError(null);
      await addTagToDocuments(
        assigningTag.id, 
        selectedDocs.map(d => d.id)
      );
      
      // Update the tag's document count
      setTags(prev => prev.map(t => 
        t.id === assigningTag.id 
          ? { ...t, documents: t.documents + selectedDocs.length }
          : t
      ));
      
      setAssignedCount(selectedDocs.length);
      setShowAssignSuccess(true);
    } catch (err) {
      console.error('Failed to assign documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign documents');
    } finally {
      setAssigning(false);
    }
  };

  const closeAssignModal = () => {
    setAssigningTag(null);
    setShowAssignSuccess(false);
    setAssignedCount(0);
    setError(null);
  };

  const toggleDocSelection = (docId: string) => {
    setAvailableDocs(prev => prev.map(d => 
      d.id === docId ? { ...d, selected: !d.selected } : d
    ));
  };

  // Drag and drop setup - only enabled when not filtering/searching
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  // Only allow drag and drop when no filters are applied (custom sort order mode)
  const isDragEnabled = !query && sortBy === 'name' && sortOrder === 'asc' && showUnused === null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally first for immediate feedback
    const newTags = arrayMove(tags, oldIndex, newIndex);
    setTags(newTags);

    // Save to backend
    try {
      const tagIds = newTags.map(t => t.id);
      await reorderTags(tagIds);
    } catch (err) {
      console.error('Failed to save tag order:', err);
      // Revert on error
      setTags(tags);
      setError('Failed to save tag order. Please try again.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex min-h-full flex-col px-2 sm:px-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Tags</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Organise articles with tags to reduce duplicates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/knowledge"
            className="inline-flex items-center gap-2 h-11 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <FileText className="w-4 h-4" />
            Browse Docs
          </Link>
          {!isViewer && (
            <button 
              onClick={() => setShowNewTagModal(true)}
              className="inline-flex items-center gap-2 h-11 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Tag
            </button>
          )}
        </div>
      </div>

      <div className="h-6" />

      <div className="flex flex-col sm:flex-row gap-4 relative">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full h-12 pl-12 pr-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all leading-none"
          />
        </div>
        <div className="relative">
          <button 
            className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(sortBy !== 'name' || sortOrder !== 'asc' || showUnused !== null) && (
              <span className="ml-1 w-2 h-2 bg-[var(--brand)] rounded-full"></span>
            )}
          </button>
          
          {/* Filter Dropdown */}
          {showFilterDropdown && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-3 border-b border-[var(--dash-border-subtle)]">
                <p className="text-xs font-medium text-[var(--dash-text-muted)] uppercase">Sort by</p>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => { setSortBy('name'); setSortOrder('asc'); }}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${sortBy === 'name' && sortOrder === 'asc' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    Name (A-Z)
                  </button>
                  <button
                    onClick={() => { setSortBy('name'); setSortOrder('desc'); }}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${sortBy === 'name' && sortOrder === 'desc' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    Name (Z-A)
                  </button>
                  <button
                    onClick={() => { setSortBy('documents'); setSortOrder('desc'); }}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${sortBy === 'documents' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    Most Documents
                  </button>
                  <button
                    onClick={() => { setSortBy('documents'); setSortOrder('asc'); }}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${sortBy === 'documents' && sortOrder === 'asc' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    Least Documents
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-[var(--dash-text-muted)] uppercase">Filter</p>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => setShowUnused(showUnused === false ? null : false)}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${showUnused === false ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    With Documents
                  </button>
                  <button
                    onClick={() => setShowUnused(showUnused === true ? null : true)}
                    className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${showUnused === true ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                  >
                    Unused Only
                  </button>
                </div>
              </div>
              {(sortBy !== 'name' || sortOrder !== 'asc' || showUnused !== null) && (
                <div className="p-3 border-t border-[var(--dash-border-subtle)]">
                  <button
                    onClick={() => {
                      setSortBy('name');
                      setSortOrder('asc');
                      setShowUnused(null);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-lg transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-2" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <span className="ml-3 text-[var(--dash-text-secondary)]">Loading tags...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--status-error)] mb-1">Failed to load tags</h3>
            <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Hash className="w-16 h-16 text-[var(--dash-text-muted)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
            {query ? 'No tags found' : 'No tags yet'}
          </h3>
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
            {query ? 'Try adjusting your search query.' : 'Create your first tag to start organizing your documents.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(t => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 flex-1 content-start">
              {filtered.map((tag) => (
                <SortableTagCard key={tag.id} tag={tag} onEdit={openEditModal} onDelete={openDeleteModal} onAssign={openAssignModal} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* New Tag Modal */}
      {showNewTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Create New Tag</h2>
              <button
                onClick={() => setShowNewTagModal(false)}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., api, security, onboarding"
                  disabled={creating}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                  placeholder="Brief description of what this tag represents..."
                  rows={3}
                  disabled={creating}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewTagModal(false);
                  setError(null);
                }}
                disabled={creating}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || creating}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tag'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Edit Tag</h2>
              <button
                onClick={() => setEditingTag(null)}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., api, security, onboarding"
                  disabled={savingEdit}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Brief description of what this tag represents..."
                  rows={3}
                  disabled={savingEdit}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingTag(null);
                  setError(null);
                }}
                disabled={savingEdit}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTag}
                disabled={!editName.trim() || savingEdit}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Delete Tag</h2>
              <button
                onClick={() => setDeletingTag(null)}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <p className="text-[var(--dash-text-secondary)]">
                Are you sure you want to delete the tag <span className="font-semibold text-[var(--dash-text-primary)]">#{capitalizeFirstLetter(deletingTag.name)}</span>?
              </p>
              {deletingTag.documents > 0 && (
                <p className="text-sm text-[var(--status-error)]">
                  This tag is assigned to {deletingTag.documents} document{deletingTag.documents !== 1 ? 's' : ''}. The tag will be removed from all documents.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setDeletingTag(null);
                  setError(null);
                }}
                disabled={deleting}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTag}
                disabled={deleting}
                className="flex-1 h-11 px-4 bg-[var(--status-error)] hover:bg-[var(--status-error)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Tag'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Tag Modal */}
      {assigningTag && !showAssignSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Assign a Tag</h2>
              <button
                onClick={() => setAssigningTag(null)}
                className="text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <p className="text-[var(--dash-text-secondary)] text-sm">
                Add a tag to {availableDocs.filter(d => d.selected).length} document{availableDocs.filter(d => d.selected).length !== 1 ? 's' : ''}
              </p>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={assignQuery}
                  onChange={(e) => setAssignQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                />
              </div>

              {/* Document List */}
              <div className="max-h-64 overflow-y-auto border border-[var(--dash-border-subtle)] rounded-xl">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[var(--brand)] animate-spin" />
                    <span className="ml-2 text-sm text-[var(--dash-text-secondary)]">Loading documents...</span>
                  </div>
                ) : availableDocs.filter(d => d.title.toLowerCase().includes(assignQuery.toLowerCase())).length === 0 ? (
                  <div className="py-8 text-center text-[var(--dash-text-muted)]">
                    No documents found
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--dash-border-subtle)]">
                    {availableDocs
                      .filter(d => d.title.toLowerCase().includes(assignQuery.toLowerCase()))
                      .map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => !assigning && toggleDocSelection(doc.id)}
                          className={`flex items-center gap-3 p-3 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors ${assigning ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            doc.selected 
                              ? 'bg-[var(--brand)] border-[var(--brand)]' 
                              : 'border-[var(--dash-border-subtle)]'
                          }`}>
                            {doc.selected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-[var(--dash-text-primary)] truncate flex-1">{doc.title}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-[var(--dash-text-muted)]">
                {availableDocs.filter(d => d.selected).length} document{availableDocs.filter(d => d.selected).length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={closeAssignModal}
                disabled={assigning}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDocuments}
                disabled={availableDocs.filter(d => d.selected).length === 0 || assigning}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign to ${availableDocs.filter(d => d.selected).length} Document${availableDocs.filter(d => d.selected).length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Assign Success Confirmation Modal */}
      {assigningTag && showAssignSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--status-success-bg)] flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-[var(--status-success)]" />
              </div>
              
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)] mb-2">
                Tag Assigned Successfully
              </h2>
              
              <p className="text-[var(--dash-text-secondary)] mb-6">
                <span className="font-semibold text-[var(--brand)]">#{assigningTag.name}</span> has been assigned to{' '}
                <span className="font-semibold text-[var(--dash-text-primary)]">{assignedCount}</span> document{assignedCount !== 1 ? 's' : ''}.
              </p>
              
              <button
                onClick={closeAssignModal}
                className="w-full h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Plus,
  Search,
  Users,
  Lock,
  Globe,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { 
  listCollections, 
  createCollection, 
  deleteCollection, 
  type Collection as APICollection 
} from "@/lib/api/collections";
import { Modal, ModalFooter } from "@/components/ui/Modal";

type Visibility = "private" | "team" | "public";

const COLLECTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', 
  '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
];

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

function VisibilityIcon({ visibility }: { visibility: Visibility }) {
  if (visibility === "private") return <Lock className="w-4 h-4 text-[var(--dash-text-muted)]" />;
  if (visibility === "team") return <Users className="w-4 h-4 text-[var(--status-info)]" />;
  return <Globe className="w-4 h-4 text-[var(--status-success)]" />;
}

export default function CollectionsPage() {
  const [query, setQuery] = useState("");
  const [collections, setCollections] = useState<APICollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<APICollection | null>(null);
  
  // New collection form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(COLLECTION_COLORS[0]);
  const [newVisibility, setNewVisibility] = useState<Visibility>("team");

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listCollections({ limit: 100 });
      setCollections(response.collections);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const filtered = collections.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.description || ''}`.toLowerCase().includes(q);
  });

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;
    
    try {
      setCreating(true);
      setError(null);
      const response = await createCollection({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        color: newColor,
        visibility: newVisibility,
      });
      
      setCollections(prev => [response.collection, ...prev]);
      setNewName("");
      setNewDescription("");
      setNewColor(COLLECTION_COLORS[0]);
      setNewVisibility("team");
      setShowNewModal(false);
    } catch (err) {
      console.error('Failed to create collection:', err);
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (collection: APICollection) => {
    setCollectionToDelete(collection);
    setDeleteModalOpen(true);
  };

  const handleDeleteCancel = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setCollectionToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!collectionToDelete) return;
    
    try {
      setDeleting(collectionToDelete.id);
      await deleteCollection(collectionToDelete.id);
      setCollections(prev => prev.filter(c => c.id !== collectionToDelete.id));
      setDeleteModalOpen(false);
      setCollectionToDelete(null);
    } catch (err) {
      console.error('Failed to delete collection:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete collection');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Collections</h1>
            <p className="text-[var(--dash-text-tertiary)] mt-1">
              Curate articles into structured collections with access control.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/knowledge/new"
              className="inline-flex items-center gap-2 h-11 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
            >
              <FileText className="w-4 h-4" />
              New Document
            </Link>
            <button 
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 h-11 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collections..."
              className="w-full pl-11 pr-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
            />
          </div>
          <button className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all">
            <FolderOpen className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <span className="ml-3 text-[var(--dash-text-secondary)]">Loading collections...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--status-error)] mb-1">Failed to load collections</h3>
            <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-16 h-16 text-[var(--dash-text-muted)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
            {query ? 'No collections found' : 'No collections yet'}
          </h3>
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
            {query ? 'Try adjusting your search query.' : 'Create your first collection to start curating your documents.'}
          </p>
          {!query && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Collection
            </button>
          )}
        </div>
      )}

      {/* Collections Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 hover:shadow-lg hover:border-[var(--brand)] transition-all h-full group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <h3 className="font-semibold text-[var(--dash-text-primary)] truncate">
                        {c.name}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--dash-text-tertiary)] mt-1 line-clamp-2">
                      {c.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <VisibilityIcon visibility={c.visibility} />
                    <button 
                      onClick={() => handleDeleteClick(c)}
                      disabled={deleting === c.id}
                      className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {deleting === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--surface-ground)] p-4">
                    <p className="text-xs text-[var(--dash-text-muted)]">Documents</p>
                    <p className="text-lg font-semibold text-[var(--dash-text-primary)]">{c.document_count}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-ground)] p-4">
                    <p className="text-xs text-[var(--dash-text-muted)]">Updated</p>
                    <p className="text-sm font-medium text-[var(--dash-text-secondary)]">{formatRelativeTime(c.updated_at)}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-[var(--dash-text-muted)] capitalize">{c.visibility}</span>
                  <Link
                    href={`/dashboard/knowledge/collections/${c.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
                  >
                    Open
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => !creating && setShowNewModal(false)}
        title="Create New Collection"
        description="Group related documents into a curated collection."
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Onboarding Guide"
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
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of this collection..."
              rows={3}
              disabled={creating}
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {COLLECTION_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  disabled={creating}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    newColor === color ? 'ring-2 ring-offset-2 ring-[var(--brand)]' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['private', 'team', 'public'] as Visibility[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setNewVisibility(v)}
                  disabled={creating}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                    newVisibility === v
                      ? 'border-[var(--brand)] bg-[var(--brand)]/5'
                      : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                  }`}
                >
                  {v === 'private' && <Lock className="w-4 h-4" />}
                  {v === 'team' && <Users className="w-4 h-4" />}
                  {v === 'public' && <Globe className="w-4 h-4" />}
                  <span className="text-sm capitalize">{v}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <ModalFooter>
          <button
            onClick={() => setShowNewModal(false)}
            disabled={creating}
            className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateCollection}
            disabled={!newName.trim() || creating}
            className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Collection'
            )}
          </button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="delete collection"
        description="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to delete the
            <span className="font-semibold text-[var(--dash-text-primary)]"> <b>{collectionToDelete?.name}</b></span> collection?
          </p>
          <p className="text-sm text-[var(--status-error)]">
            Documents inside this collection will remain in the knowledge base.
          </p>
        </div>

        <ModalFooter>
          <button
            onClick={handleDeleteCancel}
            disabled={Boolean(deleting)}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            disabled={Boolean(deleting)}
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
                Delete Collection
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

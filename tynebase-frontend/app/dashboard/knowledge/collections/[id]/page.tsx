"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Globe,
  Lock,
  Users,
  Loader2,
  AlertCircle,
  FolderOpen,
  Square,
  CheckSquare,
  Minus,
  Trash2,
  X,
} from "lucide-react";
import { getCollection, removeDocumentFromCollection, type Collection } from "@/lib/api/collections";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Modal, ModalFooter } from "@/components/ui/Modal";

type Visibility = "private" | "team" | "public";

type VisibilityMeta = {
  label: string;
  icon: typeof Lock;
  iconClassName: string;
  badgeClassName: string;
};

const VISIBILITY_META: Record<Visibility, VisibilityMeta> = {
  private: {
    label: "Private",
    icon: Lock,
    iconClassName: "text-[var(--dash-text-muted)]",
    badgeClassName: "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]",
  },
  team: {
    label: "Team",
    icon: Users,
    iconClassName: "text-[var(--status-info)]",
    badgeClassName: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  },
  public: {
    label: "Public",
    icon: Globe,
    iconClassName: "text-[var(--status-success)]",
    badgeClassName: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
};

const STATUS_BADGES: Record<string, string> = {
  published: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  draft: "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]",
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return diffMins === 0 ? "Just now" : `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

const formatStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getCollection(collectionId);
        setCollection(response.collection);
      } catch (err) {
        console.error("Failed to fetch collection:", err);
        setError(err instanceof Error ? err.message : "Failed to load collection");
      } finally {
        setLoading(false);
      }
    };

    if (collectionId) {
      fetchCollection();
    }
  }, [collectionId]);

  const documents = useMemo(() => {
    if (!collection?.documents) return [];
    return [...collection.documents].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [collection?.documents]);

  const docIds = useMemo(() => documents.map((d) => d.id), [documents]);
  const selectedCount = useMemo(() => docIds.filter((id) => selectedIds.has(id)).length, [docIds, selectedIds]);
  const allSelected = docIds.length > 0 && selectedCount === docIds.length;
  const someSelected = selectedCount > 0 && selectedCount < docIds.length;

  const handleSelectDocument = useCallback((docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const currentlyAllSelected = docIds.every((id) => prev.has(id));
      if (currentlyAllSelected) {
        return new Set();
      } else {
        return new Set(docIds);
      }
    });
  }, [docIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRemoveFromCollection = async () => {
    if (selectedIds.size === 0 || !collection) return;

    try {
      setRemoving(true);
      const promises = Array.from(selectedIds).map((docId) =>
        removeDocumentFromCollection(collectionId, docId)
      );
      await Promise.all(promises);

      // Update local state
      setCollection((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documents: prev.documents?.filter((d) => !selectedIds.has(d.id)),
          document_count: prev.document_count - selectedIds.size,
        };
      });

      setRemoveModalOpen(false);
      clearSelection();
    } catch (err) {
      console.error("Failed to remove documents:", err);
      setError(err instanceof Error ? err.message : "Failed to remove documents");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
        <span className="ml-3 text-[var(--dash-text-secondary)]">Loading collection...</span>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-[var(--status-error)] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--dash-text-primary)] mb-2">
            {error ? "Failed to load collection" : "Collection not found"}
          </h2>
          <p className="text-[var(--dash-text-tertiary)] mb-6">
            {error || "The collection you\'re looking for doesn\'t exist."}
          </p>
          <Link href="/dashboard/knowledge/collections">
            <Button variant="primary" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Collections
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const visibilityMeta = VISIBILITY_META[collection.visibility];
  const VisibilityIcon = visibilityMeta.icon;
  const ownerName = collection.users?.full_name || collection.users?.email || "Unknown";

  return (
    <div className="min-h-full flex flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)]">
        <Link href="/dashboard/knowledge" className="hover:text-[var(--brand)]">
          Knowledge Base
        </Link>
        <span>/</span>
        <Link href="/dashboard/knowledge/collections" className="hover:text-[var(--brand)]">
          Collections
        </Link>
        <span>/</span>
        <span className="text-[var(--dash-text-secondary)] truncate max-w-[240px]">
          {collection.name}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: collection.color }}
            />
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
              {collection.name}
            </h1>
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${visibilityMeta.badgeClassName}`}
            >
              {visibilityMeta.label}
            </span>
          </div>
          <p className="text-[var(--dash-text-tertiary)] max-w-2xl">
            {collection.description || "No description yet for this collection."}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--dash-text-tertiary)]">
            <span>Created {formatRelativeTime(collection.created_at)}</span>
            <span>•</span>
            <span>Updated {formatRelativeTime(collection.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/knowledge/collections">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Collections
            </Button>
          </Link>
          <Link
            href="/dashboard/knowledge/new"
            className="inline-flex items-center gap-2 h-11 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
          >
            <FileText className="w-4 h-4" />
            New Document
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--dash-text-muted)]">Documents</p>
          <p className="text-2xl font-bold text-[var(--dash-text-primary)]">
            {collection.document_count}
          </p>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--dash-text-muted)]">Visibility</p>
            <p className="text-sm font-semibold text-[var(--dash-text-primary)]">
              {visibilityMeta.label}
            </p>
          </div>
          <VisibilityIcon className={`w-5 h-5 ${visibilityMeta.iconClassName}`} />
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--dash-text-muted)]">Owner</p>
          <p className="text-sm font-semibold text-[var(--dash-text-primary)] truncate">
            {ownerName}
          </p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[var(--brand)]/10 border border-[var(--brand)]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--brand)]">
              {selectedIds.size} document{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
          <button
            onClick={() => setRemoveModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 rounded-lg text-sm text-[var(--status-error)] hover:bg-[var(--status-error)] hover:text-white transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Remove from Collection
          </button>
        </div>
      )}

      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {documents.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                title={allSelected ? "Deselect all" : "Select all"}
              >
                {allSelected ? (
                  <CheckSquare className="w-5 h-5 text-[var(--brand)]" />
                ) : someSelected ? (
                  <Minus className="w-5 h-5 text-[var(--brand)]" />
                ) : (
                  <Square className="w-5 h-5 text-[var(--dash-text-muted)]" />
                )}
              </button>
            )}
            <div>
              <CardTitle className="text-lg">Documents</CardTitle>
              <CardDescription>Documents curated in this collection.</CardDescription>
            </div>
          </div>
          <span className="text-sm text-[var(--dash-text-tertiary)]">
            {documents.length} item{documents.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6">
              <FolderOpen className="w-12 h-12 text-[var(--dash-text-muted)] mb-3" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                No documents yet
              </h3>
              <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
                Add documents from the knowledge base to start building this collection.
              </p>
              <Link
                href="/dashboard/knowledge"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
              >
                Browse documents
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--dash-border-subtle)]">
              {documents.map((doc) => {
                const statusClass = STATUS_BADGES[doc.status] ??
                  "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]";
                const isSelected = selectedIds.has(doc.id);

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors group ${
                      isSelected ? "bg-[var(--brand)]/5" : ""
                    }`}
                  >
                    <button
                      onClick={(e) => handleSelectDocument(doc.id, e)}
                      className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[var(--brand)]" />
                      ) : (
                        <Square className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-text-secondary)]" />
                      )}
                    </button>
                    <Link
                      href={`/dashboard/knowledge/${doc.id}`}
                      className="flex-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--dash-text-primary)] truncate group-hover:text-[var(--brand)]">
                          {doc.title || "Untitled document"}
                        </p>
                        <p className="text-sm text-[var(--dash-text-tertiary)]">
                          Added {formatRelativeTime(doc.added_at)} · Updated {formatRelativeTime(doc.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClass}`}>
                          {formatStatus(doc.status)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove from Collection Modal */}
      <Modal
        isOpen={removeModalOpen}
        onClose={() => !removing && setRemoveModalOpen(false)}
        title="Remove from Collection"
        description="Documents will remain in the knowledge base."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to remove{" "}
            <span className="font-semibold text-[var(--dash-text-primary)]">
              {selectedIds.size} document{selectedIds.size !== 1 ? "s" : ""}
            </span>{" "}
            from this collection?
          </p>
          <p className="text-sm text-[var(--dash-text-tertiary)]">
            The documents will not be deleted—they will remain in the knowledge base.
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setRemoveModalOpen(false)}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemoveFromCollection}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--status-error)] rounded-lg hover:bg-[var(--status-error)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {removing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Remove {selectedIds.size} Document{selectedIds.size !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

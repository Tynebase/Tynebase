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
  UserPlus,
  UserMinus,
  Shield,
  Eye,
  Pencil,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { 
  getCollection, 
  removeDocumentFromCollection, 
  getCollectionMembers,
  inviteCollectionMember,
  removeCollectionMember,
  updateCollection,
  type Collection,
  type CollectionMember
} from "@/lib/api/collections";
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

const VISIBILITY_INFO: Record<Visibility, { label: string; description: string }> = {
  private: {
    label: "Private",
    description: "Only you and invited members can see this collection",
  },
  team: {
    label: "Team",
    description: "Visible to all members of your organization",
  },
  public: {
    label: "Public",
    description: "Visible to anyone with the link",
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

  // Member management state
  const [members, setMembers] = useState<CollectionMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [inviting, setInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CollectionMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Edit visibility state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVisibility, setEditVisibility] = useState<Visibility>("private");
  const [editLoading, setEditLoading] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const refreshCollection = useCallback(async () => {
    if (!collectionId) return;
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
  }, [collectionId]);

  useEffect(() => {
    refreshCollection();
  }, [refreshCollection]);

  // Fetch members for private collections
  useEffect(() => {
    const fetchMembers = async () => {
      if (!collection || collection.visibility !== "private") return;
      
      try {
        setMembersLoading(true);
        const response = await getCollectionMembers(collectionId);
        setMembers(response.members);
      } catch (err) {
        console.error("Failed to fetch members:", err);
        // Don't show error for members, just log it
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, [collectionId, collection]);

  const documents = useMemo(() => {
    if (!collection?.documents) return [];
    return [...collection.documents].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [collection?.documents]);

  // Member management functions
  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    
    try {
      setInviting(true);
      setError(null);
      
      // TODO: Need to look up user by email first
      // For now, we'll need the user ID - this is a placeholder
      // In a real implementation, we'd search for the user by email
      
      // Placeholder - would need user lookup endpoint
      // const response = await inviteCollectionMember(collectionId, {
      //   user_id: userId,
      //   role: inviteRole,
      // });
      
      // setMembers(prev => [...prev, response.member]);
      setInviteEmail("");
      setInviteRole("viewer");
      setShowInviteModal(false);
    } catch (err) {
      console.error("Failed to invite member:", err);
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    
    try {
      setRemovingMember(true);
      await removeCollectionMember(collectionId, memberToRemove.id);
      setMembers(prev => prev.filter(m => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (err) {
      console.error("Failed to remove member:", err);
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingMember(false);
    }
  };

  const handleUpdateVisibility = async () => {
    if (!collection || editVisibility === collection.visibility) {
      setShowEditModal(false);
      return;
    }

    // If changing from private to team/public, show confirmation about members losing access
    if (collection.visibility === "private" && members.length > 0) {
      setShowVisibilityConfirm(true);
      return;
    }

    await performVisibilityUpdate();
  };

  const performVisibilityUpdate = async () => {
    try {
      setEditLoading(true);
      setError(null);
      
      const response = await updateCollection(collectionId, {
        visibility: editVisibility,
      });
      
      setCollection(response.collection);
      setShowEditModal(false);
      setShowVisibilityConfirm(false);
    } catch (err) {
      console.error("Failed to update visibility:", err);
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setEditLoading(false);
    }
  };

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
          <Button variant="ghost" className="gap-2" onClick={refreshCollection} title="Refresh collection">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Link href="/dashboard/knowledge/collections">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Collections
            </Button>
          </Link>
          {/* Show edit button only for the collection author */}
          <Button
            variant="outline"
            onClick={() => {
              setEditVisibility(collection.visibility);
              setShowEditModal(true);
            }}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
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

      {/* Members Section - Only for private collections */}
      {collection.visibility === "private" && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Members</CardTitle>
              <CardDescription>People who have access to this private collection.</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(true)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[var(--brand)] animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 px-6 text-center">
                <p className="text-sm text-[var(--dash-text-tertiary)]">
                  No members yet. Invite people to share this collection.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--dash-border-subtle)]">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--surface-ground)] flex items-center justify-center">
                        <span className="text-sm font-medium text-[var(--dash-text-secondary)]">
                          {member.users?.full_name?.charAt(0).toUpperCase() || member.users?.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--dash-text-primary)]">
                          {member.users?.full_name || member.users?.email}
                        </p>
                        <p className="text-sm text-[var(--dash-text-tertiary)]">{member.users?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          member.role === "editor"
                            ? "bg-[var(--status-info-bg)] text-[var(--status-info)]"
                            : "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]"
                        }`}
                      >
                        {member.role === "editor" ? (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Editor
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Viewer
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="p-1.5 rounded-lg text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                        title="Remove member"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => !inviting && setShowInviteModal(false)}
        title="Invite Member"
        description="Invite someone to access this private collection."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              User Email
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
              disabled={inviting}
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Role
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setInviteRole("viewer")}
                disabled={inviting}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  inviteRole === "viewer"
                    ? "border-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                }`}
              >
                <Eye className={`w-5 h-5 mt-0.5 ${inviteRole === "viewer" ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)]"}`} />
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${inviteRole === "viewer" ? "text-[var(--brand)]" : "text-[var(--dash-text-primary)]"}`}>
                    Viewer
                  </span>
                  <span className="text-xs text-[var(--dash-text-tertiary)]">
                    Can view documents in this collection
                  </span>
                </div>
                {inviteRole === "viewer" && (
                  <div className="w-2 h-2 rounded-full bg-[var(--brand)] mt-2" />
                )}
              </button>
              <button
                onClick={() => setInviteRole("editor")}
                disabled={inviting}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  inviteRole === "editor"
                    ? "border-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                }`}
              >
                <Shield className={`w-5 h-5 mt-0.5 ${inviteRole === "editor" ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)]"}`} />
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${inviteRole === "editor" ? "text-[var(--brand)]" : "text-[var(--dash-text-primary)]"}`}>
                    Editor
                  </span>
                  <span className="text-xs text-[var(--dash-text-tertiary)]">
                    Can add and remove documents from this collection
                  </span>
                </div>
                {inviteRole === "editor" && (
                  <div className="w-2 h-2 rounded-full bg-[var(--brand)] mt-2" />
                )}
              </button>
            </div>
          </div>
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowInviteModal(false)}
            disabled={inviting}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInviteMember}
            disabled={!inviteEmail.trim() || inviting}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {inviting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Invite
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Remove Member Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => !removingMember && setMemberToRemove(null)}
        title="Remove Member"
        description="This person will lose access to this collection."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to remove{" "}
            <span className="font-semibold text-[var(--dash-text-primary)]">
              {memberToRemove?.users?.full_name || memberToRemove?.users?.email}
            </span>{" "}
            from this collection?
          </p>
          <p className="text-sm text-[var(--status-error)]">
            They will no longer be able to access this private collection.
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setMemberToRemove(null)}
            disabled={removingMember}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemoveMember}
            disabled={removingMember}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--status-error)] rounded-lg hover:bg-[var(--status-error)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {removingMember ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4" />
                Remove Member
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Edit Collection Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => !editLoading && setShowEditModal(false)}
        title="Edit Collection"
        description="Change the visibility of this collection."
        size="sm"
      >
        <div className="space-y-2">
          {(['private', 'team', 'public'] as Visibility[]).map((v) => {
            const info = VISIBILITY_INFO[v];
            return (
              <button
                key={v}
                onClick={() => setEditVisibility(v)}
                disabled={editLoading}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  editVisibility === v
                    ? 'border-[var(--brand)] bg-[var(--brand)]/5'
                    : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                }`}
              >
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${editVisibility === v ? 'text-[var(--brand)]' : 'text-[var(--dash-text-primary)]'}`}>
                    {info.label}
                  </span>
                  <span className="text-xs text-[var(--dash-text-tertiary)]">
                    {info.description}
                  </span>
                </div>
                {editVisibility === v && (
                  <div className="w-2 h-2 rounded-full bg-[var(--brand)] mt-2" />
                )}
              </button>
            );
          })}
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowEditModal(false)}
            disabled={editLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateVisibility}
            disabled={editLoading || editVisibility === collection?.visibility}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {editLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Visibility Change Confirmation Modal */}
      <Modal
        isOpen={showVisibilityConfirm}
        onClose={() => !editLoading && setShowVisibilityConfirm(false)}
        title="Change Visibility"
        description="Members will lose access to this collection."
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--status-warning)]">
                Warning: Members will lose access
              </p>
              <p className="text-xs text-[var(--dash-text-secondary)] mt-1">
                {members.length} member{members.length !== 1 ? 's' : ''} will no longer be able to access this collection if you change the visibility to {VISIBILITY_INFO[editVisibility].label}.
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to change the visibility from{' '}
            <span className="font-semibold">{VISIBILITY_INFO[collection?.visibility as Visibility]?.label}</span> to{' '}
            <span className="font-semibold">{VISIBILITY_INFO[editVisibility].label}</span>?
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowVisibilityConfirm(false)}
            disabled={editLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--dash-text-secondary)] bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={performVisibilityUpdate}
            disabled={editLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--status-warning)] rounded-lg hover:bg-[var(--status-warning)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {editLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Change Visibility
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

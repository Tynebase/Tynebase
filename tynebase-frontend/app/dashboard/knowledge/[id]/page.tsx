"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";
import { TiptapReader } from "@/components/ui/TiptapReader";
import { Button } from "@/components/ui/Button";
import { RainbowProgressBar } from "@/components/ui/RainbowProgressBar";
import {
  ArrowLeft,
  Eye,
  MoreHorizontal,
  Globe,
  Lock,
  Clock,
  Folder,
  Tag,
  Users,
  ChevronDown,
  History,
  Trash2,
  Copy,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Share2,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/Card";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import { Modal } from "@/components/ui/Modal";
import {
  getDocument,
  updateDocument,
  publishDocument,
  deleteDocument,
  discardDraft,
  createDocument,
  type Document
} from "@/lib/api/documents";
import { trackDocumentView } from "@/lib/api/audit";
import { listCategories, type Category as APICategory } from "@/lib/api/folders";
import { ShareModal } from "@/components/docs/ShareModal";
import { listTags, createTag, addTagToDocuments, removeTagFromDocument, type Tag as APITag } from "@/lib/api/tags";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";

function htmlToPlainText(html: string | null | undefined) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h\d>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

interface UIDocument {
  id: string;
  title: string;
  content: string;
  draftTitle?: string;
  draftContent?: string;
  hasDraft: boolean;
  draftUpdatedAt?: string;
  folder: string;
  status: "draft" | "published";
  visibility: "public" | "private" | "team" | "community";
  author: string;
  createdAt: string;
  updatedAt: string;
}

function mapDocumentToUI(doc: Document): UIDocument {
  const authorName = doc.users?.full_name || doc.users?.email || 'Unknown';
  
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    draftTitle: doc.draft_title,
    draftContent: doc.draft_content,
    hasDraft: doc.has_draft || false,
    draftUpdatedAt: doc.draft_updated_at,
    folder: 'General',
    status: doc.status,
    visibility: (doc as any).visibility || (doc.is_public ? 'public' : 'team'),
    author: authorName,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export default function EditDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = params.id as string;
  const isFromAudit = searchParams.get('from') === 'audit';
  const { user } = useAuth();
  const { addToast } = useToast();
  const isViewer = user?.role === 'viewer' && !user?.is_super_admin;

  const [document, setDocument] = useState<UIDocument | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<APICategory[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "private" | "team" | "community">("team");
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentTags, setDocumentTags] = useState<Array<{ id: string; name: string }>>([]);
  const [availableTags, setAvailableTags] = useState<APITag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showCopyLinkModal, setShowCopyLinkModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const hasFetched = useRef(false);
  const hasTrackedView = useRef(false);
  const editorRef = useRef<any>(null);
  const [contentIsHtml, setContentIsHtml] = useState(false);

  // Handle mode switch - get live content from editor for preview
  const handleModeSwitch = (newMode: "edit" | "read") => {
    if (newMode === "read" && editorRef.current && !editorRef.current.isDestroyed) {
      // Get live HTML from the TipTap editor (reflects current Y.js state)
      setContent(editorRef.current.getHTML());
      setContentIsHtml(true);
    }
    setMode(newMode);
  };

  useEffect(() => {
    // Prevent double fetch in React StrictMode
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Skip view increment on initial load — views are tracked separately in read mode
        const response = await getDocument(documentId, true);
        const uiDoc = mapDocumentToUI(response.document);
        
        // Check if this is a cross-tenant read-only document or viewer role
        const readOnly = response.is_read_only || false;
        setIsReadOnly(readOnly || isViewer);
        
        setDocument(uiDoc);
        // For published docs with draft, load the draft content for editing (only if not read-only)
        if (!readOnly && uiDoc.status === 'published' && uiDoc.hasDraft && uiDoc.draftContent) {
          setTitle(uiDoc.draftTitle || uiDoc.title);
          setContent(uiDoc.draftContent);
        } else {
          setTitle(uiDoc.title);
          setContent(uiDoc.content);
        }
        setStatus(uiDoc.status);
        setSelectedCategoryId(response.document.category_id || null);
        setVisibility(uiDoc.visibility);
        
        // Force read mode for cross-tenant documents
        if (readOnly) {
          setMode('read');
        }
      } catch (err) {
        console.error('Failed to fetch document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  // Track document view when user switches to read mode (not in edit mode)
  useEffect(() => {
    if (mode === 'read' && document && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackDocumentView(documentId).catch(() => {});
    }
  }, [mode, document, documentId]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await listCategories({ limit: 100 });
        setCategories(res.categories);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch available tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await listTags({ limit: 100 });
        setAvailableTags(res.tags);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchTags();
  }, []);

  // Load document tags when document is fetched
  useEffect(() => {
    const fetchDocumentTags = async () => {
      if (!documentId) return;
      try {
        const response = await getDocument(documentId, true);
        if (response.document.tags) {
          setDocumentTags(response.document.tags.map(t => ({ id: t.id, name: t.name })));
        }
      } catch (err) {
        console.error('Failed to fetch document tags:', err);
      }
    };
    fetchDocumentTags();
  }, [documentId]);

  // Handle adding a tag to the document
  const handleAddTag = async (tag: APITag) => {
    if (documentTags.some(t => t.id === tag.id)) return;
    
    setLoadingTags(true);
    try {
      await addTagToDocuments(tag.id, [documentId]);
      setDocumentTags(prev => [...prev, { id: tag.id, name: tag.name }]);
      setTagInput("");
      setShowTagDropdown(false);
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // Handle creating a new tag and adding it to the document
  const handleCreateAndAddTag = async () => {
    if (!tagInput.trim()) return;
    
    setLoadingTags(true);
    try {
      const res = await createTag({ name: tagInput.trim() });
      await addTagToDocuments(res.tag.id, [documentId]);
      setDocumentTags(prev => [...prev, { id: res.tag.id, name: res.tag.name }]);
      setAvailableTags(prev => [...prev, res.tag]);
      setTagInput("");
      setShowTagDropdown(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // Handle removing a tag from the document
  const handleRemoveTag = async (tagId: string) => {
    setLoadingTags(true);
    try {
      await removeTagFromDocument(tagId, documentId);
      setDocumentTags(prev => prev.filter(t => t.id !== tagId));
    } catch (err) {
      console.error('Failed to remove tag:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // Filter available tags based on input
  const filteredTags = availableTags.filter(
    tag => 
      tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
      !documentTags.some(dt => dt.id === tag.id)
  );

  // Update category when selection changes
  const handleCategoryChange = async (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setShowCategoryDropdown(false);
    try {
      await updateDocument(documentId, { category_id: categoryId });
      console.log(`[EditDocument] Updated category to: ${categoryId || 'root'}`);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <p className="text-[var(--dash-text-secondary)]">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-[var(--status-error)] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--dash-text-primary)] mb-2">
            {error ? 'Failed to load document' : 'Document not found'}
          </h2>
          <p className="text-[var(--dash-text-tertiary)] mb-4">
            {error || "The document you're looking for doesn't exist."}
          </p>
          <Link href="/dashboard/knowledge">
            <Button variant="primary">Back to Knowledge Base</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      
      // For published documents, save as draft AND unpublish (convert to draft status)
      const isPublished = status === 'published';
      
      const response = await updateDocument(documentId, {
        title,
        visibility,
        save_as_draft: true,
        // If currently published, also change status to draft (unpublish)
        ...(isPublished && { status: 'draft' }),
      });
      
      // Update local state with response data
      const updatedDoc = response.document;
      setTitle(updatedDoc.draft_title || updatedDoc.title);
      setContent(updatedDoc.draft_content || updatedDoc.content);
      
      // If we unpublished, update the status
      if (isPublished) {
        setStatus('draft');
      }
      
      // Update document state with new has_draft status
      setDocument(prev => prev ? { 
        ...prev, 
        hasDraft: updatedDoc.has_draft || false,
        status: isPublished ? 'draft' : prev.status,
      } : null);
    } catch (err) {
      console.error('Failed to save draft:', err);
      addToast({ type: 'error', title: 'Save failed', description: err instanceof Error ? err.message : 'Failed to save draft. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndPublish = async () => {
    try {
      setIsSaving(true);
      
      // Save title and visibility metadata (not content - collab server keeps content updated via Y.js)
      await updateDocument(documentId, {
        title,
        visibility,
      });
      
      // Publish with visibility - the backend uses the latest content from the collab server
      const response = await publishDocument(documentId, visibility);
      const updatedDoc = response.document;
      
      setStatus('published');
      setTitle(updatedDoc.title);
      setContent(updatedDoc.content);
      setDocument(prev => prev ? { 
        ...prev, 
        status: 'published',
        hasDraft: false,
        draftContent: undefined,
        draftTitle: undefined,
      } : null);
    } catch (err) {
      console.error('Failed to save and publish:', err);
      addToast({ type: 'error', title: 'Publish failed', description: err instanceof Error ? err.message : 'Failed to save and publish. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    try {
      setIsSaving(true);
      const response = await discardDraft(documentId);
      const updatedDoc = response.document;
      
      // Revert to published content
      setTitle(updatedDoc.title);
      setContent(updatedDoc.content);
      setDocument(prev => prev ? { 
        ...prev, 
        hasDraft: false,
        draftContent: undefined,
        draftTitle: undefined,
      } : null);
    } catch (err) {
      console.error('Failed to discard draft:', err);
      addToast({ type: 'error', title: 'Discard failed', description: err instanceof Error ? err.message : 'Failed to discard draft changes. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument(documentId);
      router.push("/dashboard/knowledge");
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-6">
      <RainbowProgressBar isLoading={isLoading} />
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 sm:px-6 py-3 sm:py-4 border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] rounded-2xl">
        {/* Top row: Back button and breadcrumb */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {isFromAudit ? (
              <Button 
                variant="ghost" 
                className="gap-2 px-2 sm:px-3 text-[var(--brand)] hover:bg-[var(--brand)]/10"
                onClick={() => router.push('/dashboard/audit')}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Audit</span>
              </Button>
            ) : (
              <Link href="/dashboard/knowledge" className="flex-shrink-0">
                <Button variant="ghost" className="gap-2 px-2 sm:px-3">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[var(--dash-text-tertiary)] min-w-0 overflow-hidden">
              <span className="text-[var(--dash-text-muted)] hidden md:inline">Knowledge Base</span>
              <span className="hidden md:inline">/</span>
              <span className="hidden lg:inline">{selectedCategory?.name || 'Uncategorised'}</span>
              <span className="hidden lg:inline">/</span>
              <span className="text-[var(--dash-text-primary)] truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px]">{title || "Untitled"}</span>
            </div>
          </div>
          
          {/* Status Badge - always visible */}
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
            status === "published" && document?.hasDraft
              ? "bg-blue-500/10 text-blue-600" // Draft changes on published doc
              : status === "draft"
                ? "bg-amber-500/10 text-amber-600"
                : "bg-green-500/10 text-green-600"
          }`}>
            {status === "published" && document?.hasDraft ? (
              <>
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Draft Changes</span>
              </>
            ) : status === "draft" ? (
              <>
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Draft</span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Published</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom row: Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Edit/Reader Toggle - hide Edit option for read-only docs */}
          {isReadOnly ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-xs sm:text-sm font-medium">
              <Eye className="w-4 h-4" />
              <span>View Only</span>
            </div>
          ) : (
            <div className="flex items-center p-1 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl">
              <button
                onClick={() => handleModeSwitch("edit")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${mode === "edit"
                  ? "bg-[var(--surface-card)] text-[var(--dash-text-primary)]"
                  : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                  }`}
              >
                Edit
              </button>
              <button
                onClick={() => handleModeSwitch("read")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${mode === "read"
                  ? "bg-[var(--surface-card)] text-[var(--dash-text-primary)]"
                  : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                  }`}
              >
                Reader
              </button>
            </div>
          )}

          {/* Share Button - only for own documents */}
          {!isReadOnly && (
            <Button
              variant="ghost"
              className="gap-1 sm:gap-2 px-2 sm:px-3"
              onClick={() => setShowShareModal(true)}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}

          {/* Version History - only for own documents */}
          {!isReadOnly && (
            <Button
              variant="ghost"
              className="gap-1 sm:gap-2 px-2 sm:px-3"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
          )}

          {/* Preview - hidden on mobile and for read-only docs */}
          {!isReadOnly && (
            <Button variant="ghost" className="gap-1 sm:gap-2 px-2 sm:px-3 hidden md:flex" onClick={() => handleModeSwitch(mode === "edit" ? "read" : "edit")}>
              <Eye className="w-4 h-4" />
              {mode === "edit" ? "Preview" : "Back to editor"}
            </Button>
          )}

          {/* Spacer to push actions to the right on larger screens */}
          <div className="flex-1 hidden lg:block" />

          {/* Save as Draft - only for own documents */}
          {!isReadOnly && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-2 sm:px-3"
              title={status === 'published' ? 'Save as draft and unpublish' : 'Save as draft'}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {isSaving ? 'Saving...' : (status === 'published' ? 'Save as Draft' : 'Save Draft')}
              </span>
            </Button>
          )}

          {/* Save and Publish - only for own documents */}
          {!isReadOnly && (
            <Button
              variant="primary"
              onClick={handleSaveAndPublish}
              disabled={isSaving}
              className="px-2 sm:px-3 group/publish"
              title={status === 'published' ? 'Save & Publish to overwrite' : 'Save & Publish'}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : status === 'published' && !document?.hasDraft ? (
                <>
                  <CheckCircle className="w-4 h-4 sm:mr-2 group-hover/publish:hidden" />
                  <Globe className="w-4 h-4 sm:mr-2 hidden group-hover/publish:block" />
                </>
              ) : (
                <Globe className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {isSaving ? 'Publishing...' : status === 'published' && !document?.hasDraft ? (
                  <>
                    <span className="group-hover/publish:hidden">Published</span>
                    <span className="hidden group-hover/publish:inline">Save &amp; Publish</span>
                  </>
                ) : 'Save & Publish'}
              </span>
            </Button>
          )}

          {/* More Options - only for own documents */}
          {!isReadOnly && (
            <div className="relative">
              <Button variant="ghost" className="px-2" onClick={() => setShowSettings(!showSettings)}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Editor - Always mounted to preserve Y.js state */}
        <div className={mode === "edit" ? "flex overflow-hidden h-full" : "hidden"}>
          <div className="flex-1 overflow-hidden">
            <RichTextEditor
              documentId={documentId}
              initialTitle={title}
              initialContent={content}
              onTitleChange={setTitle}
              onEditorReady={(editor) => { editorRef.current = editor; }}
              readOnly={isReadOnly}
              showVersionHistory={showHistory}
              onVersionHistoryToggle={() => setShowHistory(!showHistory)}
            />
          </div>

            {/* Settings Sidebar */}
            {showSettings && !showHistory && (
              <>
                {/* Mobile overlay backdrop */}
                <div 
                  className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                  onClick={() => setShowSettings(false)}
                />
                
                {/* Settings panel - sidebar on desktop, modal on mobile */}
                <div className="fixed lg:relative inset-y-0 right-0 w-full sm:w-96 lg:w-80 border-l border-[var(--dash-border-subtle)] bg-[var(--surface-card)] overflow-y-auto z-50 lg:z-auto">
                  <div className="p-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--dash-text-primary)]">Document Settings</h3>
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="lg:hidden p-1 hover:bg-[var(--surface-hover)] rounded text-[var(--dash-text-secondary)]"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                <div className="p-4 space-y-6">
                  {/* Category */}
                  <div className="relative">
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
                      <Folder className="w-4 h-4" />
                      Category
                    </label>
                    <button 
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-left hover:border-[var(--dash-border-default)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {selectedCategory && (
                          <div 
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: selectedCategory.color }}
                          />
                        )}
                        <span className="text-[var(--dash-text-primary)]">
                          {selectedCategory?.name || "No category"}
                        </span>
                      </div>
                      {loadingCategories ? (
                        <Loader2 className="w-4 h-4 text-[var(--dash-text-tertiary)] animate-spin" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      )}
                    </button>
                    
                    {showCategoryDropdown && !loadingCategories && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => handleCategoryChange(null)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                            !selectedCategoryId ? 'bg-[var(--brand)]/5' : ''
                          }`}
                        >
                          <span className="text-[var(--dash-text-primary)]">No category</span>
                        </button>
                        {categories.filter(c => !c.is_system).map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleCategoryChange(c.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                              selectedCategoryId === c.id ? 'bg-[var(--brand)]/5' : ''
                            }`}
                          >
                            <div 
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="text-[var(--dash-text-primary)] truncate">{c.name}</span>
                          </button>
                        ))}
                        {categories.length === 0 && (
                          <div className="px-3 py-2 text-sm text-[var(--dash-text-tertiary)]">
                            No categories yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4" />
                      Visibility
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: "public", label: "Public", desc: "Visible on your knowledge base", icon: Globe, disabled: false },
                        { id: "community", label: "Community", desc: "Shared on public hub", icon: BookOpen, disabled: false },
                        { id: "team", label: "Team Only", desc: "Workspace members", icon: Users, disabled: false },
                        { id: "private", label: "Private", desc: "Only you", icon: Lock, disabled: false },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={async () => {
                            if (option.disabled) return;
                            const newVisibility = option.id as typeof visibility;
                            setVisibility(newVisibility);
                            try {
                              await updateDocument(documentId, { visibility: newVisibility });
                            } catch (err) {
                              console.error('Failed to update visibility:', err);
                            }
                          }}
                          disabled={option.disabled}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            option.disabled
                              ? "border-[var(--dash-border-subtle)] opacity-50 cursor-not-allowed"
                              : visibility === option.id
                                ? "border-[var(--brand)] bg-[var(--brand)]/10"
                                : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                          }`}
                        >
                          <option.icon className={`w-4 h-4 ${
                            option.disabled
                              ? "text-[var(--dash-text-muted)]"
                              : visibility === option.id
                                ? "text-[var(--brand)]"
                                : "text-[var(--dash-text-tertiary)]"
                          }`} />
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[var(--dash-text-primary)]">{option.label}</p>
                              {option.id === "public" && visibility === "public" && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                                  KB
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--dash-text-tertiary)]">{option.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4" />
                      Tags
                    </label>
                    
                    {/* Current tags */}
                    {documentTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {documentTags.map(tag => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--brand)]/10 text-[var(--brand)] rounded-md text-xs font-medium"
                          >
                            # {tag.name}
                            <button
                              onClick={() => handleRemoveTag(tag.id)}
                              className="hover:text-red-500 transition-colors"
                              disabled={loadingTags}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Tag input with dropdown */}
                    <div className="relative">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowTagDropdown(true);
                        }}
                        onFocus={() => setShowTagDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && tagInput.trim()) {
                            e.preventDefault();
                            const existingTag = filteredTags.find(
                              t => t.name.toLowerCase() === tagInput.toLowerCase()
                            );
                            if (existingTag) {
                              handleAddTag(existingTag);
                            } else {
                              handleCreateAndAddTag();
                            }
                          }
                        }}
                        placeholder="Add more tags..."
                        className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                      />
                      
                      {showTagDropdown && (tagInput || filteredTags.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {filteredTags.map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] text-sm"
                            >
                              <span className="text-[var(--dash-text-tertiary)]">#</span>
                              <span className="text-[var(--dash-text-primary)]">{tag.name}</span>
                            </button>
                          ))}
                          {tagInput.trim() && !filteredTags.some(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                            <button
                              onClick={handleCreateAndAddTag}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] text-sm border-t border-[var(--dash-border-subtle)]"
                            >
                              <span className="text-[var(--brand)]">+</span>
                              <span className="text-[var(--dash-text-primary)]">Create &quot;{tagInput}&quot;</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="pt-4 border-t border-[var(--dash-border-subtle)]">
                    <h4 className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">Document Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Created</span>
                        <span className="text-[var(--dash-text-secondary)]">{new Date(document.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Last updated</span>
                        <span className="text-[var(--dash-text-secondary)]">{new Date(document.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Author</span>
                        <span className="text-[var(--dash-text-secondary)]">{document.author}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-[var(--dash-border-subtle)] space-y-2">
                    {status === 'published' && document?.hasDraft && (
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        onClick={handleDiscardDraft}
                        disabled={isSaving}
                      >
                        <Clock className="w-4 h-4" />
                        Discard Draft Changes
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={async () => {
                      try {
                        const response = await createDocument({
                          title: `${title} (Copy)`,
                          content,
                          category_id: selectedCategoryId || undefined,
                        });
                        router.push(`/dashboard/knowledge/${response.document.id}`);
                      } catch (err) {
                        console.error('Failed to duplicate document:', err);
                        addToast({ type: 'error', title: 'Duplicate failed', description: err instanceof Error ? err.message : 'Failed to duplicate document. Please try again.' });
                      }
                    }}>
                      <Copy className="w-4 h-4" />
                      Duplicate Document
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => {
                      const url = `${window.location.origin}/dashboard/knowledge/${documentId}`;
                      navigator.clipboard.writeText(url).then(() => {
                        setShowCopyLinkModal(true);
                      }).catch(() => {
                        setShowCopyLinkModal(true);
                      });
                    }}>
                      <ExternalLink className="w-4 h-4" />
                      Copy Public Link
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Document
                    </Button>
                  </div>
                </div>
              </div>
              </>
            )}

          {/* Version History Sidebar */}
          {showHistory && (
            <VersionHistoryPanel
              documentId={documentId}
              currentTitle={title}
              onClose={() => setShowHistory(false)}
              onRestore={(version) => {
                console.log("Restore version:", version);
                setShowHistory(false);
                // Refresh the page to load restored version
                window.location.reload();
              }}
            />
          )}
        </div>

        {/* Preview Mode - Always mounted to avoid re-fetching */}
        <div className={mode === "read" ? `h-full overflow-y-auto p-4 ${isReadOnly ? "flex justify-center" : "grid grid-cols-12 gap-6 items-start"}` : "hidden"}>
            <div className={isReadOnly ? "w-full max-w-4xl" : "col-span-12 xl:col-span-8"}>
              <TiptapReader content={content} title={title} isHtml={contentIsHtml} />
            </div>
            {!isReadOnly && <div className="col-span-12 xl:col-span-4 space-y-4">
              {/* Version Control Panel */}
              <Card>
                <CardHeader className="pb-4 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] rounded-t-[var(--radius-lg)]">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[var(--brand)]" />
                    <CardTitle className="text-base font-semibold">Version Control</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Track changes and restore previous versions.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Current Version */}
                  <div className="p-3 rounded-lg bg-[var(--brand)]/5 border border-[var(--brand)]/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-[var(--dash-text-primary)] text-sm">
                          Current Version
                        </p>
                        <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">
                          Last saved: {document ? new Date(document.updatedAt).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--dash-text-tertiary)] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Created
                      </span>
                      <span className="text-[var(--dash-text-secondary)]">
                        {document ? new Date(document.createdAt).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--dash-text-tertiary)] flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Author
                      </span>
                      <span className="text-[var(--dash-text-secondary)]">
                        {document?.author || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--dash-text-tertiary)] flex items-center gap-2">
                        {status === 'published' ? (
                          <Globe className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        Status
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'published' 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  {/* View History Button */}
                  <button
                    onClick={() => {
                      setMode("edit");
                      setShowHistory(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors text-sm font-medium"
                  >
                    <History className="w-4 h-4" />
                    View Full History
                  </button>
                </CardContent>
              </Card>
            </div>}
        </div>
      </div>

      {/* Copy Link Success Modal */}
      <Modal
        isOpen={showCopyLinkModal}
        onClose={() => setShowCopyLinkModal(false)}
        size="sm"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-5">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
            Link Copied
          </h3>
          <p className="text-sm text-[var(--dash-text-tertiary)] max-w-xs">
            The document link has been copied to your clipboard.
          </p>
          <button
            onClick={() => setShowCopyLinkModal(false)}
            className="mt-6 px-8 py-2.5 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)] transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Document"
        itemName={title}
        confirmButtonText="Delete Document"
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentId={documentId}
        documentTitle={title}
      />
    </div>
  );
}

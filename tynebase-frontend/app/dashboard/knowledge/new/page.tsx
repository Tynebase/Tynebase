"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  MoreHorizontal,
  Globe,
  Lock,
  Clock,
  Folder,
  Tag,
  Users,
  ChevronDown,
  X,
  Plus,
  Hash,
  Loader2,
  Video,
  AlertCircle,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { createDocument, updateDocument, publishDocument, detectDocumentVideos, ingestDocumentVideos, type EmbeddedVideo } from "@/lib/api/documents";
import { listCategories, type Category as APICategory } from "@/lib/api/folders";
import { listTags, addTagToDocuments, type Tag as APITag } from "@/lib/api/tags";

export default function NewDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private" | "team">("team");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const hasCreatedDocument = useRef(false);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-save title when it changes (debounced)
  useEffect(() => {
    if (!documentId || isCreating || !title) return;
    
    // Clear existing timeout
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }
    
    // Debounce title save by 1 second
    titleSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateDocument(documentId, { title });
        console.log(`[NewDocument] Auto-saved title: ${title}`);
      } catch (err) {
        console.error('Failed to auto-save title:', err);
      }
    }, 1000);
    
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, [title, documentId, isCreating]);
  
  // Categories and tags state
  const [categories, setCategories] = useState<APICategory[]>([]);
  const [tags, setTags] = useState<APITag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);

  // Video ingestion state
  const [embeddedVideos, setEmbeddedVideos] = useState<EmbeddedVideo[]>([]);
  const [estimatedCredits, setEstimatedCredits] = useState(0);
  const [showVideoIngestionModal, setShowVideoIngestionModal] = useState(false);
  const [ingestVideos, setIngestVideos] = useState(false);
  const [videoIngestionOptions, setVideoIngestionOptions] = useState({
    generate_transcript: true,
    generate_summary: false,
    generate_article: false,
    ai_model: 'deepseek' as 'deepseek' | 'gemini' | 'claude',
  });
  const [isCheckingVideos, setIsCheckingVideos] = useState(false);
  const [isIngestingVideos, setIsIngestingVideos] = useState(false);

  // Fetch categories and tags on mount
  useEffect(() => {
    const fetchCategoriesAndTags = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          listCategories({ limit: 100 }),
          listTags({ limit: 100 })
        ]);
        setCategories(categoriesRes.categories);
        setTags(tagsRes.tags);
      } catch (err) {
        console.error('Failed to fetch categories/tags:', err);
      } finally {
        setLoadingCategories(false);
        setLoadingTags(false);
      }
    };
    fetchCategoriesAndTags();
  }, []);

  // Auto-create document on mount to enable collaboration immediately
  useEffect(() => {
    // Prevent duplicate creation in React Strict Mode (dev only)
    if (hasCreatedDocument.current) return;
    hasCreatedDocument.current = true;

    const createInitialDocument = async () => {
      try {
        const response = await createDocument({
          title: "Untitled Document",
          is_public: false,
          category_id: selectedCategoryId || undefined,
        });
        setDocumentId(response.document.id);
        setTitle("Untitled Document");
      } catch (err) {
        console.error('Failed to create document:', err);
        setError(err instanceof Error ? err.message : 'Failed to create document');
      } finally {
        setIsCreating(false);
      }
    };
    createInitialDocument();
  }, []);

  // Update document's category_id when category selection changes
  useEffect(() => {
    if (!documentId || isCreating) return;
    
    const updateCategory = async () => {
      try {
        await updateDocument(documentId, {
          category_id: selectedCategoryId,
        });
        console.log(`[NewDocument] Updated category to: ${selectedCategoryId || 'root'}`);
      } catch (err) {
        console.error('Failed to update category:', err);
      }
    };
    updateCategory();
  }, [documentId, selectedCategoryId, isCreating]);

  // Note: Content is saved automatically by the collab server via WebSocket
  // We only need to save title and visibility via API

  // Check for embedded videos before publishing
  const checkForVideos = async (docId: string) => {
    try {
      setIsCheckingVideos(true);
      const response = await detectDocumentVideos(docId);
      if (response.videos && response.videos.length > 0) {
        setEmbeddedVideos(response.videos);
        setEstimatedCredits(response.totalEstimatedCredits);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to detect videos:', err);
      return false;
    } finally {
      setIsCheckingVideos(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      let docId = documentId;
      
      // Create document first if it doesn't exist
      if (!docId) {
        const response = await createDocument({
          title: title || "Untitled Document",
          visibility: visibility,
        });
        docId = response.document.id;
        setDocumentId(docId);
      } else {
        // Document exists, save title and visibility (content saved by collab server)
        await updateDocument(docId, {
          title: title || "Untitled Document",
          visibility: visibility,
        });
      }

      // Check for embedded videos
      const hasVideos = await checkForVideos(docId);
      if (hasVideos && !ingestVideos) {
        // Show video ingestion modal
        setShowVideoIngestionModal(true);
        setIsSaving(false);
        return;
      }
      
      // Publish the document
      await publishDocument(docId);
      setStatus("published");

      // Ingest videos if option is selected
      if (ingestVideos && embeddedVideos.length > 0) {
        setIsIngestingVideos(true);
        try {
          await ingestDocumentVideos(docId, videoIngestionOptions);
        } catch (ingestErr) {
          console.error('Failed to ingest videos:', ingestErr);
          // Don't block publishing if video ingestion fails
        } finally {
          setIsIngestingVideos(false);
        }
      }
      
      // Add tags to document
      if (selectedTagIds.length > 0) {
        for (const tagId of selectedTagIds) {
          try {
            await addTagToDocuments(tagId, [docId]);
          } catch (tagErr) {
            console.error('Failed to add tag:', tagErr);
          }
        }
      }
      
      // Redirect to the document view page
      router.push(`/dashboard/knowledge/${docId}`);
    } catch (err) {
      console.error('Failed to publish document:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish document');
      setIsSaving(false);
    }
  };

  // Continue publishing after video ingestion decision
  const handlePublishWithVideoDecision = async (shouldIngest: boolean) => {
    setIngestVideos(shouldIngest);
    setShowVideoIngestionModal(false);
    
    // Now publish with the video decision made
    try {
      setIsSaving(true);
      
      const docId = documentId!;
      
      // Publish the document
      await publishDocument(docId);
      setStatus("published");

      // Ingest videos if option is selected
      if (shouldIngest && embeddedVideos.length > 0) {
        setIsIngestingVideos(true);
        try {
          await ingestDocumentVideos(docId, videoIngestionOptions);
        } catch (ingestErr) {
          console.error('Failed to ingest videos:', ingestErr);
        } finally {
          setIsIngestingVideos(false);
        }
      }
      
      // Add tags to document
      if (selectedTagIds.length > 0) {
        for (const tagId of selectedTagIds) {
          try {
            await addTagToDocuments(tagId, [docId]);
          } catch (tagErr) {
            console.error('Failed to add tag:', tagErr);
          }
        }
      }
      
      // Redirect to the document view page
      router.push(`/dashboard/knowledge/${docId}`);
    } catch (err) {
      console.error('Failed to publish document:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish document');
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      let docId = documentId;
      
      // Create document if it doesn't exist
      if (!docId) {
        const response = await createDocument({
          title: title || "Untitled Document",
          visibility: visibility,
        });
        docId = response.document.id;
        setDocumentId(docId);
      } else {
        // Document exists, save title and visibility (content saved by collab server)
        await updateDocument(docId, {
          title: title || "Untitled Document",
          visibility: visibility,
        });
      }
      
      // Add tags to document
      if (selectedTagIds.length > 0) {
        for (const tagId of selectedTagIds) {
          try {
            await addTagToDocuments(tagId, [docId]);
          } catch (tagErr) {
            console.error('Failed to add tag:', tagErr);
          }
        }
      }
      
      // Redirect to the document edit page
      router.push(`/dashboard/knowledge/${docId}`);
    } catch (err) {
      console.error('Failed to save draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      setIsSaving(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-6">
      {/* Error Banner */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        {/* Top row: Back button and breadcrumb */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/dashboard/knowledge" className="flex-shrink-0">
              <Button variant="ghost" className="gap-2 px-2 sm:px-3">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[var(--text-tertiary)] min-w-0 overflow-hidden">
              <span className="hidden md:inline">Knowledge Base</span>
              <span className="hidden md:inline">/</span>
              <span className="text-[var(--text-primary)]">New Document</span>
            </div>
          </div>
          
          {/* Status Badge - always visible */}
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
            status === "draft" 
              ? "bg-amber-500/10 text-amber-600" 
              : "bg-green-500/10 text-green-600"
          }`}>
            {status === "draft" ? (
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
          {/* Preview */}
          <Button variant="ghost" className="gap-1 sm:gap-2 px-2 sm:px-3" onClick={() => setMode(m => m === "edit" ? "preview" : "edit")}>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">{mode === "edit" ? "Preview" : "Back to Editor"}</span>
          </Button>

          {/* Spacer */}
          <div className="flex-1 hidden lg:block" />

          {/* Save Draft */}
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving} className="px-2 sm:px-3">
            <Save className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Save Draft</span>
          </Button>

          {/* Publish */}
          <Button variant="primary" onClick={handlePublish} disabled={isSaving} className="px-2 sm:px-3">
            <Globe className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Publish</span>
          </Button>

          {/* More Options */}
          <Button variant="ghost" className="px-2" onClick={() => setShowSettings(!showSettings)}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {isCreating ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-[var(--text-secondary)]">Creating document...</span>
              </div>
            </div>
          ) : documentId ? (
            <RichTextEditor
              key={`editor-${mode}`}
              documentId={documentId}
              initialTitle={title}
              onTitleChange={setTitle}
              readOnly={mode === "preview"}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--text-secondary)]">Failed to create document. Please try again.</p>
            </div>
          )}
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-y-auto">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Document Settings</h3>
            </div>

            <div className="p-4 space-y-6">
              {/* Category */}
              <div className="relative">
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Folder className="w-4 h-4" />
                  Category
                </label>
                <button 
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-xl text-left hover:border-[var(--border-default)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {selectedCategory && (
                      <div 
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                    )}
                    <span className="text-[var(--text-primary)]">
                      {selectedCategory?.name || "No category (root)"}
                    </span>
                  </div>
                  {loadingCategories ? (
                    <Loader2 className="w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                  )}
                </button>
                
                {showCategoryDropdown && !loadingCategories && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedCategoryId(null);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                        !selectedCategoryId ? 'bg-[var(--brand-primary)]/5' : ''
                      }`}
                    >
                      <span className="text-[var(--text-primary)]">No category (root)</span>
                    </button>
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCategoryId(c.id);
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                          selectedCategoryId === c.id ? 'bg-[var(--brand-primary)]/5' : ''
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-[var(--text-primary)] truncate">{c.name}</span>
                      </button>
                    ))}
                    {categories.length === 0 && (
                      <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                        No categories yet
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Visibility
                </label>
                <div className="space-y-2">
                  {[
                    { id: "public", label: "Public", desc: "Anyone can view", icon: Globe },
                    { id: "team", label: "Team Only", desc: "Workspace members", icon: Users },
                    { id: "private", label: "Private", desc: "Only you", icon: Lock },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setVisibility(option.id as typeof visibility)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        visibility === option.id
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                          : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                      }`}
                    >
                      <option.icon className={`w-4 h-4 ${
                        visibility === option.id 
                          ? "text-[var(--brand-primary)]" 
                          : "text-[var(--text-tertiary)]"
                      }`} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{option.label}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="relative">
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                
                {/* Selected tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTags.map(t => (
                      <span 
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-md text-xs font-medium"
                      >
                        <Hash className="w-3 h-3" />
                        {t.name}
                        <button
                          onClick={() => toggleTag(t.id)}
                          className="ml-0.5 hover:bg-[var(--brand-primary)]/20 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                <button 
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-xl text-left hover:border-[var(--border-default)] transition-colors"
                >
                  <span className="text-[var(--text-tertiary)]">
                    {selectedTags.length > 0 ? 'Add more tags...' : 'Select tags...'}
                  </span>
                  {loadingTags ? (
                    <Loader2 className="w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-[var(--text-tertiary)]" />
                  )}
                </button>
                
                {showTagDropdown && !loadingTags && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {tags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleTag(t.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                          selectedTagIds.includes(t.id) ? 'bg-[var(--brand-primary)]/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-[var(--text-tertiary)]" />
                          <span className="text-[var(--text-primary)]">{t.name}</span>
                        </div>
                        {selectedTagIds.includes(t.id) && (
                          <span className="text-xs text-[var(--brand-primary)]">Selected</span>
                        )}
                      </button>
                    ))}
                    {tags.length === 0 && (
                      <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                        No tags yet. <Link href="/dashboard/knowledge/tags" className="text-[var(--brand-primary)] hover:underline">Create one</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SEO */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                  SEO Description
                </label>
                <textarea
                  placeholder="Brief description for search engines..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Ingestion Modal */}
      {showVideoIngestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowVideoIngestionModal(false)}>
          <div className="bg-[var(--surface-card)] p-6 rounded-3xl shadow-xl max-w-lg w-full mx-4 border border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <Video className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Embedded Videos Detected</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {embeddedVideos.length} video{embeddedVideos.length > 1 ? 's' : ''} found in this document
                </p>
              </div>
            </div>

            <div className="mb-4 p-4 bg-[var(--surface-ground)] rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--brand-primary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">AI Video Ingestion</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Transcribe and analyse embedded videos to make their content searchable and add them to your knowledge base.
              </p>
              
              <div className="space-y-2 mb-3">
                {embeddedVideos.map((video, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <Video className="w-3 h-3" />
                    <span className="truncate flex-1">{video.type === 'youtube' ? 'YouTube: ' : 'Uploaded: '}{video.url.substring(0, 50)}...</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-sm text-[var(--text-secondary)]">Estimated cost:</span>
                <span className="text-sm font-semibold text-[var(--brand-primary)]">{estimatedCredits} credits</span>
              </div>
            </div>

            {/* Ingestion Options */}
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">Output options:</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoIngestionOptions.generate_transcript}
                  onChange={(e) => setVideoIngestionOptions(prev => ({ ...prev, generate_transcript: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Generate transcript</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoIngestionOptions.generate_summary}
                  onChange={(e) => setVideoIngestionOptions(prev => ({ ...prev, generate_summary: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Generate summary (+{videoIngestionOptions.ai_model === 'claude' ? 2 : videoIngestionOptions.ai_model === 'gemini' ? 1 : 0.2} credits/video)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoIngestionOptions.generate_article}
                  onChange={(e) => setVideoIngestionOptions(prev => ({ ...prev, generate_article: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Generate article (+{videoIngestionOptions.ai_model === 'claude' ? 2 : videoIngestionOptions.ai_model === 'gemini' ? 1 : 0.2} credits/video)</span>
              </label>

              <div className="pt-2">
                <label className="text-sm text-[var(--text-secondary)] block mb-1">AI Model:</label>
                <select
                  value={videoIngestionOptions.ai_model}
                  onChange={(e) => setVideoIngestionOptions(prev => ({ ...prev, ai_model: e.target.value as 'deepseek' | 'gemini' | 'claude' }))}
                  className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] text-sm"
                >
                  <option value="deepseek">DeepSeek (5 + 0.2/output credits)</option>
                  <option value="gemini">Gemini (5 + 1/output credits)</option>
                  <option value="claude">Claude (6 + 2/output credits)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Video ingestion uses the same rates as our normal video processing. Credits will be deducted upon job completion.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handlePublishWithVideoDecision(false)}
                disabled={isSaving}
              >
                Skip & Publish
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => handlePublishWithVideoDecision(true)}
                disabled={isSaving || isIngestingVideos}
              >
                {isIngestingVideos ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Ingest & Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

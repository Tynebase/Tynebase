"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { SimpleRichTextEditor } from "@/components/editor/SimpleRichTextEditor";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { createDiscussion, createDraftDiscussion, uploadDiscussionAsset, updateDiscussion, deleteDiscussion } from "@/lib/api/discussions";
import { listTemplates, Template } from "@/lib/api/templates";
import { ArrowLeft, Plus, Send, Tag, Loader2, AlertCircle, BarChart3, X, FileText, Search, Quote, Globe, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const categories = [
  { id: "Announcements", label: "Announcements", color: "#ef4444" },
  { id: "Questions", label: "Questions", color: "#3b82f6" },
  { id: "Ideas", label: "Ideas & Feedback", color: "#8b5cf6" },
  { id: "General", label: "General Discussion", color: "#10b981" },
] as const;

type CategoryId = (typeof categories)[number]["id"];

export default function NewDiscussionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user } = useAuth();
  const isBasicUser = user?.role !== 'admin' && !user?.is_super_admin;

  const availableCategories = useMemo(() => {
    if (isBasicUser) {
      return categories.filter(c => c.id !== "Announcements");
    }
    return categories;
  }, [isBasicUser]);

  const defaultCategory = (): CategoryId => {
    const param = searchParams?.get('category');
    if (param && availableCategories.some(c => c.id === param)) return param as CategoryId;
    return "General";
  };

  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(true);

  // Track if the discussion was successfully posted
  const [wasPosted, setWasPosted] = useState(false);

  // Create draft discussion on mount for asset uploads
  useEffect(() => {
    const initDraft = async () => {
      try {
        const response = await createDraftDiscussion();
        setDraftId(response.discussion_id);
      } catch (err) {
        console.error("Failed to create draft discussion:", err);
      } finally {
        setIsCreatingDraft(false);
      }
    };
    initDraft();
  }, []);

  // Store refs for cleanup to avoid stale closures
  const draftIdRef = useRef<string | null>(null);
  const wasPostedRef = useRef(false);
  
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);
  
  useEffect(() => {
    wasPostedRef.current = wasPosted;
  }, [wasPosted]);

  // Handle back/cancel - delete draft before navigating
  const handleCancel = useCallback(async () => {
    if (draftId && !wasPosted) {
      try {
        await deleteDiscussion(draftId);
      } catch (err) {
        console.error("Failed to cleanup draft discussion:", err);
      }
    }
    router.push('/dashboard/community');
  }, [draftId, wasPosted, router]);

  // Store draft ID for cleanup - will be cleaned up by community page or on next visit
  useEffect(() => {
    if (draftId) {
      // Store in localStorage for cleanup if navigation happens before we can delete
      localStorage.setItem('pendingDraftDiscussion', draftId);
    }
  }, [draftId]);

  // Clear the pending draft marker when successfully posted
  useEffect(() => {
    if (wasPosted) {
      localStorage.removeItem('pendingDraftDiscussion');
    }
  }, [wasPosted]);

  // Cleanup on unmount (route change via Next.js) and browser back button
  useEffect(() => {
    const handlePopState = () => {
      // Browser back/forward button pressed
      if (draftIdRef.current && !wasPostedRef.current) {
        localStorage.setItem('pendingDraftDiscussion', draftIdRef.current);
        deleteDiscussion(draftIdRef.current).catch(console.error);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (draftIdRef.current && !wasPostedRef.current) {
        // Mark for cleanup and attempt delete
        localStorage.setItem('pendingDraftDiscussion', draftIdRef.current);
        deleteDiscussion(draftIdRef.current).catch(console.error);
      }
    };
  }, []);

  // Upload handler for SimpleRichTextEditor
  const handleUploadAsset = useCallback(async (file: File) => {
    if (!draftId) throw new Error("Draft not ready");
    return uploadDiscussionAsset(draftId, file);
  }, [draftId]);

  // Template citation state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Load templates when modal opens
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await listTemplates({ limit: 50 });
      setTemplates(response.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (showTemplateModal && templates.length === 0) {
      loadTemplates();
    }
  }, [showTemplateModal, templates.length, loadTemplates]);

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const search = templateSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search)
    );
  }, [templates, templateSearch]);

  // Insert template citation into content
  const handleCiteTemplate = (template: Template) => {
    const citation = `\n\n> **📄 Referenced Template: ${template.title}**\n> ${template.description || "No description"}\n> *Category: ${template.category || "Uncategorized"}*\n\n`;
    setContent((prev) => prev + citation);
    setShowTemplateModal(false);
    setTemplateSearch("");
  };

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === category),
    [category]
  );

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  const isPollValid = !hasPoll || (
    pollQuestion.trim().length > 0 &&
    pollOptions.filter(o => o.trim().length > 0).length >= 2
  );

  const handleSubmit = async () => {
    if (!isValid || !draftId) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const parsedTags = tags;

      // Mark as posted so cleanup effect doesn't delete it
      setWasPosted(true);

      // If there's a poll, delete the draft and create a fresh discussion with poll
      if (hasPoll && isPollValid) {
        // Delete the draft first to avoid duplicate
        await deleteDiscussion(draftId);
        
        const response = await createDiscussion({
          title: title.trim(),
          content: content.trim(),
          category,
          tags: parsedTags,
          is_public: isPublic,
          poll: {
            question: pollQuestion.trim(),
            options: pollOptions.filter(o => o.trim().length > 0),
          },
        });
        router.push(`/dashboard/community/${response.discussion.id}`);
      } else {
        // Update the draft discussion with the full content (no poll)
        await updateDiscussion(draftId, {
          title: title.trim(),
          content: content.trim(),
          category,
          tags: parsedTags,
          is_public: isPublic,
        });
        router.push(`/dashboard/community/${draftId}`);
      }
    } catch (err) {
      console.error("Failed to create discussion:", err);
      setError(err instanceof Error ? err.message : "Failed to create discussion. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-8">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mx-0">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
      <DashboardPageHeader
        left={
          <Button variant="ghost" size="md" className="px-3" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        }
        title={<h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">New Discussion</h1>}
        description={
          <p className="text-[var(--dash-text-tertiary)]">
            Start a thread for your team. Ask a question, share an update or collect feedback.
          </p>
        }
        right={
          <Button
            variant="primary"
            size="lg"
            className="gap-2 px-7"
            disabled={!isValid || !isPollValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Post
              </>
            )}
          </Button>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-7">
              <div>
                <div className="text-sm font-medium text-[var(--dash-text-secondary)] mb-2">Category</div>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => {
                    const active = cat.id === category;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={
                          "flex items-center gap-2 rounded-lg text-sm font-medium transition-colors px-4 py-2.5 " +
                          (active
                            ? "text-white shadow-sm"
                            : "bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]")
                        }
                        style={active ? { backgroundColor: cat.color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: active ? "rgba(255,255,255,0.9)" : cat.color }}
                        />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What would you like to discuss?"
                className="h-12 px-4"
              />

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">Content</label>
                <SimpleRichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Share your thoughts, add context and include any links or snippets your team might need."
                  minHeight="250px"
                  discussionId={draftId || undefined}
                  onUploadAsset={draftId ? handleUploadAsset : undefined}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 p-3 min-h-[48px] rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] focus-within:border-[var(--brand)] transition-colors">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--brand)]/10 text-[var(--brand)] text-sm font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.includes(",")) {
                        const newTags = value
                          .split(",")
                          .map((t) => t.trim().toLowerCase())
                          .filter((t) => t.length > 0 && !tags.includes(t));
                        if (newTags.length > 0) {
                          setTags([...tags, ...newTags]);
                        }
                        setTagInput("");
                      } else {
                        setTagInput(value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = tagInput.trim().toLowerCase();
                        if (trimmed && !tags.includes(trimmed)) {
                          setTags([...tags, trimmed]);
                          setTagInput("");
                        }
                      } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                        setTags(tags.slice(0, -1));
                      }
                    }}
                    placeholder={tags.length === 0 ? "Type a tag and press Enter, or separate with commas" : "Add another tag..."}
                    className="flex-1 min-w-[150px] h-8 bg-transparent text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none"
                  />
                </div>
                <p className="text-xs text-[var(--dash-text-muted)] mt-1.5">Press Enter or use commas to add tags</p>
              </div>

              {/* Cite Template Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] text-sm font-medium text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--dash-text-primary)] transition-colors"
                >
                  <Quote className="w-4 h-4" />
                  Cite a Template
                </button>
                <span className="text-xs text-[var(--dash-text-muted)]">
                  Reference an existing template in your discussion
                </span>
              </div>

              <div className="border-t border-[var(--dash-border-subtle)] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[var(--brand)]" />
                    <span className="text-sm font-medium text-[var(--dash-text-secondary)]">Poll</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasPoll(!hasPoll)}
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                  >
                    {hasPoll ? "Remove poll" : "Add a poll"}
                  </button>
                </div>

                {hasPoll && (
                  <div className="space-y-4 bg-[var(--surface-ground)] rounded-lg p-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--dash-text-secondary)] mb-1 block">Poll Question</label>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="Ask your question..."
                        className="w-full h-10 px-3 rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--dash-text-secondary)] mb-2 block">Options</label>
                      <div className="space-y-2">
                        {pollOptions.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...pollOptions];
                                newOptions[index] = e.target.value;
                                setPollOptions(newOptions);
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 h-10 px-3 rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = pollOptions.filter((_, i) => i !== index);
                                  setPollOptions(newOptions);
                                }}
                                className="p-2 text-[var(--dash-text-muted)] hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 6 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions([...pollOptions, ""])}
                            className="flex items-center gap-2 text-sm text-[var(--brand)] hover:underline mt-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add option
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-2">Posting tips</div>
              <div className="text-sm text-[var(--dash-text-tertiary)] space-y-2">
                <div>Use a descriptive title so others can find it later.</div>
                <div>Include steps, expected behaviour and what you already tried.</div>
                <div>Add tags to help with search and filtering.</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-3">Selected category</div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--dash-text-secondary)] truncate">
                    {selectedCategory?.label ?? ""}
                  </div>
                  <div className="text-xs text-[var(--dash-text-muted)] mt-1">
                    Choose where your thread belongs.
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${selectedCategory?.color ?? "#999"}15`, color: selectedCategory?.color ?? "#999" }}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {category}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-3">Visibility</div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={
                    "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors " +
                    (isPublic
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--dash-border-subtle)] hover:bg-[var(--surface-ground)]")
                  }
                >
                  <Globe className={"w-5 h-5 mt-0.5 flex-shrink-0 " + (isPublic ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)]")} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--dash-text-primary)]">Public</div>
                    <div className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Everyone in the TyneBase community can see and reply.</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={
                    "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors " +
                    (!isPublic
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--dash-border-subtle)] hover:bg-[var(--surface-ground)]")
                  }
                >
                  <Lock className={"w-5 h-5 mt-0.5 flex-shrink-0 " + (!isPublic ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)]")} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--dash-text-primary)]">Private</div>
                    <div className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">Only members of your workspace can see and reply.</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="lg" className="w-full px-6" asChild>
            <Link href="/dashboard/community">
              <Plus className="w-5 h-5" />
              Browse discussions
            </Link>
          </Button>
        </div>
      </div>

      {/* Template Citation Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTemplateModal(false)}
          />
          <div className="relative w-full max-w-lg bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[var(--brand)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">
                    Cite a Template
                  </h2>
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    Select a template to reference in your discussion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-[var(--dash-border-subtle)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--dash-text-muted)]">
                    {templateSearch ? "No templates match your search" : "No templates available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleCiteTemplate(template)}
                      className="w-full text-left p-4 rounded-lg border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] hover:bg-[var(--surface-ground)] transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] truncate">
                            {template.title}
                          </div>
                          {template.description && (
                            <p className="text-xs text-[var(--dash-text-muted)] mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {template.category && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                                {template.category}
                              </span>
                            )}
                            <span className="text-xs text-[var(--dash-text-muted)]">
                              by {template.users?.full_name || template.users?.email || "Unknown"}
                            </span>
                          </div>
                        </div>
                        <Quote className="w-4 h-4 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)] flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--dash-text-muted)]">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} available
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

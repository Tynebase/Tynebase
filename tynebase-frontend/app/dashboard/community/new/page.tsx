"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { SimpleRichTextEditor } from "@/components/editor/SimpleRichTextEditor";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { createDiscussion } from "@/lib/api/discussions";
import { listTemplates, Template } from "@/lib/api/templates";
import { ArrowLeft, Plus, Send, Tag, Loader2, AlertCircle, BarChart3, X, FileText, Search, Quote } from "lucide-react";

const categories = [
  { id: "Announcements", label: "Announcements", color: "#ef4444" },
  { id: "Questions", label: "Questions", color: "#3b82f6" },
  { id: "Ideas", label: "Ideas & Feedback", color: "#8b5cf6" },
  { id: "General", label: "General Discussion", color: "#10b981" },
] as const;

type CategoryId = (typeof categories)[number]["id"];

export default function NewDiscussionPage() {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryId>("General");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const response = await createDiscussion({
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parsedTags,
        poll: hasPoll && isPollValid ? {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.trim().length > 0),
        } : undefined,
      });

      // Redirect to the new discussion on success
      router.push(`/dashboard/community/${response.discussion.id}`);
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
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
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
                  {categories.map((cat) => {
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
                />
              </div>

              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. webhooks, integrations, best-practices"
                className="h-12 px-4"
              />

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

"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { SimpleRichTextEditor } from "@/components/editor/SimpleRichTextEditor";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { getDiscussion, updateDiscussion, uploadDiscussionAsset } from "@/lib/api/discussions";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Save, Loader2, AlertCircle, Tag } from "lucide-react";

const categories = [
  { id: "Announcements", label: "Announcements", color: "#ef4444" },
  { id: "Questions", label: "Questions", color: "#3b82f6" },
  { id: "Ideas", label: "Ideas & Feedback", color: "#8b5cf6" },
  { id: "General", label: "General Discussion", color: "#10b981" },
] as const;

type CategoryId = (typeof categories)[number]["id"];

export default function EditDiscussionPage() {
  const router = useRouter();
  const params = useParams();
  const discussionId = params.id as string;
  const { user } = useAuth();

  const [category, setCategory] = useState<CategoryId>("General");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  // Fetch discussion data
  useEffect(() => {
    const fetchDiscussion = async () => {
      try {
        setIsLoading(true);
        const response = await getDiscussion(discussionId);
        const discussion = response.discussion;

        // Check if user is the author
        if (discussion.author?.id !== user?.id) {
          setUnauthorized(true);
          return;
        }

        setTitle(discussion.title);
        setContent(discussion.content);
        setCategory(discussion.category as CategoryId);
        setTags((discussion.tags || []).join(", "));
      } catch (err) {
        console.error("Failed to fetch discussion:", err);
        setError("Failed to load discussion. It may have been deleted.");
      } finally {
        setIsLoading(false);
      }
    };

    if (discussionId && user) {
      fetchDiscussion();
    }
  }, [discussionId, user]);

  // Upload handler for SimpleRichTextEditor
  const handleUploadAsset = useCallback(async (file: File) => {
    return uploadDiscussionAsset(discussionId, file);
  }, [discussionId]);

  const selectedCategory = categories.find((c) => c.id === category);
  const isValid = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await updateDiscussion(discussionId, {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parsedTags,
      });

      router.push(`/dashboard/community/${discussionId}`);
    } catch (err) {
      console.error("Failed to update discussion:", err);
      setError(err instanceof Error ? err.message : "Failed to update discussion. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-full flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">Unauthorized</h2>
            <p className="text-[var(--dash-text-tertiary)] mt-2">
              You can only edit discussions that you created.
            </p>
            <Button variant="primary" size="md" className="mt-4" asChild>
              <Link href="/dashboard/community">
                Return to Community
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="min-h-full flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">Error</h2>
            <p className="text-[var(--dash-text-tertiary)] mt-2">{error}</p>
            <Button variant="primary" size="md" className="mt-4" asChild>
              <Link href="/dashboard/community">
                Return to Community
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-8">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
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
            <Link href={`/dashboard/community/${discussionId}`}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        }
        title={<h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Edit Discussion</h1>}
        description={
          <p className="text-[var(--dash-text-tertiary)]">
            Update your discussion content and settings.
          </p>
        }
        right={
          <Button
            variant="primary"
            size="lg"
            className="gap-2 px-7"
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
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
                  discussionId={discussionId}
                  onUploadAsset={handleUploadAsset}
                />
              </div>

              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. webhooks, integrations, best-practices"
                className="h-12 px-4"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
              <div className="font-semibold text-[var(--dash-text-primary)] mb-2">Editing tips</div>
              <div className="text-sm text-[var(--dash-text-tertiary)] space-y-2">
                <div>Keep your title descriptive and clear.</div>
                <div>Add or update tags to improve discoverability.</div>
                <div>Changes are saved when you click "Save Changes".</div>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="lg" className="w-full px-6" asChild>
            <Link href={`/dashboard/community/${discussionId}`}>
              Cancel
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

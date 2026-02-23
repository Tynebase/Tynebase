"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent } from "@/components/ui/Card";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { PollDisplay } from "@/components/PollDisplay";
import { useAuth } from "@/contexts/AuthContext";
import {
  Discussion,
  DiscussionReply,
  getDiscussion,
  getDiscussionReplies,
  createReply,
  toggleDiscussionLike,
  toggleReplyLike,
  toggleDiscussionPin,
  toggleDiscussionLock,
  toggleDiscussionResolved,
  deleteDiscussion,
  acceptReplyAsAnswer,
} from "@/lib/api/discussions";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  MessageSquare,
  Pin,
  Send,
  ThumbsUp,
  Loader2,
  MoreHorizontal,
  Lock,
  Unlock,
  Trash2,
  Check,
} from "lucide-react";


export default function DiscussionPage() {
  const router = useRouter();
  const params = useParams();
  const discussionId = params.id as string;
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<DiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isAdmin = user?.role === 'admin' || (user as { role?: string })?.role === 'super_admin';
  const isEditor = user?.role === 'editor';
  const canModerate = isAdmin || isEditor;
  const isAuthor = discussion?.author?.id === user?.id;

  const fetchDiscussion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getDiscussion(discussionId);
      setDiscussion(response.discussion);
      
      const repliesResponse = await getDiscussionReplies(discussionId);
      setReplies(repliesResponse.replies);
    } catch (err) {
      console.error("Failed to fetch discussion:", err);
      setError("Failed to load discussion.");
    } finally {
      setLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    fetchDiscussion();
  }, [fetchDiscussion]);

  const handleSubmitReply = async () => {
    if (!reply.trim() || submitting) return;
    try {
      setSubmitting(true);
      const response = await createReply(discussionId, { content: reply.trim() });
      setReplies(prev => [...prev, response.reply]);
      setReply("");
      if (discussion) {
        setDiscussion({ ...discussion, replies_count: discussion.replies_count + 1 });
      }
    } catch (err) {
      console.error("Failed to post reply:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeDiscussion = async () => {
    if (!discussion) return;
    try {
      const response = await toggleDiscussionLike(discussionId);
      setDiscussion({
        ...discussion,
        has_liked: response.liked,
        likes_count: response.liked ? discussion.likes_count + 1 : discussion.likes_count - 1,
      });
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleLikeReply = async (replyId: string) => {
    try {
      const response = await toggleReplyLike(discussionId, replyId);
      setReplies(prev => prev.map(r => 
        r.id === replyId 
          ? { ...r, has_liked: response.liked, likes_count: response.liked ? r.likes_count + 1 : r.likes_count - 1 }
          : r
      ));
    } catch (err) {
      console.error("Failed to toggle reply like:", err);
    }
  };

  const handleTogglePin = async () => {
    if (!discussion) return;
    try {
      const response = await toggleDiscussionPin(discussionId);
      setDiscussion({ ...discussion, is_pinned: response.is_pinned });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleToggleLock = async () => {
    if (!discussion) return;
    try {
      const response = await toggleDiscussionLock(discussionId);
      setDiscussion({ ...discussion, is_locked: response.is_locked });
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  const handleToggleResolved = async () => {
    if (!discussion) return;
    try {
      const response = await toggleDiscussionResolved(discussionId);
      setDiscussion({ ...discussion, is_resolved: response.is_resolved });
    } catch (err) {
      console.error("Failed to toggle resolved:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this discussion?")) return;
    try {
      await deleteDiscussion(discussionId);
      router.push("/dashboard/community");
    } catch (err) {
      console.error("Failed to delete discussion:", err);
    }
  };

  const handleAcceptAnswer = async (replyId: string) => {
    try {
      const response = await acceptReplyAsAnswer(discussionId, replyId);
      setReplies(prev => prev.map(r => ({
        ...r,
        is_accepted_answer: r.id === replyId ? response.is_accepted_answer : false,
      })));
      if (response.is_accepted_answer && discussion) {
        setDiscussion({ ...discussion, is_resolved: true });
      }
    } catch (err) {
      console.error("Failed to accept answer:", err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (error || !discussion) {
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
          <CardContent className="p-8">
            <div className="text-lg font-semibold text-[var(--dash-text-primary)]">
              {error || "Discussion not found"}
            </div>
            <div className="text-sm text-[var(--dash-text-tertiary)] mt-2">
              The discussion you're looking for doesn't exist or couldn't be loaded.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const authorName = discussion.author?.full_name || discussion.author?.email || "Unknown";
  const authorInitials = authorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-full flex flex-col gap-8">
      <DashboardPageHeader
        left={
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        }
        title={
          <div className="flex items-center gap-2 justify-center">
            {discussion.is_pinned && <Pin className="w-4 h-4 text-[var(--brand)]" />}
            {discussion.is_resolved && (
              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
            )}
            {discussion.is_locked && <Lock className="w-4 h-4 text-[var(--dash-text-muted)]" />}
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
              {discussion.title}
            </h1>
          </div>
        }
        description={
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[var(--dash-text-tertiary)] mt-2">
            <span className="font-medium text-[var(--dash-text-secondary)]">
              {authorName}
            </span>
            <span>{formatDate(discussion.created_at)}</span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              {discussion.replies_count} replies
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {discussion.views_count} views
            </span>
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4" />
              {discussion.likes_count} likes
            </span>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            {(canModerate || isAuthor) && (
              <div className="relative">
                <Button variant="outline" size="md" className="px-3" onClick={() => setShowActions(!showActions)}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                {showActions && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg py-1 min-w-[160px] z-10">
                    {canModerate && (
                      <>
                        <button onClick={handleTogglePin} className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-hover)] flex items-center gap-2">
                          <Pin className="w-4 h-4" />
                          {discussion.is_pinned ? "Unpin" : "Pin"}
                        </button>
                        <button onClick={handleToggleLock} className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-hover)] flex items-center gap-2">
                          {discussion.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {discussion.is_locked ? "Unlock" : "Lock"}
                        </button>
                      </>
                    )}
                    {(canModerate || isAuthor) && (
                      <button onClick={handleToggleResolved} className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-hover)] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {discussion.is_resolved ? "Mark Unresolved" : "Mark Resolved"}
                      </button>
                    )}
                    {(isAdmin || isAuthor) && (
                      <button onClick={handleDelete} className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-hover)] flex items-center gap-2 text-red-600">
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button variant="primary" size="lg" className="gap-2 px-7" asChild>
              <Link href="/dashboard/community/new">
                <Send className="w-5 h-5" />
                New Discussion
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6 min-h-0">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-sm flex-shrink-0">
                    {authorInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--dash-text-primary)]">
                      {authorName}
                    </div>
                    <div className="text-sm text-[var(--dash-text-tertiary)]">
                      Posted {formatDate(discussion.created_at)}
                    </div>
                  </div>
                </div>

                <div 
                  className="text-[var(--dash-text-primary)] leading-relaxed [&>p]:my-2 [&>p]:leading-relaxed [&>p:empty]:h-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-semibold [&>em]:italic [&>code]:bg-[var(--surface-ground)] [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm [&>a]:text-[var(--brand)] [&>a]:underline"
                  dangerouslySetInnerHTML={{ __html: discussion.content }}
                />

                {discussion.poll && (
                  <PollDisplay
                    poll={discussion.poll}
                    discussionId={discussion.id}
                  />
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {(discussion.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-muted)] rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Button 
                    variant={discussion.has_liked ? "primary" : "outline"} 
                    size="md" 
                    className="px-5"
                    onClick={handleLikeDiscussion}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {discussion.has_liked ? "Liked" : "Like"} ({discussion.likes_count})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-4">Replies ({replies.length})</div>

              <div className="space-y-4">
                {replies.length === 0 ? (
                  <p className="text-sm text-[var(--dash-text-tertiary)]">No replies yet. Be the first to respond!</p>
                ) : (
                  replies.map((r) => {
                    const replyAuthor = r.author?.full_name || r.author?.email || "Unknown";
                    const replyInitials = replyAuthor.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={r.id}
                        className={`border rounded-xl p-5 ${r.is_accepted_answer ? "border-[var(--status-success)] bg-[var(--status-success)]/5" : "border-[var(--dash-border-subtle)]"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-[var(--dash-text-secondary)] font-semibold text-xs flex-shrink-0">
                              {replyInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                                {replyAuthor}
                                {r.is_accepted_answer && (
                                  <span className="inline-flex items-center text-[10px] bg-[var(--status-success)]/10 text-[var(--status-success)] px-1.5 py-0.5 rounded font-medium">
                                    <Check className="w-3 h-3 mr-1" /> Accepted
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--dash-text-muted)]">{formatDate(r.created_at)}</div>
                            </div>
                          </div>
                          {isAuthor && !r.is_accepted_answer && (
                            <Button variant="ghost" size="sm" onClick={() => handleAcceptAnswer(r.id)} className="text-xs">
                              <Check className="w-3 h-3 mr-1" /> Accept
                            </Button>
                          )}
                        </div>
                        <div 
                          className="text-sm text-[var(--dash-text-tertiary)] mt-3 leading-relaxed [&>p]:my-1 [&>p]:leading-relaxed [&>p:empty]:h-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>strong]:font-semibold [&>em]:italic [&>code]:bg-[var(--surface-ground)] [&>code]:px-1 [&>code]:rounded [&>code]:text-xs [&>a]:text-[var(--brand)] [&>a]:underline"
                          dangerouslySetInnerHTML={{ __html: r.content }}
                        />
                        <div className="flex items-center gap-2 mt-3">
                          <Button 
                            variant={r.has_liked ? "primary" : "ghost"} 
                            size="sm" 
                            className="text-xs"
                            onClick={() => handleLikeReply(r.id)}
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            {r.likes_count}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-3">Write a reply</div>
              {discussion.is_locked ? (
                <p className="text-sm text-[var(--dash-text-muted)]">This discussion is locked. No new replies can be added.</p>
              ) : (
                <>
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add a helpful reply..."
                    rows={8}
                    className="px-4 py-3 bg-[var(--surface-card)]"
                  />
                  <div className="flex items-center justify-end gap-3 mt-4">
                    <Button variant="outline" size="md" className="px-5" onClick={() => setReply("")}
                      disabled={reply.trim().length === 0}
                    >
                      Clear
                    </Button>
                    <Button 
                      variant="primary" 
                      size="md" 
                      className="px-5" 
                      disabled={reply.trim().length === 0 || submitting}
                      onClick={handleSubmitReply}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Post Reply
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-2">About</div>
              <div className="text-sm text-[var(--dash-text-tertiary)] space-y-2">
                <div>Keep conversations respectful and searchable.</div>
                <div>Mark resolved answers where applicable.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { memo, useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Discussion,
  DiscussionReply,
  getPublicDiscussion,
} from "@/lib/api/discussions";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  MessageSquare,
  Pin,
  ThumbsUp,
  Loader2,
  Lock,
  CornerDownRight,
  Users,
  Calendar,
} from "lucide-react";

function getSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  const parts = hostname.split('.');
  const baseParts = baseDomain.split('.');
  if (parts.length <= baseParts.length) return null;
  const sub = parts.slice(0, parts.length - baseParts.length).join('.');
  if (!sub || sub === 'www') return null;
  return sub;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 8640000);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

const HtmlContent = ({ content, className }: { content: string; className: string }) => (
  <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
);

export default function PublicDiscussionPage() {
  const params = useParams();
  const router = useRouter();
  const discussionId = params.id as string;
  const subdomain = getSubdomainFromHost();

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<DiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [nestedReply, setNestedReply] = useState("");

  useEffect(() => {
    if (!subdomain) {
      setError("This page is only available on custom domains");
      setLoading(false);
      return;
    }

    async function fetchDiscussion() {
      try {
        setLoading(true);
        setError(null);
        const response = await getPublicDiscussion(subdomain!, discussionId);
        setDiscussion(response.discussion);
        setReplies(response.replies || []);
      } catch (err) {
        console.error("Failed to fetch discussion:", err);
        setError("Discussion not found or not accessible");
      } finally {
        setLoading(false);
      }
    }
    fetchDiscussion();
  }, [subdomain, discussionId]);

  const handleSubmitReply = async (parentId?: string) => {
    const content = parentId ? nestedReply.trim() : reply.trim();
    if (!content || submitting) return;
    
    // For public page, we'd need to redirect to login
    router.push('/community/login');
  };

  const buildReplyTree = (replies: DiscussionReply[], parentId: string | null = null): DiscussionReply[] => {
    return replies
      .filter(r => (r.parent_id || null) === parentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const rootReplies = buildReplyTree(replies, null);

  const renderReply = (r: DiscussionReply, depth: number = 0) => {
    const replyAuthor = r.author?.full_name || r.author?.email || "Unknown";
    const replyInitials = replyAuthor.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    const childReplies = buildReplyTree(replies, r.id);
    const maxDepth = 4;
    
    return (
      <div key={r.id} className={depth > 0 ? "mt-3" : ""}>
        <div
          className={`border rounded-xl p-4 ${r.is_accepted_answer ? "border-[var(--status-success)] bg-[var(--status-success)]/5" : "border-[var(--dash-border-subtle)]"}`}
          style={{ marginLeft: depth > 0 ? `${Math.min(depth, maxDepth) * 24}px` : 0 }}
        >
          {depth > 0 && (
            <div className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] mb-2">
              <CornerDownRight className="w-3 h-3" />
              <span>Reply</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-[var(--dash-text-secondary)] font-semibold text-xs flex-shrink-0">
                {replyInitials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                  {replyAuthor}
                  {r.is_accepted_answer && (
                    <span className="inline-flex items-center text-[10px] bg-[var(--status-success)]/10 text-[var(--status-success)] px-1.5 py-0.5 rounded font-medium">
                      Accepted
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--dash-text-muted)]">{formatDate(r.created_at)}</div>
              </div>
            </div>
          </div>
          
          <HtmlContent
            className="text-sm text-[var(--dash-text-tertiary)] mt-3 leading-relaxed [&>p]:my-1 [&>p]:leading-relaxed [&>p:empty]:h-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>strong]:font-semibold [&>em]:italic [&>code]:bg-[var(--surface-ground)] [&>code]:px-1 [&>code]:rounded [&>code]:text-xs [&_a]:!text-[#f97316] [&_a]:!underline [&_a]:hover:!opacity-80"
            content={r.content}
          />
        </div>
        
        {childReplies.length > 0 && (
          <div className="space-y-3">
            {childReplies.map(child => renderReply(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const authorName = discussion?.author?.full_name || discussion?.author?.email || "Unknown";
  const authorInitials = authorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        <SiteNavbar currentPage="other" />
        <div style={{ paddingTop: '200px', textAlign: 'center' }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading discussion...</p>
        </div>
      </div>
    );
  }

  if (error || !discussion) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        <SiteNavbar currentPage="other" />
        <div style={{ paddingTop: '200px', textAlign: 'center', maxWidth: '500px', margin: '0 auto', padding: '0 20px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{error || "Discussion not found"}</p>
          <Link href="/community" className="btn btn-primary mt-4">Back to Community</Link>
        </div>
      </div>
    );
  }

  const companyName = discussion.tenant_id ? "" : "Community";

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <SiteNavbar currentPage="other" />

      <section style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        <div className="container" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link 
            href="/community"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', textDecoration: 'none' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Link>

          <div className="flex items-center gap-2 mb-4">
            {discussion.is_pinned && <Pin className="w-4 h-4 text-[var(--brand)]" />}
            {discussion.is_resolved && <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />}
            {discussion.is_locked && <Lock className="w-4 h-4 text-[var(--dash-text-muted)]" />}
          </div>

          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.2 }}>
            {discussion.title}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users className="w-4 h-4" /> {authorName}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar className="w-4 h-4" /> {formatDate(discussion.created_at)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare className="w-4 h-4" /> {discussion.replies_count} replies</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Eye className="w-4 h-4" /> {discussion.views_count} views</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ThumbsUp className="w-4 h-4" /> {discussion.likes_count} likes</span>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div className="w-11 h-11 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-sm flex-shrink-0">
                {authorInitials}
              </div>
              <div>
                <div className="font-semibold text-[var(--text-primary)]">{authorName}</div>
                <div className="text-sm text-[var(--text-tertiary)]">Posted {formatDate(discussion.created_at)}</div>
              </div>
            </div>

            <HtmlContent
              className="text-[var(--text-primary)] leading-relaxed [&>p]:my-2 [&>p]:leading-relaxed [&>p:empty]:h-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-semibold [&>em]:italic [&>code]:bg-[var(--surface-ground)] [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm [&_a]:!text-[#f97316] [&_a]:!underline [&_a]:hover:!opacity-80"
              content={discussion.content}
            />

            {discussion.poll && (
              <div style={{ marginTop: '24px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Poll</h3>
                <p style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '20px' }}>{discussion.poll.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {discussion.poll.options.map((option) => (
                    <div key={option.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{option.text}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{option.votes_count} votes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '24px' }}>
              {(discussion.tags || []).map((tag) => (
                <span key={tag} style={{ padding: '4px 12px', background: 'var(--bg-secondary)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>Replies ({replies.length})</h2>

            {rootReplies.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>No replies yet</p>
            ) : (
              <div className="space-y-4">
                {rootReplies.map((r) => renderReply(r, 0))}
              </div>
            )}

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Want to reply? <Link href="/community/login" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>Sign in</Link> to join the conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="community" />
    </div>
  );
}

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
  createReply,
  togglePublicDiscussionLike,
  voteOnPublicPoll,
  togglePublicReplyLike,
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
  User,
  LogOut,
  Send,
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
  const diffDays = Math.floor(diffMs / 86400000);
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
  const router = useRouter();
  const params = useParams();
  const discussionId = params.id as string;
  const subdomain = getSubdomainFromHost();
  const { user, signOut: authSignOut } = useAuth();

  const signOut = async () => {
    await authSignOut();
    window.location.href = '/community/login';
  };

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<DiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<{ name: string; branding: { primary_color?: string; company_name?: string; logo_url?: string } } | null>(null);

  useEffect(() => {
    if (!subdomain) {
      setError("This page is only available on custom domains");
      setLoading(false);
      return;
    }

    // Fetch tenant branding
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${baseUrl}/api/public/tenant-by-domain?domain=${encodeURIComponent(window.location.hostname)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const t = data?.data?.tenant || null;
        if (t) {
          setTenant(t);
          if (t.branding?.primary_color) {
            document.documentElement.style.setProperty('--brand', t.branding.primary_color);
          }
        }
      })
      .catch(() => {});

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

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !discussion) return;
    setSubmittingReply(true);
    setReplyError(null);
    try {
      const result = await createReply(discussion.id, { content: replyContent });
      setReplies(prev => [...prev, result.reply]);
      setReplyContent("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleLikeDiscussion = async () => {
    if (!user || !subdomain || !discussion) return;
    try {
      const result = await togglePublicDiscussionLike(subdomain, discussion.id);
      setDiscussion(prev => prev ? {
        ...prev,
        has_liked: result.liked,
        likes_count: prev.likes_count + (result.liked ? 1 : -1)
      } : null);
    } catch (err) {
      console.error("Failed to like discussion:", err);
    }
  };

  const handleVote = async (optionId: string) => {
    if (!user || !subdomain || !discussion || !discussion.poll) return;
    try {
      const result = await voteOnPublicPoll(subdomain, discussion.id, optionId);
      setDiscussion(prev => prev ? {
        ...prev,
        poll: result.poll
      } : null);
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  const handleLikeReply = async (replyId: string) => {
    if (!user || !subdomain) return;
    try {
      const result = await togglePublicReplyLike(subdomain, replyId);
      setReplies(prev => prev.map(r => r.id === replyId ? {
        ...r,
        has_liked: result.liked,
        likes_count: r.likes_count + (result.liked ? 1 : -1)
      } : r));
    } catch (err) {
      console.error("Failed to like reply:", err);
    }
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
          
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => handleLikeReply(r.id)}
              disabled={!user}
              className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${r.has_liked ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"}`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${r.has_liked ? "fill-current" : ""}`} />
              {r.likes_count > 0 && <span>{r.likes_count}</span>}
              <span>Like</span>
            </button>
          </div>
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

  const companyName = tenant?.branding?.company_name || tenant?.name || "Community";
  const primaryColor = tenant?.branding?.primary_color || 'var(--brand)';

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      {tenant ? (
        <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(10,10,15,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Link href="/community" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                {tenant.branding.logo_url ? (
                  <img src={tenant.branding.logo_url} alt={companyName} style={{ height: '32px', width: 'auto' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', background: primaryColor }}>
                    {companyName.charAt(0)}
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{companyName}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Community</p>
                </div>
              </Link>
            </div>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{user.email}</span>
                </div>
                <button
                  onClick={signOut}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href="/community/login" className="btn btn-secondary btn-sm">Sign In</Link>
                <Link href="/community/signup" className="btn btn-primary btn-sm">Join</Link>
              </div>
            )}
          </div>
        </header>
      ) : (
        <SiteNavbar currentPage="other" />
      )}

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
            <button
              onClick={handleLikeDiscussion}
              disabled={!user}
              style={{ background: 'none', border: 'none', padding: 0, cursor: user ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px', color: discussion.has_liked ? 'var(--brand)' : 'var(--text-muted)', fontSize: 'inherit' }}
            >
              <ThumbsUp className={`w-4 h-4 ${discussion.has_liked ? "fill-current" : ""}`} /> {discussion.likes_count} likes
            </button>
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
              <div style={{ marginTop: '24px', padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Poll</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '4px 8px', borderRadius: '4px' }}>
                    {discussion.poll.total_votes} total votes
                  </span>
                </div>
                <p style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '24px', fontWeight: 500 }}>{discussion.poll.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {discussion.poll.options.map((option) => {
                    const percentage = discussion.poll!.total_votes > 0 ? Math.round((option.votes_count / discussion.poll!.total_votes) * 100) : 0;
                    const isSelected = discussion.poll!.selected_option_id === option.id;
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleVote(option.id)}
                        disabled={!user || (discussion.poll!.ends_at && new Date(discussion.poll!.ends_at) < new Date())}
                        style={{ 
                          position: 'relative',
                          width: '100%',
                          textAlign: 'left',
                          padding: '16px',
                          background: 'var(--bg-elevated)',
                          borderRadius: '10px',
                          border: `1px solid ${isSelected ? 'var(--brand)' : 'var(--border-subtle)'}`,
                          cursor: user ? 'pointer' : 'default',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Progress bar background */}
                        <div style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          bottom: 0, 
                          width: `${percentage}%`, 
                          background: isSelected ? 'var(--brand-primary-muted)' : 'var(--surface-subtle)', 
                          opacity: 0.3,
                          zIndex: 0,
                          transition: 'width 0.5s ease-out'
                        }} />
                        
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '18px', 
                              height: '18px', 
                              borderRadius: '50%', 
                              border: `2px solid ${isSelected ? 'var(--brand)' : 'var(--text-tertiary)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand)' }} />}
                            </div>
                            <span style={{ fontSize: '15px', fontWeight: isSelected ? 600 : 400, color: 'var(--text-primary)' }}>{option.text}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{option.votes_count} votes</span>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? 'var(--brand)' : 'var(--text-primary)', width: '40px', textAlign: 'right' }}>{percentage}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!user && (
                  <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Please <Link href="/community/login" style={{ color: 'var(--brand)', fontWeight: 500 }}>sign in</Link> to vote.
                  </p>
                )}
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
              {user ? (
                <form onSubmit={handleSubmitReply}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Leave a reply</p>
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="Write your reply..."
                    rows={4}
                    style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {replyError && <p style={{ fontSize: '13px', color: 'var(--status-error)', marginTop: '8px' }}>{replyError}</p>}
                  <button
                    type="submit"
                    disabled={submittingReply || !replyContent.trim()}
                    style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: primaryColor, color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: submittingReply || !replyContent.trim() ? 'not-allowed' : 'pointer', opacity: submittingReply || !replyContent.trim() ? 0.6 : 1 }}
                  >
                    {submittingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submittingReply ? 'Posting...' : 'Post Reply'}
                  </button>
                </form>
              ) : (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Want to reply? <Link href="/community/login" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>Sign in</Link> to join the conversation.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="community" />
    </div>
  );
}

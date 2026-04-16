"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Eye, Pin, Search, TrendingUp,
  CheckCircle2, HelpCircle, Bell, Award, BarChart3, Loader2,
  Lock, ThumbsUp, User, LogOut, Users,
} from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicDiscussions, Discussion } from "@/lib/api/discussions";

// Same hardcoded categories as dashboard — these match the category values stored on discussions
const CATEGORIES = [
  { id: "all",           label: "All Discussions",   icon: null,         color: "#6b7280", description: "Browse all community discussions" },
  { id: "Announcements", label: "Announcements",      icon: Bell,         color: "#ef4444", description: "Official updates and news" },
  { id: "Questions",     label: "Questions",          icon: HelpCircle,   color: "#3b82f6", description: "Get help from the community" },
  { id: "Ideas",         label: "Ideas & Feedback",   icon: TrendingUp,   color: "#8b5cf6", description: "Share suggestions and vote" },
  { id: "General",       label: "General Discussion", icon: MessageSquare, color: "#10b981", description: "Chat about anything" },
];

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

interface TenantInfo {
  id: string;
  subdomain: string;
  name: string;
  branding: { primary_color?: string; company_name?: string; logo_url?: string };
}

function CommunityContent() {
  const { user, signOut: authSignOut } = useAuth();
  const signOut = async () => {
    await authSignOut();
    window.location.href = '/community/login';
  };
  const searchParams = useSearchParams();
  const domain =
    searchParams.get("domain") ||
    (typeof window !== "undefined" ? window.location.hostname : null);

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "unanswered">("recent");
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Resolve tenant from domain
  useEffect(() => {
    if (!domain) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${baseUrl}/api/public/tenant-by-domain?domain=${encodeURIComponent(domain)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const t = data?.data?.tenant || null;
        setTenant(t);
        setSubdomain(t?.subdomain || null);
        if (t?.branding?.primary_color) {
          document.documentElement.style.setProperty("--brand", t.branding.primary_color);
          document.documentElement.style.setProperty("--brand-primary", t.branding.primary_color);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to resolve tenant:", err);
        setLoading(false);
      });
  }, [domain]);

  const fetchDiscussions = useCallback(
    async (page = 1) => {
      if (!subdomain) return;
      try {
        setLoading(true);
        const response = await listPublicDiscussions(subdomain, {
          category: activeCategory === "all" ? undefined : activeCategory,
          sortBy,
          page,
          limit: 20,
        });
        setDiscussions(response.discussions);
        setPagination({
          page: response.pagination?.page ?? 1,
          totalPages: response.pagination?.totalPages ?? 1,
          total: response.pagination?.total ?? response.discussions.length,
        });
      } catch (err) {
        console.error("Failed to fetch discussions:", err);
      } finally {
        setLoading(false);
      }
    },
    [subdomain, activeCategory, sortBy]
  );

  useEffect(() => {
    if (subdomain) fetchDiscussions(1);
  }, [subdomain, fetchDiscussions]);

  const filteredDiscussions = discussions.filter((d) => {
    if (sortBy === 'unanswered' && d.is_resolved) return false;
    return !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Derive trending topics from loaded discussions
  const trendingTopics = (() => {
    const counts: Record<string, number> = {};
    discussions.forEach((d) =>
      (d.tags || []).forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  })();

  // Derive top contributors
  const topContributors = (() => {
    const map: Record<string, { name: string; posts: number }> = {};
    discussions.forEach((d) => {
      const name = d.author?.full_name || d.author?.email || "Unknown";
      if (!map[name]) map[name] = { name, posts: 0 };
      map[name].posts += 1;
    });
    return Object.values(map).sort((a, b) => b.posts - a.posts).slice(0, 4);
  })();

  const getCategoryBadge = (categoryId: string) => {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    if (!cat || !cat.icon) return null;
    const Icon = cat.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
      >
        <Icon className="w-3 h-3" />
        {cat.label}
      </span>
    );
  };

  const companyName = tenant?.branding?.company_name || tenant?.name || "Community";
  const primaryColor = tenant?.branding?.primary_color || "var(--brand)";

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      {/* Header */}
      {!tenant ? (
        <SiteNavbar currentPage="other" />
      ) : (
        <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)", background: "rgba(10,10,15,0.8)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", maxWidth: "1400px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                {tenant.branding.logo_url ? (
                  <img src={tenant.branding.logo_url} alt={companyName} style={{ height: "32px", width: "auto" }} />
                ) : (
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "14px", background: primaryColor }}>
                    {companyName.charAt(0)}
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 600, fontSize: "18px", color: "var(--text-primary)", lineHeight: 1.2 }}>{companyName}</p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Community</p>
                </div>
              </Link>
              <Link href="/docs" style={{ fontSize: "14px", color: "var(--text-secondary)", textDecoration: "none", fontWeight: 500 }}>
                Documentation →
              </Link>
            </div>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)" }}>
                  <User className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>{user.email}</span>
                </div>
                <button
                  onClick={signOut}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", background: "var(--surface-tertiary)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <Link href="/community/login" className="btn btn-secondary btn-sm">Sign In</Link>
                <Link href="/community/signup" className="btn btn-primary btn-sm">Join</Link>
              </div>
            )}
          </div>
        </header>
      )}

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Page title */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Community</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
            Connect with the {companyName} community
          </p>
        </div>

        {/* Category tabs — same as dashboard */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "8px 16px", borderRadius: "9999px", fontSize: "14px", fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
                background: activeCategory === cat.id ? primaryColor : "var(--surface-card)",
                color: activeCategory === cat.id ? "#fff" : "var(--text-secondary)",
                border: activeCategory === cat.id ? "none" : "1px solid var(--border-subtle)",
              }}
            >
              {activeCategory === cat.id && cat.icon && <cat.icon className="w-4 h-4" />}
              {cat.label}
              {activeCategory === cat.id && pagination.total > 0 && (
                <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "9999px", padding: "1px 6px", fontSize: "10px" }}>
                  {pagination.total}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>

          {/* Main list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Search & Sort */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", paddingLeft: "36px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "14px", color: "var(--text-primary)", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "4px" }}>
                {(["recent", "popular", "unanswered"] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setSortBy(sort)}
                    style={{
                      padding: "4px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "6px",
                      cursor: "pointer", textTransform: "capitalize",
                      background: sortBy === sort ? primaryColor : "transparent",
                      color: sortBy === sort ? "#fff" : "var(--text-secondary)",
                      border: "none",
                    }}
                  >
                    {sort}
                  </button>
                ))}
              </div>
            </div>

            {/* Discussion list card */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden" }}>
              {/* Column headers */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Threads</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{pagination.total} results</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>
                  <span style={{ width: "64px", textAlign: "center" }}>Replies</span>
                  <span style={{ width: "64px", textAlign: "center" }}>Views</span>
                  <span style={{ width: "64px", textAlign: "center" }}>Likes</span>
                </div>
              </div>

              {/* Rows */}
              <div>
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px" }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                    <span style={{ marginLeft: "8px", color: "var(--text-secondary)" }}>Loading discussions...</span>
                  </div>
                ) : filteredDiscussions.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px", textAlign: "center" }}>
                    <MessageSquare className="w-12 h-12" style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
                    <p style={{ color: "var(--text-secondary)" }}>No discussions yet</p>
                  </div>
                ) : (
                  filteredDiscussions.map((d) => {
                    const authorName = d.author?.full_name || d.author?.email || "Unknown";
                    const authorInitials = authorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                    const snippet = stripHtml(d.content);
                    return (
                      <Link
                        key={d.id}
                        href={`/community/${d.id}`}
                        style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", textDecoration: "none", transition: "background 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* Author avatar */}
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--brand-primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: primaryColor, fontWeight: 600, fontSize: "12px", flexShrink: 0 }}>
                          {authorInitials}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Badges */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                            {d.is_pinned && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", background: primaryColor, color: "#fff", padding: "2px 6px", borderRadius: "4px", fontWeight: 500 }}>
                                <Pin className="w-3 h-3" /> Pinned
                              </span>
                            )}
                            {d.is_resolved && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: 500 }}>
                                <CheckCircle2 className="w-3 h-3" /> Solved
                              </span>
                            )}
                            {d.is_locked && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", background: "rgba(107,114,128,0.1)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "4px", fontWeight: 500 }}>
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                            {d.poll && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", padding: "2px 6px", borderRadius: "4px", fontWeight: 500 }}>
                                <BarChart3 className="w-3 h-3" /> Poll
                              </span>
                            )}
                            {getCategoryBadge(d.category)}
                          </div>

                          {/* Title */}
                          <p style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "14px" }}>
                            {d.title}
                          </p>

                          {/* Snippet */}
                          <p style={{ fontSize: "13px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                            {snippet.slice(0, 150) + (snippet.length > 150 ? "..." : "")}
                          </p>

                          {/* Meta row */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "12px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{authorName}</span>
                            <span>•</span>
                            <span>{formatDate(d.created_at)}</span>
                            {(d.tags || []).slice(0, 3).map((tag: string) => (
                              <span key={tag} style={{ background: "var(--surface-ground)", padding: "1px 6px", borderRadius: "4px", color: "var(--text-muted)" }}>#{tag}</span>
                            ))}
                          </div>
                        </div>

                        {/* Counts */}
                        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                          <span style={{ width: "64px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                            {d.replies_count} <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          </span>
                          <span style={{ width: "64px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                            {d.views_count ?? 0} <Eye className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          </span>
                          <span style={{ width: "64px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                            {d.likes_count ?? 0} <ThumbsUp className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchDiscussions(pagination.page - 1)}
                  style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", color: "var(--text-secondary)", fontSize: "13px", cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchDiscussions(pagination.page + 1)}
                  style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", color: "var(--text-secondary)", fontSize: "13px", cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Sign-in prompt (if not logged in) */}
            {!user && (
              <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "16px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>Sign in to participate in discussions</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Link href="/community/login" className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: "center" }}>Sign In</Link>
                  <Link href="/community/signup" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: "center" }}>Join</Link>
                </div>
              </div>
            )}

            {/* Trending Topics */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp className="w-4 h-4" style={{ color: primaryColor }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Trending Topics</span>
              </div>
              <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {trendingTopics.length > 0 ? trendingTopics.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setSearchQuery(t.tag)}
                    style={{ padding: "4px 10px", fontSize: "12px", background: "var(--surface-ground)", color: "var(--text-secondary)", borderRadius: "9999px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    #{t.tag}
                    <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>| {t.count}</span>
                  </button>
                )) : (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No trending topics yet</p>
                )}
              </div>
            </div>

            {/* Top Contributors */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Award className="w-4 h-4" style={{ color: primaryColor }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Top Contributors</span>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {topContributors.length > 0 ? topContributors.map((contributor, idx) => (
                  <div key={contributor.name} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, background: idx === 0 ? "rgba(245,158,11,0.1)" : "var(--surface-ground)", color: idx === 0 ? "#f59e0b" : "var(--text-muted)" }}>
                      {idx + 1}
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--brand-primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: primaryColor, fontWeight: 600, fontSize: "11px" }}>
                      {contributor.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contributor.name}</p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{contributor.posts} posts</p>
                    </div>
                  </div>
                )) : (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No contributors yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter currentPage="community" />
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
        </div>
      }
    >
      <CommunityContent />
    </Suspense>
  );
}

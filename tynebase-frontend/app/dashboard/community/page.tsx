"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  Plus, MessageSquare, Eye, Pin, Search, TrendingUp,
  CheckCircle2, HelpCircle, Bell, Award, BarChart3, Loader2
} from "lucide-react";
import { listDiscussions, Discussion } from "@/lib/api/discussions";

// Forum categories with detailed info
const categories = [
  { id: "all", label: "All Discussions", icon: null, color: "#6b7280", description: "Browse all community discussions" },
  { id: "Announcements", label: "Announcements", icon: Bell, color: "#ef4444", description: "Official updates and news" },
  { id: "Questions", label: "Questions", icon: HelpCircle, color: "#3b82f6", description: "Get help from the community" },
  { id: "Ideas", label: "Ideas & Feedback", icon: TrendingUp, color: "#8b5cf6", description: "Share suggestions and vote" },
  { id: "General", label: "General Discussion", icon: MessageSquare, color: "#10b981", description: "Chat about anything" },
];

// Helper to strip HTML tags for preview
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "unanswered">("recent");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const fetchDiscussions = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await listDiscussions({
        category: activeCategory === "all" ? undefined : activeCategory,
        sortBy,
        page,
        limit: 20,
      });
      setDiscussions(response.discussions);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (err) {
      console.error("Failed to fetch discussions:", err);
      setError("Failed to load discussions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, sortBy]);

  useEffect(() => {
    fetchDiscussions(1);
  }, [fetchDiscussions]);

  // Filter by search query (client-side for now)
  const filteredDiscussions = discussions.filter((d) => {
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Derive trending topics from tags
  const trendingTopics = (() => {
    const tagCounts: Record<string, number> = {};
    discussions.forEach(d => {
      (d.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  })();

  // Derive top contributors from authors
  const topContributors = (() => {
    const authorCounts: Record<string, { name: string; posts: number }> = {};
    discussions.forEach(d => {
      const name = d.author?.full_name || d.author?.email || "Unknown";
      if (!authorCounts[name]) {
        authorCounts[name] = { name, posts: 0 };
      }
      authorCounts[name].posts += 1;
    });
    return Object.values(authorCounts)
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 4);
  })();

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

  const getCategoryBadge = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
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

  return (
    <div className="h-full min-h-0 w-full flex flex-col gap-6">
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6 flex-shrink-0 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Community</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Connect with community teams
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" size="md" asChild>
            <Link href="/dashboard/community/shared-documents">
              Shared Documents
            </Link>
          </Button>
          <Button variant="primary" size="lg" className="flex-1 sm:flex-none gap-2 px-7 !text-[#ffffff]" asChild>
            <Link href="/dashboard/community/new">
              <Plus className="w-5 h-5" />
              New Discussion
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Tabs (Categories) */}
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${activeCategory === cat.id
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "bg-[var(--surface-card)] text-[var(--dash-text-secondary)] border border-[var(--dash-border-subtle)] hover:bg-[var(--surface-hover)]"
              }
            `}
          >
            {activeCategory === cat.id && cat.icon && <cat.icon className="w-4 h-4" />}
            {cat.label}
            {activeCategory === cat.id && pagination.total > 0 && (
              <span className="bg-white/20 text-white px-1.5 rounded-full text-[10px] min-w-[20px] text-center">
                {pagination.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stats - Optional, keeping for now or could minimize */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
             ...
          </div>
        ))}
      </div> */}
      {/* Keeping stats hidden for now to match PRD "Discussion List" focus, or can be re-enabled if user wants */}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* Main Discussion List */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
              <input
                type="text"
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
              />
            </div>
            <div className="flex items-center bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-1">
              {(["recent", "popular", "unanswered"] as const).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${sortBy === sort
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                    }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="px-5 py-3 border-b border-[var(--dash-border-subtle)] flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Threads</CardTitle>
                <span className="text-xs text-[var(--dash-text-muted)] font-normal">
                  {pagination.total} results
                </span>
              </div>
              <div className="hidden md:flex gap-6 text-xs text-[var(--dash-text-muted)] font-medium mr-4">
                <span className="w-16 text-right">Replies</span>
                <span className="w-16 text-right">Views</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto dashboard-scroll">
              <div className="divide-y divide-[var(--dash-border-subtle)]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                    <span className="ml-2 text-[var(--dash-text-secondary)]">Loading discussions...</span>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-[var(--dash-text-tertiary)]">{error}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchDiscussions(1)}>
                      Try Again
                    </Button>
                  </div>
                ) : filteredDiscussions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="w-12 h-12 text-[var(--dash-text-muted)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--dash-text-primary)]">No discussions yet</h3>
                    <p className="text-[var(--dash-text-tertiary)] mt-1">Be the first to start a conversation!</p>
                    <Button variant="primary" size="md" className="mt-4" asChild>
                      <Link href="/dashboard/community/new">
                        <Plus className="w-4 h-4 mr-2" />
                        New Discussion
                      </Link>
                    </Button>
                  </div>
                ) : (
                  filteredDiscussions.map((discussion) => {
                    const authorName = discussion.author?.full_name || discussion.author?.email || "Unknown";
                    const authorInitials = authorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <Link
                        key={discussion.id}
                        href={`/dashboard/community/${discussion.id}`}
                        className={`block px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group ${discussion.is_pinned ? "bg-[var(--surface-ground)]/50" : ""}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="mt-1 w-9 h-9 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs flex-shrink-0">
                            {authorInitials}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {discussion.is_pinned && (
                                <span className="inline-flex items-center text-[10px] bg-[var(--brand)] text-white px-1.5 py-0.5 rounded font-medium">
                                  <Pin className="w-3 h-3 mr-1" /> Pinned
                                </span>
                              )}
                              {discussion.is_resolved && (
                                <span className="inline-flex items-center text-[10px] bg-[var(--status-success)]/10 text-[var(--status-success)] px-1.5 py-0.5 rounded font-medium">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Solved
                                </span>
                              )}
                              {discussion.poll && (
                                <span className="inline-flex items-center text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                                  <BarChart3 className="w-3 h-3 mr-1" /> Poll
                                </span>
                              )}
                              {getCategoryBadge(discussion.category)}
                            </div>

                            <h3 className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                              {discussion.title}
                            </h3>
                            <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-1 mt-1">
                              {(() => {
                                const text = stripHtml(discussion.content);
                                return text.slice(0, 150) + (text.length > 150 ? "..." : "");
                              })()}
                            </p>

                            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-2 text-xs text-[var(--dash-text-muted)]">
                              <span className="font-medium text-[var(--dash-text-secondary)]">{authorName}</span>
                              <span>•</span>
                              <span>{formatDate(discussion.created_at)}</span>
                              <span className="hidden sm:inline">•</span>
                              <div className="flex gap-1.5">
                                {(discussion.tags || []).slice(0, 3).map(tag => (
                                  <span key={tag} className="bg-[var(--surface-ground)] px-1.5 rounded text-[var(--dash-text-tertiary)] hidden sm:inline-block">#{tag}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="hidden md:flex flex-col items-end justify-center h-full gap-1 min-w-[140px]">
                            <div className="flex items-center justify-end w-full gap-6 text-sm text-[var(--dash-text-secondary)]">
                              <span className="w-16 text-right flex items-center justify-end gap-1">
                                {discussion.replies_count} <MessageSquare className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                              </span>
                              <span className="w-16 text-right flex items-center justify-end gap-1">
                                {discussion.views_count} <Eye className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchDiscussions(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--dash-text-secondary)]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchDiscussions(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Right Side Widgets */}
        <div className="space-y-6 flex flex-col gap-6">
          {/* Trending */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-[var(--dash-border-subtle)]">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--brand)]" />
                Trending Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {trendingTopics.length > 0 ? trendingTopics.map((topic) => (
                  <button
                    key={topic.tag}
                    className="px-2.5 py-1.5 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] rounded-full hover:bg-[var(--brand-primary-muted)] hover:text-[var(--brand)] transition-colors flex items-center gap-1.5"
                  >
                    #{topic.tag}
                    <span className="text-[var(--dash-text-muted)] opacity-60">| {topic.count}</span>
                  </button>
                )) : (
                  <p className="text-xs text-[var(--dash-text-muted)]">No trending topics yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contributors */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-[var(--dash-border-subtle)]">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-[var(--brand)]" />
                Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {topContributors.length > 0 ? topContributors.map((user, index) => (
                <div key={user.name} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--dash-text-muted)] bg-[var(--surface-ground)]'}`}>
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs">
                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{user.name}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">{user.posts} posts</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-[var(--dash-text-muted)]">No contributors yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  Plus, MessageSquare, Eye, Pin, Search, TrendingUp,
  CheckCircle2, HelpCircle, Bell, Award, BarChart3
} from "lucide-react";

// Forum categories with detailed info
const categories = [
  { id: "all", label: "All Discussions", count: 156, description: "Browse all community discussions" },
  { id: "Announcements", label: "Announcements", count: 12, icon: Bell, color: "#ef4444", description: "Official updates and news" },
  { id: "Questions", label: "Questions", count: 45, icon: HelpCircle, color: "#3b82f6", description: "Get help from the community" },
  { id: "Ideas", label: "Ideas & Feedback", count: 34, icon: TrendingUp, color: "#8b5cf6", description: "Share suggestions and vote" },
  { id: "General", label: "General Discussion", count: 65, icon: MessageSquare, color: "#10b981", description: "Chat about anything" },
];

const discussions = [
  {
    id: 1,
    title: "Welcome to the TyneBase Community!",
    excerpt: "Introduce yourself and let us know what brings you here. We're excited to have you!",
    author: "Sarah Chen",
    avatar: null,
    category: "Announcements",
    createdAt: "2 hours ago",
    replies: 24,
    views: 342,
    likes: 56,
    isPinned: true,
    isResolved: false,
    tags: ["welcome", "introduction"],
    hasPoll: true,
  },
  {
    id: 2,
    title: "How to set up webhooks for real-time notifications?",
    excerpt: "I'm trying to configure webhooks to get notified when documents are updated. Can someone guide me through the process?",
    author: "John Smith",
    avatar: null,
    category: "Questions",
    createdAt: "5 hours ago",
    replies: 8,
    views: 127,
    likes: 12,
    isPinned: false,
    isResolved: true,
    tags: ["webhooks", "integrations"],
  },
  {
    id: 3,
    title: "Feature Request: Dark mode for the editor",
    excerpt: "Would love to see a dedicated dark mode for the document editor. The current theme is great but would be nice to have more contrast options.",
    author: "Emily Davis",
    avatar: null,
    category: "Ideas",
    createdAt: "Yesterday",
    replies: 15,
    views: 234,
    likes: 89,
    isPinned: false,
    isResolved: false,
    tags: ["feature-request", "editor", "ui"],
  },
  {
    id: 4,
    title: "Best practices for organizing large knowledge bases",
    excerpt: "As our documentation grows, what are some recommended approaches for keeping everything organised and easily searchable?",
    author: "Mike Johnson",
    avatar: null,
    category: "Questions",
    createdAt: "2 days ago",
    replies: 21,
    views: 456,
    likes: 34,
    isPinned: false,
    isResolved: false,
    tags: ["organization", "best-practices"],
  },
  {
    id: 5,
    title: "Monthly Community Roundup - January 2026",
    excerpt: "Here's a summary of all the amazing contributions from our community this month. Thank you all for being part of this journey!",
    author: "TyneBase Team",
    avatar: null,
    category: "Announcements",
    createdAt: "3 days ago",
    replies: 7,
    views: 289,
    likes: 45,
    isPinned: true,
    isResolved: false,
    tags: ["roundup", "community"],
  },
];

const trendingTopics = [
  { tag: "api-integration", count: 34 },
  { tag: "ai-features", count: 28 },
  { tag: "templates", count: 22 },
  { tag: "collaboration", count: 19 },
  { tag: "version-history", count: 15 },
];

const topContributors = [
  { name: "Sarah Chen", posts: 45, helpful: 89 },
  { name: "John Smith", posts: 32, helpful: 67 },
  { name: "Emily Davis", posts: 28, helpful: 54 },
  { name: "Mike Johnson", posts: 24, helpful: 41 },
];

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "unanswered">("recent");

  const filteredDiscussions = discussions.filter((d) => {
    if (activeCategory !== "all" && d.category !== activeCategory) return false;
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedDiscussions = [...filteredDiscussions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sortBy === "popular") return b.likes - a.likes;
    if (sortBy === "unanswered") return a.replies - b.replies;
    return 0;
  });

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
        <Button variant="primary" size="lg" className="w-full sm:w-auto gap-2 px-7" asChild>
          <Link href="/dashboard/community/new">
            <Plus className="w-5 h-5" />
            New Discussion
          </Link>
        </Button>
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
            {activeCategory === cat.id && (
              <span className="bg-white/20 text-white px-1.5 rounded-full text-[10px] min-w-[20px] text-center">
                {cat.count}
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
                  {sortedDiscussions.length} results
                </span>
              </div>
              <div className="hidden md:flex gap-6 text-xs text-[var(--dash-text-muted)] font-medium mr-4">
                <span className="w-16 text-right">Replies</span>
                <span className="w-16 text-right">Views</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto dashboard-scroll">
              <div className="divide-y divide-[var(--dash-border-subtle)]">
                {sortedDiscussions.map((discussion) => (
                  <Link
                    key={discussion.id}
                    href={`/dashboard/community/${discussion.id}`}
                    className={`block px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group ${discussion.isPinned ? "bg-[var(--surface-ground)]/50" : ""}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="mt-1 w-9 h-9 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs flex-shrink-0">
                        {discussion.author.split(" ").map(n => n[0]).join("")}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {discussion.isPinned && (
                            <span className="inline-flex items-center text-[10px] bg-[var(--brand)] text-white px-1.5 py-0.5 rounded font-medium">
                              <Pin className="w-3 h-3 mr-1" /> Pinned
                            </span>
                          )}
                          {discussion.isResolved && (
                            <span className="inline-flex items-center text-[10px] bg-[var(--status-success)]/10 text-[var(--status-success)] px-1.5 py-0.5 rounded font-medium">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Solved
                            </span>
                          )}
                          {'hasPoll' in discussion && discussion.hasPoll && (
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
                          {discussion.excerpt}
                        </p>

                        <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-2 text-xs text-[var(--dash-text-muted)]">
                          <span className="font-medium text-[var(--dash-text-secondary)]">{discussion.author}</span>
                          <span>•</span>
                          <span>{discussion.createdAt}</span>
                          <span className="hidden sm:inline">•</span>
                          <div className="flex gap-1.5">
                            {discussion.tags.map(tag => (
                              <span key={tag} className="bg-[var(--surface-ground)] px-1.5 rounded text-[var(--dash-text-tertiary)] hidden sm:inline-block">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Stats for Desktop */}
                      <div className="hidden md:flex flex-col items-end justify-center h-full gap-1 min-w-[140px]">
                        <div className="flex items-center justify-end w-full gap-6 text-sm text-[var(--dash-text-secondary)]">
                          <span className="w-16 text-right flex items-center justify-end gap-1">
                            {discussion.replies} <MessageSquare className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                          </span>
                          <span className="w-16 text-right flex items-center justify-end gap-1">
                            {discussion.views} <Eye className="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="primary" size="sm">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
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
                {trendingTopics.map((topic) => (
                  <button
                    key={topic.tag}
                    className="px-2.5 py-1.5 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] rounded-full hover:bg-[var(--brand-primary-muted)] hover:text-[var(--brand)] transition-colors flex items-center gap-1.5"
                  >
                    #{topic.tag}
                    <span className="text-[var(--dash-text-muted)] opacity-60">| {topic.count}</span>
                  </button>
                ))}
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
              {topContributors.map((user, index) => (
                <div key={user.name} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--dash-text-muted)] bg-[var(--surface-ground)]'}`}>
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">{user.name}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">{user.posts} posts · {user.helpful} helpful</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

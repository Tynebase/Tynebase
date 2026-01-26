"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileEdit,
  MoreHorizontal,
  Search,
  Trash2,
  Send,
  ArrowUpRight,
} from "lucide-react";

interface Draft {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  createdAt: string;
  lastEdited: string;
  wordCount: number;
  completeness: number;
}

const drafts: Draft[] = [
  {
    id: 1,
    title: "Advanced API Rate Limiting",
    excerpt: "Documentation covering rate limiting strategies, best practices, and implementation details for high-traffic applications...",
    category: "API Docs",
    createdAt: "3 days ago",
    lastEdited: "2 hours ago",
    wordCount: 1247,
    completeness: 75,
  },
  {
    id: 2,
    title: "Team Onboarding Checklist",
    excerpt: "A comprehensive checklist for new team members including account setup, permissions, and first-day tasks...",
    category: "Onboarding",
    createdAt: "1 week ago",
    lastEdited: "Yesterday",
    wordCount: 856,
    completeness: 60,
  },
  {
    id: 3,
    title: "Security Incident Response",
    excerpt: "Procedures and protocols for responding to security incidents, including escalation paths and communication templates...",
    category: "Security",
    createdAt: "2 weeks ago",
    lastEdited: "3 days ago",
    wordCount: 2134,
    completeness: 90,
  },
  {
    id: 4,
    title: "Webhook Integration Guide",
    excerpt: "Step-by-step guide for setting up webhooks, including payload formats, authentication, and error handling...",
    category: "Integrations",
    createdAt: "5 days ago",
    lastEdited: "4 days ago",
    wordCount: 543,
    completeness: 35,
  },
  {
    id: 5,
    title: "Data Export Documentation",
    excerpt: "How to export your data from TyneBase in various formats including CSV, JSON, and PDF...",
    category: "Admin",
    createdAt: "1 day ago",
    lastEdited: "1 day ago",
    wordCount: 312,
    completeness: 20,
  },
];

export default function DraftsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "completeness">("recent");
  const [selectedDrafts, setSelectedDrafts] = useState<number[]>([]);

  const filteredDrafts = drafts.filter(draft =>
    draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    draft.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedDrafts = [...filteredDrafts].sort((a, b) => {
    if (sortBy === "completeness") return b.completeness - a.completeness;
    return 0;
  });

  const toggleSelect = (id: number) => {
    setSelectedDrafts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedDrafts.length === drafts.length) {
      setSelectedDrafts([]);
    } else {
      setSelectedDrafts(drafts.map(d => d.id));
    }
  };

  const getCompletenessColor = (value: number) => {
    if (value >= 75) return "bg-[var(--status-success)]";
    if (value >= 50) return "bg-[var(--status-warning)]";
    return "bg-[var(--dash-border-default)]";
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-5xl mx-auto gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/knowledge" className="hover:text-[var(--brand)]">Knowledge Base</Link>
            <span>/</span>
            <span>My Drafts</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">My Drafts</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Continue working on your unpublished documents
          </p>
        </div>
        <Link href="/dashboard/knowledge/new">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg font-medium transition-all">
            <FileEdit className="w-4 h-4" />
            New Draft
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{drafts.length}</p>
          <p className="text-sm text-[var(--dash-text-tertiary)]">Total Drafts</p>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <p className="text-2xl font-bold text-[var(--status-success)]">
            {drafts.filter(d => d.completeness >= 75).length}
          </p>
          <p className="text-sm text-[var(--dash-text-tertiary)]">Ready to Publish</p>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <p className="text-2xl font-bold text-[var(--status-warning)]">
            {drafts.filter(d => d.completeness >= 50 && d.completeness < 75).length}
          </p>
          <p className="text-sm text-[var(--dash-text-tertiary)]">In Progress</p>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <p className="text-2xl font-bold text-[var(--dash-text-tertiary)]">
            {drafts.reduce((sum, d) => sum + d.wordCount, 0).toLocaleString()}
          </p>
          <p className="text-sm text-[var(--dash-text-tertiary)]">Total Words</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drafts..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-secondary)] focus:outline-none focus:border-[var(--brand)]"
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="completeness">By Completeness</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedDrafts.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-[var(--brand-primary-muted)] border border-[var(--brand)]/20 rounded-lg">
          <span className="text-sm font-medium text-[var(--brand)]">
            {selectedDrafts.length} selected
          </span>
          <div className="flex-1" />
          <button className="px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)]">
            Move to Category
          </button>
          <button className="px-3 py-1.5 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded">
            Delete Selected
          </button>
        </div>
      )}

      {/* Drafts List */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div className="history-header hidden md:block px-5 py-4 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] flex-shrink-0">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedDrafts.length === drafts.length}
              onChange={selectAll}
              className="w-4 h-4 rounded accent-[var(--brand)]"
            />
            <span className="flex-1 text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">Document</span>
            <span className="w-24 text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider text-center">Progress</span>
            <span className="w-24 text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider text-right">Words</span>
            <span className="w-32 text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider text-right">Last Edited</span>
            <span className="w-24"></span>
          </div>
        </div>

        {sortedDrafts.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-12 text-center">
            <div>
              <FileEdit className="w-12 h-12 mx-auto text-[var(--dash-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">No drafts found</h3>
              <p className="text-[var(--dash-text-tertiary)] mb-4">
                {searchQuery ? "Try a different search term" : "Start creating your first document"}
              </p>
              <Link href="/dashboard/knowledge/new">
                <button className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg font-medium">
                  Create New Document
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto divide-y divide-[var(--dash-border-subtle)]">
            {sortedDrafts.map((draft) => (
              <div
                key={draft.id}
                className={`px-5 py-5 hover:bg-[var(--surface-hover)] transition-colors group ${selectedDrafts.includes(draft.id) ? "bg-[var(--brand-primary-muted)]" : ""
                  }`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                  {/* Mobile Header Row */}
                  <div className="flex items-start justify-between md:hidden w-full">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedDrafts.includes(draft.id)}
                        onChange={() => toggleSelect(draft.id)}
                        className="w-4 h-4 rounded accent-[var(--brand)]"
                      />
                      <div>
                        <Link href={`/dashboard/knowledge/${draft.id}`} className="font-medium text-[var(--dash-text-primary)] line-clamp-1">{draft.title}</Link>
                        <span className="text-xs text-[var(--dash-text-tertiary)]">{draft.category}</span>
                      </div>
                    </div>
                    <button className="p-1"><MoreHorizontal className="w-4 h-4 text-[var(--dash-text-muted)]" /></button>
                  </div>

                  {/* Desktop Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedDrafts.includes(draft.id)}
                    onChange={() => toggleSelect(draft.id)}
                    className="hidden md:block w-4 h-4 rounded accent-[var(--brand)]"
                  />

                  <div className="flex-1 min-w-0 md:block hidden">
                    <Link href={`/dashboard/knowledge/${draft.id}`} className="group/link">
                      <h3 className="font-medium text-[var(--dash-text-primary)] group-hover/link:text-[var(--brand)] transition-colors flex items-center gap-2">
                        {draft.title}
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100" />
                      </h3>
                    </Link>
                    <p className="text-sm text-[var(--dash-text-tertiary)] line-clamp-1 mt-0.5">{draft.excerpt}</p>
                    <span className="inline-block mt-2 px-2.5 py-1 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-muted)] rounded-full">
                      {draft.category}
                    </span>
                  </div>

                  {/* Progress & Meta - Mobile: Horizontal Row, Desktop: Columns */}
                  <div className="flex items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                    <div className="flex-1 md:w-24 flex flex-col md:items-center">
                      <span className="text-xs md:text-sm font-medium text-[var(--dash-text-primary)]">{draft.completeness}% <span className="md:hidden text-[var(--dash-text-muted)] font-normal">complete</span></span>
                      <div className="w-full h-1.5 bg-[var(--surface-ground)] rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getCompletenessColor(draft.completeness)}`}
                          style={{ width: `${draft.completeness}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-24 text-right hidden md:block">
                      <span className="text-sm text-[var(--dash-text-secondary)]">{draft.wordCount.toLocaleString()}</span>
                    </div>

                    <div className="w-32 text-right hidden md:block">
                      <span className="text-sm text-[var(--dash-text-tertiary)]">{draft.lastEdited}</span>
                    </div>

                    {/* Mobile Stats */}
                    <div className="flex items-center gap-3 text-xs text-[var(--dash-text-muted)] md:hidden ml-auto">
                      <span>{draft.wordCount} words</span>
                      <span>{draft.lastEdited}</span>
                    </div>
                  </div>

                  <div className="w-24 hidden md:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/dashboard/knowledge/${draft.id}`}
                      className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                      title="Edit"
                    >
                      <FileEdit className="w-4 h-4" />
                    </Link>
                    <button
                      className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-success)]"
                      title="Submit for Review"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)]"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

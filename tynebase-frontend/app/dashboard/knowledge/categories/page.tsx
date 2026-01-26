"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Edit3,
  Trash2,
  ChevronRight,
  Folder,
  FolderPlus,
} from "lucide-react";

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  documentCount: number;
  lastUpdated: string;
  subcategories?: { id: number; name: string; documentCount: number }[];
}

const categories: Category[] = [
  {
    id: 1,
    name: "Onboarding",
    description: "Getting started guides and setup documentation",
    color: "#3b82f6",
    documentCount: 8,
    lastUpdated: "2 hours ago",
    subcategories: [
      { id: 11, name: "Quick start", documentCount: 3 },
      { id: 12, name: "First Steps", documentCount: 5 },
    ],
  },
  {
    id: 2,
    name: "API Documentation",
    description: "REST API endpoints, authentication, and examples",
    color: "#8b5cf6",
    documentCount: 15,
    lastUpdated: "1 day ago",
    subcategories: [
      { id: 21, name: "Authentication", documentCount: 4 },
      { id: 22, name: "Endpoints", documentCount: 8 },
      { id: 23, name: "Webhooks", documentCount: 3 },
    ],
  },
  {
    id: 3,
    name: "Admin Guides",
    description: "Administration and configuration documentation",
    color: "#ec4899",
    documentCount: 6,
    lastUpdated: "3 days ago",
  },
  {
    id: 4,
    name: "Integrations",
    description: "Third-party integrations and connections",
    color: "#06b6d4",
    documentCount: 12,
    lastUpdated: "1 week ago",
  },
  {
    id: 5,
    name: "Security",
    description: "Security guidelines and compliance documentation",
    color: "#10b981",
    documentCount: 4,
    lastUpdated: "2 weeks ago",
  },
  {
    id: 6,
    name: "Best Practices",
    description: "Recommended patterns and usage guidelines",
    color: "#f59e0b",
    documentCount: 7,
    lastUpdated: "4 days ago",
  },
];

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<number[]>([1, 2]);
  const [, setShowNewCategoryModal] = useState(false);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: number) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalDocuments = categories.reduce((sum, cat) => sum + cat.documentCount, 0);

  return (
    <div className="max-w-5xl mx-auto flex min-h-full flex-col px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/knowledge" className="hover:text-[var(--brand)]">Knowledge Base</Link>
            <span>/</span>
            <span>Categories</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Categories</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Organise your documentation into logical groups
          </p>
        </div>
        <button
          onClick={() => setShowNewCategoryModal(true)}
          className="flex items-center gap-2 h-10 px-6 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium transition-all"
        >
          <FolderPlus className="w-4 h-4" />
          New Category
        </button>
      </div>

      <div className="h-8" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <Folder className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{categories.length}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Categories</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-purple-500/10">
            <FileText className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{totalDocuments}</p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Total Documents</p>
          </div>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-green-500/10">
            <FolderOpen className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--dash-text-primary)]">
              {categories.reduce((sum, cat) => sum + (cat.subcategories?.length || 0), 0)}
            </p>
            <p className="text-xs text-[var(--dash-text-tertiary)]">Subcategories</p>
          </div>
        </div>
      </div>

      <div className="h-8" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      <div className="h-6" />

      {/* Categories List */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden flex-1 min-h-0">
        <div className="divide-y divide-[var(--dash-border-subtle)]">
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategories.includes(category.id);
            const hasSubcategories = category.subcategories && category.subcategories.length > 0;

            return (
              <div key={category.id}>
                <div className="p-4 hover:bg-[var(--surface-hover)] transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {hasSubcategories ? (
                        <button
                          onClick={() => toggleExpand(category.id)}
                          className="p-2 -m-1 rounded-lg hover:bg-[var(--surface-ground)]"
                        >
                          <ChevronRight className={`w-4 h-4 text-[var(--dash-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                      ) : (
                        <div className="w-6 hidden sm:block" />
                      )}

                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${category.color}15` }}
                      >
                        <Folder className="w-5 h-5" style={{ color: category.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-[var(--dash-text-primary)]">{category.name}</h3>
                          <span className="px-2 py-0.5 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] rounded-full">
                            {category.documentCount} docs
                          </span>
                        </div>
                        <p className="text-sm text-[var(--dash-text-tertiary)] mt-0.5 truncate sm:hidden lg:block">{category.description}</p>
                      </div>

                      {/* Mobile Actions */}
                      <button className="sm:hidden p-2 text-[var(--dash-text-tertiary)] ml-auto">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>


                    <p className="text-sm text-[var(--dash-text-muted)] flex-shrink-0 hidden sm:block">
                      Updated {category.lastUpdated}
                    </p>

                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/dashboard/knowledge?category=${category.name}`}
                        className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="p-2.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--status-error)]">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subcategories */}
                {hasSubcategories && isExpanded && (
                  <div className="bg-[var(--surface-ground)] border-t border-[var(--dash-border-subtle)]">
                    {category.subcategories!.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/dashboard/knowledge?category=${sub.name}`}
                        className="flex items-center gap-4 px-4 py-3 pl-16 hover:bg-[var(--surface-hover)] transition-colors group"
                      >
                        <FolderOpen className="w-4 h-4" style={{ color: category.color }} />
                        <span className="flex-1 text-sm text-[var(--dash-text-secondary)]">{sub.name}</span>
                        <span className="text-xs text-[var(--dash-text-muted)]">{sub.documentCount} docs</span>
                        <ChevronRight className="w-4 h-4 text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100" />
                      </Link>
                    ))}
                    <button className="flex items-center gap-2 px-4 py-3 pl-16 text-sm text-[var(--brand)] hover:bg-[var(--surface-hover)] transition-colors w-full">
                      <Plus className="w-4 h-4" />
                      Add Subcategory
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

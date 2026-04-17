"use client";

import { useState, useEffect, useCallback } from "react";
import { Code, Users, BookOpen, Rocket, Shield, Settings, Zap, Plus, Star, Clock, ArrowRight, AlertCircle, Pencil, Trash2, Loader2, MoreVertical, Share2, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { listTemplates, deleteTemplate, updateTemplate, Template } from "@/lib/api/templates";
import { search } from "@/lib/api/ai";
import { SemanticSearchInput } from "@/components/ui/SemanticSearchInput";
import { useRouter } from "next/navigation";

const categoryIcons: Record<string, any> = {
  engineering: Code,
  product: Rocket,
  hr: Users,
  security: Shield,
  all: BookOpen,
};

const categoryColors: Record<string, string> = {
  engineering: '#3b82f6',
  product: '#8b5cf6',
  hr: '#ec4899',
  security: '#f97316',
  all: '#06b6d4',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticDocIds, setSemanticDocIds] = useState<string[] | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        setError(null);
        const response = await listTemplates();
        const fetchedTemplates = response.templates;
        setTemplates(fetchedTemplates);

        // Dynamically compute categories from templates
        const counts: Record<string, number> = {
          all: fetchedTemplates.length,
        };
        
        const categoriesSet = new Set<string>();

        fetchedTemplates.forEach((t) => {
          if (t.category) {
            categoriesSet.add(t.category);
            counts[t.category] = (counts[t.category] || 0) + 1;
          }
        });

        setCategoryCounts(counts);
        setUniqueCategories(Array.from(categoriesSet).sort());
      } catch (err: any) {
        console.error('Failed to fetch templates:', err);
        setError(err.message || 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  async function handleDeleteTemplate(templateId: string) {
    try {
      setDeletingId(templateId);
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setCategoryCounts(prev => {
        const deleted = templates.find(t => t.id === templateId);
        const updated: Record<string, number> = { ...prev, all: (prev.all || 1) - 1 };
        if (deleted?.category && updated[deleted.category]) {
          updated[deleted.category] = updated[deleted.category] - 1;
        }
        return updated;
      });
      setConfirmDeleteId(null);
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      setError(err.message || 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleShareTemplate(templateId: string) {
    try {
      setSharingId(templateId);
      await updateTemplate(templateId, { visibility: 'public' });
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, visibility: 'public' as const } : t
      ));
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Failed to share template:', err);
      setError(err.message || 'Failed to share template');
    } finally {
      setSharingId(null);
    }
  }

  async function handleUnshareTemplate(templateId: string) {
    try {
      setSharingId(templateId);
      await updateTemplate(templateId, { visibility: 'internal' });
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, visibility: 'internal' as const } : t
      ));
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Failed to unshare template:', err);
      setError(err.message || 'Failed to unshare template');
    } finally {
      setSharingId(null);
    }
  }

  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSemanticDocIds(null);
      return;
    }
    
    try {
      setIsSemanticSearching(true);
      const response = await search({ query, limit: 50, use_reranking: true, rerank_top_n: 20 });
      
      // Group by document and get best score
      const docScores = new Map<string, number>();
      for (const result of response.results) {
        const score = result.rerankScore ?? result.combinedScore ?? result.similarityScore;
        const existing = docScores.get(result.documentId);
        if (!existing || score > existing) {
          docScores.set(result.documentId, score);
        }
      }
      
      // Sort by score descending and return document IDs
      const sortedIds = Array.from(docScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([docId]) => docId);
      
      setSemanticDocIds(sortedIds);
    } catch (err) {
      console.error('Semantic search failed:', err);
      setSemanticDocIds(null);
    } finally {
      setIsSemanticSearching(false);
    }
  }, []);

  // Clear semantic results when search query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSemanticDocIds(null);
    }
  }, [searchQuery]);

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    
    // If we have semantic search results, use them; otherwise fall back to text search
    if (semanticDocIds !== null && searchQuery.trim()) {
      // Templates don't have document IDs in RAG, so we still use text matching
      // but semantic search is for the knowledge base. For templates, keep text search.
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }
    
    const matchesSearch = !searchQuery.trim() || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredTemplates = templates.slice(0, 3);
  const placeholderTemplates = Array.from({ length: 8 }, (_, i) => i);

  const getTemplateIcon = (category: string | null) => {
    return categoryIcons[category || 'all'] || BookOpen;
  };

  const getTemplateColor = (category: string | null) => {
    return categoryColors[category || 'all'] || '#06b6d4';
  };

  // Build dynamic category list from actual templates
  const templateCategories = [
    { id: 'all', label: 'All', count: categoryCounts.all || 0 },
    ...uniqueCategories.map(cat => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: categoryCounts[cat] || 0,
    })),
  ];

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-8">
      {/* Header */}
      <DashboardPageHeader
        title={<h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Templates</h1>}
        description={
          <p className="text-[var(--dash-text-tertiary)] mt-1">Start with our pre-built templates to quickly create the article you need, or create your own</p>
        }
        right={
          <Button className="gap-2" size="md" onClick={() => router.push('/dashboard/templates/new')}>
            <Plus className="w-4 h-4" />
            Create a Template
          </Button>
        }
      />

      {/* Error State */}
      {error && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)]/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Failed to load templates</h3>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-8 min-h-0">
        {/* Loading State */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {placeholderTemplates.map((i) => (
                  <div
                    key={i}
                    className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--surface-card)] animate-pulse" />
                      <div className="w-4 h-4 rounded bg-[var(--surface-card)] animate-pulse" />
                    </div>
                    <div className="h-4 w-2/3 rounded bg-[var(--surface-card)] animate-pulse" />
                    <div className="mt-2 h-3 w-full rounded bg-[var(--surface-card)] animate-pulse" />
                    <div className="mt-1 h-3 w-4/5 rounded bg-[var(--surface-card)] animate-pulse" />
                    <div className="mt-4 flex items-center justify-between">
                      <div className="h-3 w-16 rounded bg-[var(--surface-card)] animate-pulse" />
                      <div className="h-3 w-20 rounded bg-[var(--surface-card)] animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Featured Templates */}
            {featuredTemplates.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Featured Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {featuredTemplates.map((template) => {
                      const TemplateIcon = getTemplateIcon(template.category);
                      const color = getTemplateColor(template.category);
                      return (
                        <div
                          key={template.id}
                          className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl px-6 pt-7 pb-6 hover:shadow-md hover:border-[var(--brand)] transition-all cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}15` }}>
                            <TemplateIcon className="w-6 h-6" style={{ color }} />
                          </div>
                          <h3 className="font-semibold text-[var(--dash-text-primary)] mb-1 group-hover:text-[var(--brand)] transition-colors">
                            {template.title}
                          </h3>
                          <p className="text-sm text-[var(--dash-text-tertiary)] mb-4">{template.description || 'No description'}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--dash-text-muted)] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Featured
                            </span>
                            <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={() => router.push(`/dashboard/templates/${template.id}`)}>
                              Use Template
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="flex-1 flex flex-col min-h-0">
              <CardContent className="p-6 flex flex-col gap-6 h-full min-h-0">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <SemanticSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSemanticSearch={handleSemanticSearch}
                    isSearching={isSemanticSearching}
                    inputSize="lg"
                    placeholder="Search for a template..."
                    className="flex-1 w-full lg:max-w-md"
                  />
                  <div className="flex flex-wrap items-center gap-2.5 max-w-full">
                    {templateCategories.map((cat) => (
                      <div key={cat.id} className="inline-flex items-stretch">
                        <button
                          onClick={() => setActiveCategory(cat.id)}
                          className={`px-4 py-2 rounded-l-lg text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat.id
                              ? 'bg-[var(--brand)] text-white'
                              : 'bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] border-r-0 text-[var(--dash-text-secondary)] hover:border-[var(--brand)]'
                            }`}
                        >
                          <span>{cat.label}</span>
                          {cat.label === 'Engineering' && <span className="ml-2" />}
                        </button>
                        <span
                          className={`px-3 py-2 rounded-r-lg text-sm font-semibold tabular-nums ${activeCategory === cat.id
                              ? 'bg-[var(--brand-dark)] text-white'
                              : 'bg-[var(--surface-card)] text-[var(--dash-text-primary)] border border-[var(--dash-border-subtle)]'
                            }`}
                        >
                          {cat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex flex-col flex-1">
                  <h2 className="text-sm font-semibold text-[var(--dash-text-primary)] mb-5">
                    {filteredTemplates.length} {filteredTemplates.length === 1 ? 'Template' : 'Templates'}
                  </h2>
                  {filteredTemplates.length === 0 ? (
                    <div className="space-y-6">
                      <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-8">
                        <div className="max-w-xl">
                          <h3 className="text-base font-semibold text-[var(--dash-text-primary)]">No templates found</h3>
                          <p className="text-sm text-[var(--dash-text-tertiary)] mt-2">
                            Try adjusting your search or changing categories.
                          </p>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Button size="md" onClick={() => router.push('/dashboard/templates/new')} className="gap-2">
                              <Plus className="w-4 h-4" />
                              Create a Template
                            </Button>
                            <Button variant="secondary" size="md" onClick={() => setSearchQuery("")}>Clear search</Button>
                            <Button variant="secondary" size="md" onClick={() => setActiveCategory("all")}>Show all</Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {placeholderTemplates.map((i) => (
                          <div
                            key={i}
                            className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-5"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-10 h-10 rounded-lg bg-[var(--surface-card)] animate-pulse" />
                              <div className="w-4 h-4 rounded bg-[var(--surface-card)] animate-pulse" />
                            </div>
                            <div className="h-4 w-2/3 rounded bg-[var(--surface-card)] animate-pulse" />
                            <div className="mt-2 h-3 w-full rounded bg-[var(--surface-card)] animate-pulse" />
                            <div className="mt-1 h-3 w-4/5 rounded bg-[var(--surface-card)] animate-pulse" />
                            <div className="mt-4 flex items-center justify-between">
                              <div className="h-3 w-16 rounded bg-[var(--surface-card)] animate-pulse" />
                              <div className="h-3 w-20 rounded bg-[var(--surface-card)] animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {filteredTemplates.map((template) => {
                        const TemplateIcon = getTemplateIcon(template.category);
                        const color = getTemplateColor(template.category);
                        return (
                          <div
                            key={template.id}
                            className="relative bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl px-5 pt-6 pb-5 hover:shadow-md hover:border-[var(--brand)] transition-all cursor-pointer group"
                            onClick={() => router.push(`/dashboard/templates/${template.id}`)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                                <TemplateIcon className="w-5 h-5" style={{ color }} />
                              </div>
                              <div className="flex items-center gap-1">
                                {template.visibility === 'public' && (
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                )}
                                {template.tenant_id !== null && (
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === template.id ? null : template.id);
                                        setConfirmDeleteId(null);
                                      }}
                                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-card)] transition-all"
                                    >
                                      <MoreVertical className="w-4 h-4 text-[var(--dash-text-muted)]" />
                                    </button>
                                    {openMenuId === template.id && (
                                      <div className="absolute right-0 top-8 z-20 w-52 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg py-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(null);
                                            router.push(`/dashboard/templates/${template.id}`);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-text-primary)] hover:bg-[var(--surface-ground)] rounded-md transition-colors"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          Edit
                                        </button>
                                        {template.visibility === 'public' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUnshareTemplate(template.id);
                                            }}
                                            disabled={sharingId === template.id}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-text-primary)] hover:bg-[var(--surface-ground)] rounded-md transition-colors"
                                          >
                                            {sharingId === template.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Globe className="w-3.5 h-3.5" />
                                            )}
                                            Make Private
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleShareTemplate(template.id);
                                            }}
                                            disabled={sharingId === template.id}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                          >
                                            {sharingId === template.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Share2 className="w-3.5 h-3.5" />
                                            )}
                                            Share with Community
                                          </button>
                                        )}
                                        {confirmDeleteId === template.id ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteTemplate(template.id);
                                            }}
                                            disabled={deletingId === template.id}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-md transition-colors"
                                          >
                                            {deletingId === template.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                            Confirm Delete
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setConfirmDeleteId(template.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <h3 className="font-medium text-[var(--dash-text-primary)] mb-1 group-hover:text-[var(--brand)] transition-colors">
                              {template.title}
                            </h3>
                            <p className="text-xs text-[var(--dash-text-tertiary)] line-clamp-2 mb-3">{template.description || 'No description'}</p>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-xs text-[var(--dash-text-muted)]">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Updated {new Date(template.updated_at).toLocaleDateString()}
                                </span>
                                <span className="capitalize px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--dash-text-secondary)]">{template.category || 'General'}</span>
                              </div>
                              {template.users && (
                                <span className="text-xs text-[var(--dash-text-muted)] truncate">
                                  By {template.users.full_name || template.users.email}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Community Templates CTA */}
        <div className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)] rounded-xl p-6 text-white mt-auto">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Share your templates with the community</h3>
              <p className="text-white/80 text-sm">Help others by publishing your best templates to the community library.</p>
            </div>
            <Button 
              variant="secondary" 
              size="md" 
              className="bg-white text-[var(--brand)] hover:bg-white/90 border-0"
              onClick={() => router.push('/dashboard/community/shared-documents')}
            >
              View Shared Content
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

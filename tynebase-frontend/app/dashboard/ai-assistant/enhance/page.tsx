"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Zap,
  Target,
  BookOpen,
  PenTool,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { listDocuments, getDocument, updateDocument, type Document as APIDocument } from "@/lib/api/documents";
import { enhance, applyEnhancement, type EnhanceSuggestion as APISuggestion } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";

interface Document {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  healthScore: number | null;
  suggestions: number;
}

interface Suggestion {
  type: "clarity" | "grammar" | "structure" | "completeness" | "style";
  action: "add" | "replace" | "delete";
  title: string;
  reason: string;
  content?: string;
  find?: string;
  replace?: string;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

export default function EnhancePage() {
  const { decrementCredits, creditsRemaining } = useCredits();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const ENHANCE_CREDIT_COST = 5;

  // SessionStorage key for persistence
  const getStorageKey = (docId: string) => `enhance-page-${docId}`;

  // Load persisted data when selecting a document
  useEffect(() => {
    if (selectedDoc) {
      try {
        const stored = sessionStorage.getItem(getStorageKey(selectedDoc.id));
        if (stored) {
          const data = JSON.parse(stored);
          if (data.suggestions) setSuggestions(data.suggestions);
          if (data.appliedSuggestions) setAppliedSuggestions(data.appliedSuggestions);
          if (data.documentContent) setDocumentContent(data.documentContent);
        }
      } catch (err) {
        console.error('Failed to load persisted enhance data:', err);
      }
    }
  }, [selectedDoc?.id]);

  // Persist data when suggestions or applied status changes
  useEffect(() => {
    if (selectedDoc && (suggestions.length > 0 || appliedSuggestions.length > 0)) {
      try {
        sessionStorage.setItem(getStorageKey(selectedDoc.id), JSON.stringify({
          suggestions,
          appliedSuggestions,
          documentContent,
          timestamp: Date.now(),
        }));
      } catch (err) {
        console.error('Failed to persist enhance data:', err);
      }
    }
  }, [suggestions, appliedSuggestions, documentContent, selectedDoc?.id]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await listDocuments({ status: 'published', limit: 100 });
        const mappedDocs: Document[] = response.documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          category: 'Document',
          lastUpdated: formatRelativeTime(doc.updated_at),
          healthScore: (doc as any).ai_score || null,
          suggestions: 0,
        }));
        setDocuments(mappedDocs);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAnalyse = (doc: Document) => {
    setPendingDoc(doc);
    setShowCreditWarning(true);
  };

  const confirmAnalyse = async () => {
    if (!pendingDoc) return;
    
    setShowCreditWarning(false);
    setSelectedDoc(pendingDoc);
    setIsAnalyzing(true);
    setSuggestions([]);
    setAppliedSuggestions([]);
    setLoadingContent(true);
    
    try {
      const response = await enhance({ document_id: pendingDoc.id, custom_prompt: customPrompt || undefined });
      
      // Update the document's health score
      setDocuments(prev => prev.map(d => 
        d.id === pendingDoc.id ? { ...d, healthScore: response.score, suggestions: response.suggestions.length } : d
      ));
      
      // Update selected doc with new score
      setSelectedDoc(prev => prev ? { ...prev, healthScore: response.score, suggestions: response.suggestions.length } : null);
      
      setSuggestions(response.suggestions);

      // Decrement credits after successful enhancement
      decrementCredits(ENHANCE_CREDIT_COST);

      // Fetch full document content for preview
      try {
        const docResponse = await getDocument(pendingDoc.id);
        setDocumentContent(docResponse.document.content || '');
      } catch (contentErr) {
        console.error('Failed to fetch document content:', contentErr);
      }
    } catch (err) {
      console.error('Failed to enhance document:', err);
      // Show error but don't redirect
    } finally {
      setIsAnalyzing(false);
      setLoadingContent(false);
      setPendingDoc(null);
    }
  };

  const cancelAnalyse = () => {
    setShowCreditWarning(false);
    setPendingDoc(null);
    setCustomPrompt("");
  };

  const applySuggestion = async (suggestion: Suggestion) => {
    if (!selectedDoc) return;
    
    setApplyingId(suggestion.title);
    
    try {
      // Fetch current document content
      const docResponse = await getDocument(selectedDoc.id);
      let content = docResponse.document.content || '';
      
      // Apply the suggestion based on action type
      switch (suggestion.action) {
        case 'add':
          if (suggestion.content) {
            content = content + '\n\n' + suggestion.content;
          }
          break;
          
        case 'replace':
          if (suggestion.find && suggestion.replace !== undefined) {
            // Simple text replacement
            content = content.replace(suggestion.find, suggestion.replace);
          }
          break;
          
        case 'delete':
          if (suggestion.find) {
            content = content.replace(suggestion.find, '');
          }
          break;
      }
      
      // Update the document with modified content
      await updateDocument(selectedDoc.id, { content });
      
      // Update local state
      setDocumentContent(content);
      setAppliedSuggestions(prev => [...prev, suggestion.title]);
      
      // Create lineage entry
      try {
        await applyEnhancement({
          document_id: selectedDoc.id,
          suggestion_title: suggestion.title,
          suggestion_action: suggestion.action,
          suggestion_type: suggestion.type,
        });
      } catch (lineageErr) {
        console.error('Failed to create lineage entry:', lineageErr);
      }
    } catch (err) {
      console.error('Failed to apply suggestion:', err);
      alert('Failed to apply suggestion. Please try again.');
    } finally {
      setApplyingId(null);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-[var(--status-success)]";
    if (score >= 60) return "text-[var(--status-warning)]";
    return "text-[var(--status-error)]";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-[var(--status-success)]";
    if (score >= 60) return "bg-[var(--status-warning)]";
    return "bg-[var(--status-error)]";
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "grammar": return "bg-[var(--status-error-bg)] text-[var(--status-error)] border-[var(--status-error)]";
      case "clarity": return "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]";
      case "structure": return "bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info)]";
      case "completeness": return "bg-purple-50 text-purple-600 border-purple-600";
      default: return "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "clarity": return <Lightbulb className="w-4 h-4" />;
      case "seo": return <Target className="w-4 h-4" />;
      case "grammar": return <PenTool className="w-4 h-4" />;
      case "structure": return <BookOpen className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
          <Link href="/dashboard/ai-assistant" className="hover:text-[var(--brand)]">AI Assistant</Link>
          <span>/</span>
          <span>Enhance Content</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Enhance Content</h1>
        <p className="text-[var(--dash-text-tertiary)] mt-1">
          Improve your published documentation with AI-powered suggestions (Claude Sonnet)
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-stretch min-h-0">
        {/* Document Selection */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl flex flex-col min-h-0">
            <div className="p-5 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)] mb-3">Select Document</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--dash-border-subtle)]">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleAnalyse(doc)}
                  className={`w-full p-5 text-left hover:bg-[var(--surface-hover)] transition-colors ${
                    selectedDoc?.id === doc.id ? "bg-[var(--brand-primary-muted)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</h3>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">{doc.category} • {doc.lastUpdated}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-bold ${doc.healthScore !== null ? getHealthColor(doc.healthScore) : 'text-[var(--dash-text-muted)]'}`}>
                        {doc.healthScore !== null ? `${doc.healthScore}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">{doc.suggestions} tips</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--surface-ground)] rounded-full overflow-hidden">
                    <div className={`h-full ${doc.healthScore !== null ? getHealthBg(doc.healthScore) : 'bg-[var(--dash-border-subtle)]'} rounded-full`} style={{ width: `${doc.healthScore || 0}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Suggestions Panel */}
        <div className="lg:col-span-2 min-h-0 flex flex-col overflow-hidden">
          {!selectedDoc ? (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <Sparkles className="w-12 h-12 text-[var(--dash-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                Select a document to enhance
              </h3>
              <p className="text-[var(--dash-text-tertiary)] max-w-md">
                Choose a document from the list to get AI-powered improvement suggestions
              </p>
            </div>
          ) : isAnalyzing ? (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-12 h-12 text-[var(--brand)] mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                Analyzing "{selectedDoc.title}"
              </h3>
              <p className="text-[var(--dash-text-tertiary)] max-w-md">
                AI is reviewing your content for improvements...
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto pr-1">
              {/* Summary */}
              <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedDoc.title}</h2>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">{suggestions.length} suggestions found</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${selectedDoc.healthScore !== null ? getHealthColor(selectedDoc.healthScore) : 'text-[var(--dash-text-muted)]'}`}>
                        {selectedDoc.healthScore !== null ? `${selectedDoc.healthScore}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">Health Score</p>
                    </div>
                    {appliedSuggestions.length > 0 && (
                      <Link
                        href={`/dashboard/knowledge/${selectedDoc.id}`}
                        className="h-10 px-5 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-primary)] rounded-xl font-medium flex items-center gap-2 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Article
                      </Link>
                    )}
                    <button className="h-10 px-5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Apply All
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {["clarity", "grammar", "structure", "completeness", "style"].map((type) => {
                    const count = suggestions.filter(s => s.type === type).length;
                    return count > 0 ? (
                      <span key={type} className="px-3 py-1 bg-[var(--surface-ground)] rounded-full text-xs font-medium text-[var(--dash-text-secondary)] capitalize">
                        {type}: {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Suggestions List */}
              <div className="flex-1 min-h-0 space-y-4">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className={`bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden transition-all ${
                      appliedSuggestions.includes(suggestion.title) ? "opacity-50" : ""
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getTypeStyles(suggestion.type)}`}>
                            {getTypeIcon(suggestion.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-[var(--dash-text-primary)]">{suggestion.title}</h3>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeStyles(suggestion.type)}`}>
                                {suggestion.type}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--surface-ground)] text-[var(--dash-text-muted)]">
                                {suggestion.action}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{suggestion.reason}</p>
                          </div>
                        </div>
                        {!appliedSuggestions.includes(suggestion.title) && (
                          <button
                            onClick={() => applySuggestion(suggestion)}
                            disabled={applyingId === suggestion.title}
                            className="h-9 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                          >
                            {applyingId === suggestion.title ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Apply
                              </>
                            )}
                          </button>
                        )}
                        {appliedSuggestions.includes(suggestion.title) && (
                          <span className="flex items-center gap-1 text-sm text-[var(--status-success)]">
                            <CheckCircle className="w-4 h-4" />
                            Applied
                          </span>
                        )}
                      </div>
                      
                      {suggestion.action === 'replace' && suggestion.find && suggestion.replace && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-[var(--status-error-bg)] rounded-lg border border-[var(--status-error)]/20">
                            <p className="text-xs font-medium text-[var(--status-error)] mb-1">Original</p>
                            <p className="text-sm text-[var(--dash-text-secondary)]">{suggestion.find}</p>
                          </div>
                          <div className="p-3 bg-[var(--status-success-bg)] rounded-lg border border-[var(--status-success)]/20">
                            <p className="text-xs font-medium text-[var(--status-success)] mb-1">Suggested</p>
                            <p className="text-sm text-[var(--dash-text-secondary)] whitespace-pre-line">{suggestion.replace}</p>
                          </div>
                        </div>
                      )}
                      {suggestion.action === 'add' && suggestion.content && (
                        <div className="mt-4">
                          <div className="p-3 bg-[var(--status-success-bg)] rounded-lg border border-[var(--status-success)]/20">
                            <p className="text-xs font-medium text-[var(--status-success)] mb-1">Content to Add</p>
                            <p className="text-sm text-[var(--dash-text-secondary)] whitespace-pre-line">{suggestion.content}</p>
                          </div>
                        </div>
                      )}
                      {suggestion.action === 'delete' && suggestion.find && (
                        <div className="mt-4">
                          <div className="p-3 bg-[var(--status-error-bg)] rounded-lg border border-[var(--status-error)]/20">
                            <p className="text-xs font-medium text-[var(--status-error)] mb-1">Content to Remove</p>
                            <p className="text-sm text-[var(--dash-text-secondary)]">{suggestion.find}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Document Preview */}
              {documentContent && (
                <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Document Preview
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <div className="p-4 bg-[var(--surface-ground)] rounded-lg border border-[var(--dash-border-subtle)]">
                      <pre className="whitespace-pre-wrap text-sm text-[var(--dash-text-secondary)] font-sans">
                        {documentContent}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Credit Warning Modal */}
      {showCreditWarning && pendingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Confirm Enhancement</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--dash-text-primary)] mb-1">
                      This will use {ENHANCE_CREDIT_COST} credits
                    </p>
                    <p className="text-sm text-[var(--dash-text-secondary)]">
                      AI will analyze "{pendingDoc.title}" and provide improvement suggestions for grammar, clarity, structure, completeness, and style.
                    </p>
                    <p className="text-xs text-[var(--dash-text-tertiary)] mt-2">
                      Current balance: {creditsRemaining} credits
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-[var(--dash-text-tertiary)]">
                <p className="mb-2">The analysis will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Generate a quality score (0-100)</li>
                  <li>Provide 3-5 actionable suggestions</li>
                  <li>Show before/after previews for changes</li>
                </ul>
              </div>

              {/* Custom Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--dash-text-secondary)]">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Update for 2026, make it more formal, focus on technical details..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] resize-none"
                />
                <p className="text-xs text-[var(--dash-text-muted)]">
                  Add specific instructions to guide the AI's analysis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={cancelAnalyse}
                className="flex-1 h-11 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAnalyse}
                disabled={creditsRemaining < ENHANCE_CREDIT_COST}
                className="flex-1 h-11 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Use {ENHANCE_CREDIT_COST} Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

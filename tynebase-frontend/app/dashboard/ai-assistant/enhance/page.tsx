"use client";

import { useState, useEffect, useMemo } from "react";
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
  AlertCircle,
  Check,
  X,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Trash2,
  ArrowRight,
  RotateCcw,
  Coins,
} from "lucide-react";
import { listDocuments, getDocument, updateDocument, type Document as APIDocument } from "@/lib/api/documents";
import { enhance, applyEnhancement, reindexDocument, type EnhanceSuggestion } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";

interface Document {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  healthScore: number | null;
  suggestions: number;
}

type SuggestionStatus = "pending" | "accepted" | "rejected";

interface SuggestionWithStatus extends EnhanceSuggestion {
  id: string;
  status: SuggestionStatus;
  expanded: boolean;
}

const ENHANCE_CREDIT_COST = 2;

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
  const [suggestions, setSuggestions] = useState<SuggestionWithStatus[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [showDocument, setShowDocument] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // SessionStorage key for persistence
  const getStorageKey = (docId: string) => `enhance-page-${docId}`;

  // Load persisted data when selecting a document
  useEffect(() => {
    if (selectedDoc) {
      try {
        const stored = sessionStorage.getItem(getStorageKey(selectedDoc.id));
        if (stored) {
          const data = JSON.parse(stored);
          if (data.score !== undefined) setScore(data.score);
          if (data.suggestions) setSuggestions(data.suggestions);
          if (data.documentContent) setDocumentContent(data.documentContent);
        }
      } catch (err) {
        console.error('Failed to load persisted enhance data:', err);
      }
    }
  }, [selectedDoc?.id]);

  // Persist data when suggestions change
  useEffect(() => {
    if (selectedDoc && (suggestions.length > 0 || score !== null)) {
      try {
        sessionStorage.setItem(getStorageKey(selectedDoc.id), JSON.stringify({
          suggestions,
          score,
          documentContent,
          timestamp: Date.now(),
        }));
      } catch (err) {
        console.error('Failed to persist enhance data:', err);
      }
    }
  }, [suggestions, score, documentContent, selectedDoc?.id]);

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
    setScore(null);
    setError(null);
    setDocumentContent("");
    
    // Clear persisted data so old suggestions don't interfere
    try { sessionStorage.removeItem(getStorageKey(pendingDoc.id)); } catch {};
    
    try {
      const response = await enhance({ document_id: pendingDoc.id, custom_prompt: customPrompt || undefined });
      
      // Update the document's health score
      setDocuments(prev => prev.map(d => 
        d.id === pendingDoc.id ? { ...d, healthScore: response.score, suggestions: response.suggestions.length } : d
      ));
      
      // Update selected doc with new score
      setSelectedDoc(prev => prev ? { ...prev, healthScore: response.score, suggestions: response.suggestions.length } : null);
      
      setScore(response.score);
      
      const suggestionsWithStatus: SuggestionWithStatus[] = response.suggestions.map((s, i) => ({
        ...s,
        id: `${s.type}-${i}-${Date.now()}`,
        status: "pending" as SuggestionStatus,
        expanded: true,
      }));
      setSuggestions(suggestionsWithStatus);

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
      setError(err instanceof Error ? err.message : 'Failed to enhance document');
    } finally {
      setIsAnalyzing(false);
      setPendingDoc(null);
    }
  };

  const cancelAnalyse = () => {
    setShowCreditWarning(false);
    setPendingDoc(null);
    setCustomPrompt("");
  };

  // Accept a suggestion - apply content change to document
  const handleAccept = async (suggestionId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !selectedDoc) return;
    
    setApplyingId(suggestionId);
    
    try {
      // Fetch current document content
      const docResponse = await getDocument(selectedDoc.id);
      let content = docResponse.document.content || '';
      let applied = false;
      
      switch (suggestion.action) {
        case 'add':
          if (suggestion.content) {
            content = content + '\n\n' + suggestion.content;
            applied = true;
          }
          break;
          
        case 'replace':
          if (suggestion.find && suggestion.replace !== undefined) {
            if (content.includes(suggestion.find)) {
              content = content.replace(suggestion.find, suggestion.replace);
              applied = true;
            }
          }
          break;
          
        case 'delete':
          if (suggestion.find) {
            if (content.includes(suggestion.find)) {
              content = content.replace(suggestion.find, '');
              applied = true;
            }
          }
          break;
      }
      
      if (applied) {
        // Update the document with modified content
        await updateDocument(selectedDoc.id, { content });
        setDocumentContent(content);
        
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
      } else {
        console.warn(`Could not find text to ${suggestion.action}: "${(suggestion.find || '').substring(0, 80)}..."`);
      }

      // Mark as accepted
      setSuggestions(prev => prev.map(s =>
        s.id === suggestionId ? { ...s, status: "accepted" as SuggestionStatus } : s
      ));
    } catch (err) {
      console.error('Failed to apply suggestion:', err);
    } finally {
      setApplyingId(null);
    }
  };

  // Reject a suggestion
  const handleReject = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => 
      s.id === suggestionId ? { ...s, status: "rejected" as SuggestionStatus } : s
    ));
  };

  // Revert an accepted suggestion
  const handleRevert = async (suggestionId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !selectedDoc || suggestion.status !== 'accepted') return;

    setApplyingId(suggestionId);
    
    try {
      const docResponse = await getDocument(selectedDoc.id);
      let content = docResponse.document.content || '';
      let reverted = false;

      switch (suggestion.action) {
        case 'replace':
          if (suggestion.replace && suggestion.find && content.includes(suggestion.replace)) {
            content = content.replace(suggestion.replace, suggestion.find);
            reverted = true;
          }
          break;
        case 'delete':
          // Can't reliably revert a delete without position info
          break;
        case 'add':
          if (suggestion.content && content.includes(suggestion.content)) {
            content = content.replace('\n\n' + suggestion.content, '').replace(suggestion.content, '');
            reverted = true;
          }
          break;
      }

      if (reverted) {
        await updateDocument(selectedDoc.id, { content });
        setDocumentContent(content);
      }

      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId ? { ...s, status: "pending" as SuggestionStatus } : s
      ));
    } catch (err) {
      console.error('Failed to revert suggestion:', err);
    } finally {
      setApplyingId(null);
    }
  };

  // Toggle suggestion expansion
  const toggleExpand = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => 
      s.id === suggestionId ? { ...s, expanded: !s.expanded } : s
    ));
  };

  // Accept all pending suggestions
  const handleAcceptAll = async () => {
    const pendingSuggestions = suggestions.filter(s => s.status === "pending");
    for (const suggestion of pendingSuggestions) {
      await handleAccept(suggestion.id);
    }
  };

  // Reject all pending suggestions
  const handleRejectAll = () => {
    setSuggestions(prev => prev.map(s => 
      s.status === "pending" ? { ...s, status: "rejected" as SuggestionStatus } : s
    ));
  };

  // Stats
  const stats = useMemo(() => {
    const pending = suggestions.filter(s => s.status === "pending").length;
    const accepted = suggestions.filter(s => s.status === "accepted").length;
    const rejected = suggestions.filter(s => s.status === "rejected").length;
    return { pending, accepted, rejected, total: suggestions.length };
  }, [suggestions]);

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

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return "Excellent";
    if (s >= 70) return "Good";
    if (s >= 50) return "Fair";
    return "Needs Work";
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "grammar": return { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/20" };
      case "clarity": return { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" };
      case "structure": return { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" };
      case "completeness": return { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" };
      case "style": return { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/20" };
      default: return { bg: "bg-gray-500/10", text: "text-gray-600", border: "border-gray-500/20" };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "clarity": return <Lightbulb className="w-4 h-4" />;
      case "grammar": return <PenTool className="w-4 h-4" />;
      case "structure": return <BookOpen className="w-4 h-4" />;
      case "completeness": return <Target className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-6">
      {/* Header */}
      <div>
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
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 text-[var(--dash-text-muted)] mx-auto animate-spin" />
                  <p className="text-sm text-[var(--dash-text-tertiary)] mt-2">Loading documents...</p>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-8 h-8 text-[var(--dash-text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--dash-text-tertiary)]">No published documents found</p>
                </div>
              ) : filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleAnalyse(doc)}
                  className={`w-full p-4 text-left hover:bg-[var(--surface-hover)] transition-colors ${
                    selectedDoc?.id === doc.id ? "bg-[var(--brand-primary-muted)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--dash-text-primary)] truncate text-sm">{doc.title}</h3>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">{doc.lastUpdated}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-bold ${doc.healthScore !== null ? getHealthColor(doc.healthScore) : 'text-[var(--dash-text-muted)]'}`}>
                        {doc.healthScore !== null ? `${doc.healthScore}%` : '--'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--surface-ground)] rounded-full overflow-hidden">
                    <div className={`h-full ${doc.healthScore !== null ? getHealthBg(doc.healthScore) : 'bg-[var(--dash-border-subtle)]'} rounded-full transition-all`} style={{ width: `${doc.healthScore || 0}%` }} />
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
              <div className="flex items-center justify-center gap-2 text-xs text-amber-600 mt-4">
                <Coins className="w-4 h-4" />
                <span>Costs {ENHANCE_CREDIT_COST} credits per analysis</span>
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-12 h-12 text-[var(--brand)] mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                Analysing &ldquo;{selectedDoc.title}&rdquo;
              </h3>
              <p className="text-[var(--dash-text-tertiary)] max-w-md">
                AI is reviewing your content for improvements...
              </p>
            </div>
          ) : error && suggestions.length === 0 ? (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Analysis Failed</h3>
              <p className="text-sm text-red-600/80 mb-4 max-w-md">{error}</p>
              <button
                onClick={() => { setError(null); handleAnalyse(selectedDoc); }}
                className="h-10 px-5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <Sparkles className="w-12 h-12 text-[var(--dash-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
                No suggestions yet
              </h3>
              <p className="text-[var(--dash-text-tertiary)] max-w-md mb-4">
                Click on a document to analyze it with AI
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl flex flex-col overflow-hidden">
              {/* Score Header */}
              <div className="p-5 border-b border-[var(--dash-border-subtle)] flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedDoc.title}</h2>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">{suggestions.length} suggestions found</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {score !== null && (
                      <div className="text-center px-4 py-2 bg-[var(--surface-ground)] rounded-xl">
                        <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}%</p>
                        <p className={`text-xs font-medium ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
                      </div>
                    )}
                    <Link
                      href={`/dashboard/knowledge/${selectedDoc.id}`}
                      className="h-10 px-4 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-primary)] rounded-xl font-medium flex items-center gap-2 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Link>
                    <button
                      onClick={() => { setError(null); handleAnalyse(selectedDoc); }}
                      className="h-10 px-4 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-primary)] rounded-xl font-medium flex items-center gap-2 transition-colors text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-analyze
                    </button>
                  </div>
                </div>
              </div>

              {/* Document Preview Toggle */}
              <div className="px-5 pt-4 flex-shrink-0">
                <button
                  onClick={() => setShowDocument(!showDocument)}
                  className="flex items-center justify-between w-full p-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                    <span className="text-sm font-medium text-[var(--dash-text-primary)]">Document Preview</span>
                  </div>
                  {showDocument ? (
                    <ChevronUp className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  )}
                </button>
                {showDocument && documentContent && (
                  <div className="mt-2 p-3 bg-white border border-[var(--dash-border-subtle)] rounded-lg max-h-48 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {documentContent || "No content"}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats Bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--dash-border-subtle)] flex-shrink-0">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[var(--dash-text-tertiary)]">
                    <span className="font-medium text-amber-600">{stats.pending}</span> pending
                  </span>
                  <span className="text-[var(--dash-text-tertiary)]">
                    <span className="font-medium text-green-600">{stats.accepted}</span> accepted
                  </span>
                  <span className="text-[var(--dash-text-tertiary)]">
                    <span className="font-medium text-red-600">{stats.rejected}</span> rejected
                  </span>
                </div>
                {stats.pending > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAcceptAll}
                      disabled={applyingId !== null}
                      className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      Accept All
                    </button>
                    <span className="text-[var(--dash-border-default)]">|</span>
                    <button
                      onClick={handleRejectAll}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Reject All
                    </button>
                  </div>
                )}
              </div>

              {/* Suggestions List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {suggestions.map((suggestion) => {
                  const styles = getTypeStyles(suggestion.type);
                  const isAccepted = suggestion.status === "accepted";
                  const isRejected = suggestion.status === "rejected";
                  const isPending = suggestion.status === "pending";

                  return (
                    <div
                      key={suggestion.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        isAccepted ? "border-green-500/30 bg-green-500/5" :
                        isRejected ? "border-red-500/30 bg-red-500/5 opacity-60" :
                        "border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]"
                      }`}
                    >
                      {/* Suggestion Header */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => toggleExpand(suggestion.id)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-lg ${styles.bg} ${styles.text}`}>
                            {getTypeIcon(suggestion.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-[var(--dash-text-primary)] text-sm truncate">
                                {suggestion.title}
                              </h4>
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                suggestion.action === 'add' ? 'bg-green-100 text-green-700' :
                                suggestion.action === 'delete' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {suggestion.action}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${styles.bg} ${styles.text}`}>
                                {suggestion.type}
                              </span>
                            </div>
                          </div>
                          {isAccepted && (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 flex-shrink-0">
                              <CheckCircle className="w-3 h-3" /> Accepted
                            </span>
                          )}
                          {isRejected && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600 flex-shrink-0">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </div>
                        {suggestion.expanded ? (
                          <ChevronUp className="w-4 h-4 text-[var(--dash-text-tertiary)] ml-2 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)] ml-2 flex-shrink-0" />
                        )}
                      </div>

                      {/* Expanded Content */}
                      {suggestion.expanded && (
                        <div className="px-4 pb-4 space-y-3">
                          {/* Reason */}
                          <p className="text-xs text-[var(--dash-text-tertiary)] italic">
                            {suggestion.reason}
                          </p>

                          {/* Action-specific Content */}
                          <div className="rounded-lg border border-[var(--dash-border-subtle)] overflow-hidden">
                            {/* ADD Action */}
                            {suggestion.action === 'add' && suggestion.content && (
                              <div className="bg-green-50 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Plus className="w-3 h-3 text-green-600" />
                                  <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">Content to Add</span>
                                </div>
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-white/70 p-3 rounded border border-green-100">
                                  {suggestion.content}
                                </p>
                              </div>
                            )}

                            {/* REPLACE Action */}
                            {suggestion.action === 'replace' && suggestion.find && (
                              <>
                                <div className="bg-red-50 p-3 border-b border-red-100">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                    <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Find & Remove</span>
                                  </div>
                                  <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap bg-red-100/50 p-2 rounded">
                                    {suggestion.find}
                                  </p>
                                </div>
                                <div className="flex items-center justify-center py-1 bg-gray-50">
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="bg-green-50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Plus className="w-3 h-3 text-green-600" />
                                    <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">Replace With</span>
                                  </div>
                                  <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap bg-green-100/50 p-2 rounded">
                                    {suggestion.replace}
                                  </p>
                                </div>
                              </>
                            )}

                            {/* DELETE Action */}
                            {suggestion.action === 'delete' && (suggestion.find || suggestion.content) && (
                              <div className="bg-red-50 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Text to Delete</span>
                                </div>
                                <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap bg-red-100/50 p-2 rounded line-through">
                                  {suggestion.find || suggestion.content}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          {isPending && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAccept(suggestion.id);
                                }}
                                disabled={applyingId === suggestion.id}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                  suggestion.action === 'delete' 
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                {applyingId === suggestion.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                {suggestion.action === 'add' ? 'Add' : suggestion.action === 'replace' ? 'Replace' : 'Delete'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(suggestion.id);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Dismiss
                              </button>
                            </div>
                          )}

                          {/* Revert Button for Accepted Suggestions */}
                          {isAccepted && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevert(suggestion.id);
                                }}
                                disabled={applyingId === suggestion.id}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                {applyingId === suggestion.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                                Revert Change
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                  <Coins className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--dash-text-primary)] mb-1">
                      This will use {ENHANCE_CREDIT_COST} credits
                    </p>
                    <p className="text-sm text-[var(--dash-text-secondary)]">
                      AI will analyze &ldquo;{pendingDoc.title}&rdquo; and provide improvement suggestions for grammar, clarity, structure, completeness, and style.
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
                  <li>Allow you to accept or reject each change</li>
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
                  Add specific instructions to guide the AI&apos;s analysis
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

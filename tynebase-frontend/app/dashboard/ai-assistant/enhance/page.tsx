"use client";

import { useState } from "react";
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
} from "lucide-react";

interface Document {
  id: number;
  title: string;
  category: string;
  lastUpdated: string;
  healthScore: number;
  suggestions: number;
}

interface Suggestion {
  id: number;
  type: "clarity" | "seo" | "grammar" | "structure" | "tone";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  original?: string;
  suggested?: string;
}

const documents: Document[] = [
  { id: 1, title: "Getting Started Guide", category: "Onboarding", lastUpdated: "2 days ago", healthScore: 72, suggestions: 5 },
  { id: 2, title: "API Authentication", category: "API Docs", lastUpdated: "1 week ago", healthScore: 85, suggestions: 2 },
  { id: 3, title: "Team Permissions", category: "Admin", lastUpdated: "3 days ago", healthScore: 64, suggestions: 8 },
  { id: 4, title: "Security Best Practices", category: "Security", lastUpdated: "2 weeks ago", healthScore: 91, suggestions: 1 },
];

const mockSuggestions: Suggestion[] = [
  {
    id: 1,
    type: "clarity",
    severity: "high",
    title: "Simplify complex sentence",
    description: "This sentence is too long and may confuse readers. Consider breaking it into smaller parts.",
    original: "The authentication process requires users to first obtain an API key from the dashboard settings page, which can be found by navigating to Settings > API > Keys, and then use that key in the Authorization header of each request.",
    suggested: "To authenticate:\n1. Go to Settings > API > Keys\n2. Create an API key\n3. Add the key to your Authorization header",
  },
  {
    id: 2,
    type: "seo",
    severity: "medium",
    title: "Add keywords to heading",
    description: "Include target keywords in your H2 heading for better search visibility.",
    original: "Getting Started",
    suggested: "Getting Started with TyneBase API Authentication",
  },
  {
    id: 3,
    type: "grammar",
    severity: "low",
    title: "Fix passive voice",
    description: "Consider using active voice for clearer communication.",
    original: "The configuration file should be updated by the administrator.",
    suggested: "The administrator should update the configuration file.",
  },
];

export default function EnhancePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<number[]>([]);

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAnalyse = (doc: Document) => {
    setSelectedDoc(doc);
    setIsAnalyzing(true);
    setSuggestions([]);
    setAppliedSuggestions([]);
    
    // Simulate AI analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      setSuggestions(mockSuggestions);
    }, 2000);
  };

  const applySuggestion = (id: number) => {
    setAppliedSuggestions(prev => [...prev, id]);
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

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "high": return "bg-[var(--status-error-bg)] text-[var(--status-error)] border-[var(--status-error)]";
      case "medium": return "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]";
      default: return "bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info)]";
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
          Improve your documentation with AI-powered suggestions
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
                      <p className={`text-lg font-bold ${getHealthColor(doc.healthScore)}`}>{doc.healthScore}%</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">{doc.suggestions} tips</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--surface-ground)] rounded-full overflow-hidden">
                    <div className={`h-full ${getHealthBg(doc.healthScore)} rounded-full`} style={{ width: `${doc.healthScore}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Suggestions Panel */}
        <div className="lg:col-span-2 min-h-0 flex flex-col">
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
            <div className="flex-1 min-h-0 flex flex-col gap-6">
              {/* Summary */}
              <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">{selectedDoc.title}</h2>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">{suggestions.length} suggestions found</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${getHealthColor(selectedDoc.healthScore)}`}>{selectedDoc.healthScore}%</p>
                      <p className="text-xs text-[var(--dash-text-muted)]">Health Score</p>
                    </div>
                    <button className="h-10 px-5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Apply All
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {["clarity", "seo", "grammar", "structure", "tone"].map((type) => {
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
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden transition-all ${
                      appliedSuggestions.includes(suggestion.id) ? "opacity-50" : ""
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getSeverityStyles(suggestion.severity)}`}>
                            {getTypeIcon(suggestion.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-[var(--dash-text-primary)]">{suggestion.title}</h3>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSeverityStyles(suggestion.severity)}`}>
                                {suggestion.severity}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{suggestion.description}</p>
                          </div>
                        </div>
                        {!appliedSuggestions.includes(suggestion.id) && (
                          <button
                            onClick={() => applySuggestion(suggestion.id)}
                            className="h-9 px-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Apply
                          </button>
                        )}
                        {appliedSuggestions.includes(suggestion.id) && (
                          <span className="flex items-center gap-1 text-sm text-[var(--status-success)]">
                            <CheckCircle className="w-4 h-4" />
                            Applied
                          </span>
                        )}
                      </div>
                      
                      {suggestion.original && suggestion.suggested && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-[var(--status-error-bg)] rounded-lg border border-[var(--status-error)]/20">
                            <p className="text-xs font-medium text-[var(--status-error)] mb-1">Original</p>
                            <p className="text-sm text-[var(--dash-text-secondary)]">{suggestion.original}</p>
                          </div>
                          <div className="p-3 bg-[var(--status-success-bg)] rounded-lg border border-[var(--status-success)]/20">
                            <p className="text-xs font-medium text-[var(--status-success)] mb-1">Suggested</p>
                            <p className="text-sm text-[var(--dash-text-secondary)] whitespace-pre-line">{suggestion.suggested}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

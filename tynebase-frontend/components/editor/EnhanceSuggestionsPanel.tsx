"use client";

import { useState } from "react";
import {
  Sparkles,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Zap,
  Target,
  BookOpen,
  PenTool,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { enhance, applySuggestion, pollJobUntilComplete, type EnhanceSuggestion } from "@/lib/api/ai";

interface EnhanceSuggestionsPanelProps {
  documentId: string;
  onClose: () => void;
  onApplySuggestion?: (suggestion: EnhanceSuggestion) => void;
}

export function EnhanceSuggestionsPanel({
  documentId,
  onClose,
  onApplySuggestion,
}: EnhanceSuggestionsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<EnhanceSuggestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setSuggestions([]);
      setScore(null);

      const response = await enhance({ document_id: documentId });
      
      setScore(response.data.score);
      setSuggestions(response.data.suggestions);
    } catch (err) {
      console.error('Failed to analyze document:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySuggestion = async (suggestion: EnhanceSuggestion) => {
    const suggestionId = `${suggestion.type}-${suggestion.title}`;
    
    try {
      setApplyingIds(prev => new Set(prev).add(suggestionId));
      setError(null);

      const response = await applySuggestion({
        document_id: documentId,
        suggestion_type: suggestion.type,
        context: suggestion.suggested,
      });

      // Poll job until completion
      const job = await pollJobUntilComplete(response.data.job.id);

      if (job.status === 'completed') {
        setAppliedSuggestions(prev => new Set(prev).add(suggestionId));
        onApplySuggestion?.(suggestion);
      } else {
        throw new Error(job.error_message || 'Failed to apply suggestion');
      }
    } catch (err) {
      console.error('Failed to apply suggestion:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
    } finally {
      setApplyingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-[var(--status-success)]";
    if (score >= 60) return "text-[var(--status-warning)]";
    return "text-[var(--status-error)]";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-[var(--status-success)]";
    if (score >= 60) return "bg-[var(--status-warning)]";
    return "bg-[var(--status-error)]";
  };

  const getSeverityStyles = (type: string) => {
    switch (type) {
      case "grammar": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "clarity": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "structure": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "completeness": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "style": return "bg-green-500/10 text-green-600 border-green-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
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
    <div className="w-96 border-l border-[var(--dash-border-subtle)] bg-[var(--surface-card)] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--brand)]" />
          <h3 className="font-semibold text-[var(--dash-text-primary)]">AI Enhancement</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--surface-ground)] rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!suggestions.length && !isAnalyzing && !error && (
          <div className="p-6 text-center">
            <Sparkles className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4" />
            <h4 className="font-medium text-[var(--dash-text-primary)] mb-2">
              Enhance Your Document
            </h4>
            <p className="text-sm text-[var(--dash-text-tertiary)] mb-4">
              Get AI-powered suggestions to improve clarity, grammar, structure, and style.
            </p>
            <Button
              variant="primary"
              onClick={handleAnalyze}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Analyze Document
            </Button>
          </div>
        )}

        {isAnalyzing && (
          <div className="p-6 text-center">
            <RefreshCw className="w-12 h-12 text-[var(--brand)] mx-auto mb-4 animate-spin" />
            <h4 className="font-medium text-[var(--dash-text-primary)] mb-2">
              Analyzing Document
            </h4>
            <p className="text-sm text-[var(--dash-text-tertiary)]">
              AI is reviewing your content for improvements...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 m-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-600 mb-1">Error</p>
                <p className="text-sm text-red-600/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="p-4 space-y-4">
            {/* Score Summary */}
            <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--dash-text-secondary)]">
                  Document Score
                </span>
                <span className={`text-2xl font-bold ${getScoreColor(score!)}`}>
                  {score}%
                </span>
              </div>
              <div className="h-2 bg-[var(--surface-card)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreBg(score!)} rounded-full transition-all`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="text-xs text-[var(--dash-text-tertiary)] mt-2">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Suggestions List */}
            {suggestions.map((suggestion, index) => {
              const suggestionId = `${suggestion.type}-${suggestion.title}`;
              const isApplied = appliedSuggestions.has(suggestionId);
              const isApplying = applyingIds.has(suggestionId);

              return (
                <div
                  key={index}
                  className={`bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg overflow-hidden ${
                    isApplied ? "opacity-60" : ""
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg border ${getSeverityStyles(suggestion.type)}`}>
                        {getTypeIcon(suggestion.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-[var(--dash-text-primary)] text-sm">
                            {suggestion.title}
                          </h4>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSeverityStyles(suggestion.type)}`}>
                            {suggestion.type}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--dash-text-tertiary)]">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>

                    {suggestion.original && suggestion.suggested && (
                      <div className="space-y-2 mb-3">
                        <div className="p-2 bg-red-500/5 border border-red-500/10 rounded text-xs">
                          <p className="font-medium text-red-600 mb-1">Original:</p>
                          <p className="text-[var(--dash-text-secondary)]">{suggestion.original}</p>
                        </div>
                        <div className="p-2 bg-green-500/5 border border-green-500/10 rounded text-xs">
                          <p className="font-medium text-green-600 mb-1">Suggested:</p>
                          <p className="text-[var(--dash-text-secondary)]">{suggestion.suggested}</p>
                        </div>
                      </div>
                    )}

                    {!isApplied && !isApplying && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApplySuggestion(suggestion)}
                        className="w-full gap-2"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Apply Suggestion
                      </Button>
                    )}

                    {isApplying && (
                      <Button variant="ghost" size="sm" disabled className="w-full gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Applying...
                      </Button>
                    )}

                    {isApplied && (
                      <div className="flex items-center justify-center gap-2 text-sm text-[var(--status-success)]">
                        <CheckCircle className="w-4 h-4" />
                        Applied
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Re-analyze Button */}
            <Button
              variant="outline"
              onClick={handleAnalyze}
              className="w-full gap-2"
              disabled={isAnalyzing}
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Re-analyze Document
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

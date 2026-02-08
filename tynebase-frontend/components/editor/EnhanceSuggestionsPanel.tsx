"use client";

import { useState, useEffect, useMemo } from "react";
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
  Check,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Replace,
  Trash2,
  ArrowRight,
  RotateCcw,
  Coins,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { enhance, applyEnhancement, reindexDocument, type EnhanceSuggestion } from "@/lib/api/ai";
import { getDocument } from "@/lib/api/documents";
import type { Editor } from "@tiptap/react";
import { useCredits } from "@/contexts/CreditsContext";

interface EnhanceSuggestionsPanelProps {
  documentId: string;
  onClose: () => void;
  editor?: Editor | null;
  onApplySuggestion?: (suggestion: EnhanceSuggestion) => void;
}

// Status for each suggestion
type SuggestionStatus = "pending" | "accepted" | "rejected";

interface SuggestionWithStatus extends EnhanceSuggestion {
  id: string;
  status: SuggestionStatus;
  expanded: boolean;
  originalContent?: string; // Store original content for revert
  appliedPosition?: { from: number; to: number }; // Store where the change was applied
}

const ENHANCE_CREDIT_COST = 5;

export function EnhanceSuggestionsPanel({
  documentId,
  onClose,
  editor,
  onApplySuggestion,
}: EnhanceSuggestionsPanelProps) {
  const { decrementCredits, creditsRemaining } = useCredits();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionWithStatus[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [showDocument, setShowDocument] = useState(true);
  const [isReindexing, setIsReindexing] = useState(false);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // SessionStorage key for this document's enhancement data
  const storageKey = `enhance-${documentId}`;

  // Get document content from editor
  useEffect(() => {
    if (editor) {
      setDocumentContent(editor.getText());
    }
  }, [editor]);

  // Load persisted enhancement data on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.score !== undefined) {
          setScore(data.score);
        }
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (err) {
      console.error('[EnhanceSuggestionsPanel] Failed to load persisted data:', err);
    }
  }, [storageKey]);

  // Persist enhancement data whenever score or suggestions change
  useEffect(() => {
    if (score !== null || suggestions.length > 0) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          score,
          suggestions,
          timestamp: Date.now(),
        }));
      } catch (err) {
        console.error('[EnhanceSuggestionsPanel] Failed to persist data:', err);
      }
    }
  }, [score, suggestions, storageKey]);

  const handleAnalyze = () => {
    // Reset any stuck states to ensure button can be triggered multiple times
    setIsAnalyzing(false);
    setError(null);
    // Show credit warning before analyzing
    setShowCreditWarning(true);
  };

  const confirmAnalyze = async () => {
    setShowCreditWarning(false);
    
    try {
      setIsAnalyzing(true);
      setError(null);
      setSuggestions([]);
      setScore(null);

      // Update document content before analyzing
      if (editor) {
        setDocumentContent(editor.getText());
      }

      // Send editor plain text so AI find strings match editor content exactly
      const editorText = editor ? editor.getText() : undefined;
      const response = await enhance({ document_id: documentId, custom_prompt: customPrompt || undefined, editor_content: editorText || undefined });
      
      // Decrement credits after successful enhancement
      decrementCredits(ENHANCE_CREDIT_COST);
      
      setScore(response.score);
      // Add status and id to each suggestion
      const suggestionsWithStatus: SuggestionWithStatus[] = response.suggestions.map((s, i) => ({
        ...s,
        id: `${s.type}-${i}-${Date.now()}`,
        status: "pending" as SuggestionStatus,
        expanded: true,
      }));
      setSuggestions(suggestionsWithStatus);
      
      // Persist to sessionStorage
      sessionStorage.setItem(storageKey, JSON.stringify({
        score: response.score,
        suggestions: suggestionsWithStatus,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.error('Failed to analyze document:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cancelAnalyze = () => {
    setShowCreditWarning(false);
    setCustomPrompt("");
  };

  // Find the ProseMirror range for a needle string in the document.
  // Builds a character-level mapping from concatenated plain text to ProseMirror positions
  // by walking every text node. Block boundaries emit a newline separator to match editor.getText().
  const findTextRange = (doc: any, needle: string): { from: number; to: number } | null => {
    // Build plain text and a parallel array mapping each char index to its ProseMirror pos.
    // charToPos[i] = the ProseMirror position of the i-th character in `plain`.
    const charToPos: number[] = [];
    let plain = '';
    let lastBlockEnd = -1;

    doc.descendants((node: any, pos: number) => {
      if (node.isBlock && node.isTextblock && plain.length > 0 && pos !== lastBlockEnd) {
        // Insert a newline separator between text blocks (matches editor.getText() output)
        charToPos.push(-1); // newline has no single ProseMirror pos
        plain += '\n';
      }
      if (node.isText) {
        const t = node.text || '';
        for (let i = 0; i < t.length; i++) {
          charToPos.push(pos + 1 + i); // +1 because pos is before the text node
          plain += t[i];
        }
      }
      if (node.isBlock) {
        lastBlockEnd = pos + node.nodeSize;
      }
    });

    // Helper: given a match at [startIdx, endIdx) in `plain`, return ProseMirror {from, to}
    const rangeFromMatch = (startIdx: number, endIdx: number): { from: number; to: number } | null => {
      // Find the first valid ProseMirror pos at or after startIdx
      let from = -1;
      for (let i = startIdx; i < endIdx; i++) {
        if (charToPos[i] !== -1) { from = charToPos[i]; break; }
      }
      // Find the ProseMirror pos just after the last character
      let to = -1;
      for (let i = endIdx - 1; i >= startIdx; i--) {
        if (charToPos[i] !== -1) { to = charToPos[i] + 1; break; }
      }
      if (from !== -1 && to !== -1 && from < to) return { from, to };
      return null;
    };

    // Exact match
    const exactIdx = plain.indexOf(needle);
    if (exactIdx !== -1) {
      const result = rangeFromMatch(exactIdx, exactIdx + needle.length);
      if (result) return result;
    }

    // Fuzzy match: collapse whitespace
    const collapseWs = (s: string) => s.replace(/\s+/g, ' ').trim();
    const plainCollapsed = collapseWs(plain);
    const needleCollapsed = collapseWs(needle);
    if (!needleCollapsed) return null;

    const fuzzyIdx = plainCollapsed.indexOf(needleCollapsed);
    if (fuzzyIdx === -1) return null;

    // Map collapsed index back to original plain index
    let ci = 0; // collapsed index
    let origStart = -1;
    let origEnd = -1;
    for (let i = 0; i < plain.length && ci <= fuzzyIdx + needleCollapsed.length; i++) {
      const ch = plain[i];
      const isWs = /\s/.test(ch);
      // In collapsed string, consecutive whitespace maps to a single space
      if (isWs && i > 0 && /\s/.test(plain[i - 1])) continue; // skip extra ws
      if (ci === fuzzyIdx) origStart = i;
      ci++;
      if (ci === fuzzyIdx + needleCollapsed.length) { origEnd = i + 1; break; }
    }

    if (origStart !== -1 && origEnd !== -1) {
      return rangeFromMatch(origStart, origEnd);
    }

    return null;
  };

  // Get the best needle to locate a suggestion in the document based on its current status
  const getSuggestionNeedle = (suggestion: SuggestionWithStatus): string | null => {
    if (suggestion.status === 'accepted') {
      // After accept: search for the replacement/added text
      if (suggestion.action === 'replace' && suggestion.replace) return suggestion.replace;
      if (suggestion.action === 'add' && suggestion.content) return suggestion.content;
      // delete: text is gone, no needle
      return null;
    }
    // Pending/rejected: search for the original find text
    return suggestion.find || suggestion.content || null;
  };

  // Calculate the line number for a given text in the document
  const getLineNumber = (suggestion: SuggestionWithStatus): number | null => {
    if (!editor) return null;
    const needle = getSuggestionNeedle(suggestion);
    if (!needle) return null;
    const text = editor.getText();
    const index = text.indexOf(needle);
    if (index === -1) return null;
    const beforeMatch = text.substring(0, index);
    return beforeMatch.split('\n').length;
  };

  // Scroll the editor to a suggestion's location and briefly highlight it
  const scrollToSuggestion = (suggestion: SuggestionWithStatus) => {
    if (!editor) return;
    const { doc } = editor.state;
    const needle = getSuggestionNeedle(suggestion);
    if (!needle) return;

    const range = findTextRange(doc, needle);
    if (range) {
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    }
  };

  // Accept a suggestion - apply based on action type
  const handleAccept = async (suggestionId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !editor) return;

    const { doc } = editor.state;
    let applied = false;
    let appliedPosition: { from: number; to: number } | undefined;

    switch (suggestion.action) {
      case 'add':
        if (suggestion.content) {
          const endPos = doc.content.size - 1;
          const result = editor
            .chain()
            .focus('end')
            .insertContent(`\n\n${suggestion.content}`)
            .run();
          
          if (result) {
            appliedPosition = { from: endPos, to: endPos + suggestion.content.length + 2 };
            applied = true;
            editor.commands.focus();
          }
        }
        break;

      case 'replace':
        if (suggestion.find && suggestion.replace !== undefined) {
          const range = findTextRange(doc, suggestion.find);

          if (range) {
            // Debug: verify the range maps to the expected text
            const resolvedText = doc.textBetween(range.from, range.to, '');
            console.log(`[EnhanceSuggestionsPanel] Replace range: ${range.from}-${range.to}, resolved text: "${resolvedText.substring(0, 80)}", expected: "${suggestion.find.substring(0, 80)}"`);

            // Use ProseMirror transaction for atomic delete+insert
            const tr = editor.state.tr;
            tr.insertText(suggestion.replace!, range.from, range.to);
            editor.view.dispatch(tr);
            appliedPosition = { from: range.from, to: range.from + suggestion.replace!.length };
            applied = true;
            editor.commands.focus();
          }

          if (!applied) {
            console.warn(`[EnhanceSuggestionsPanel] Could not find text to replace: "${suggestion.find.substring(0, 80)}..."`);
          }
        }
        break;

      case 'delete':
        if (suggestion.find) {
          const range = findTextRange(doc, suggestion.find);

          if (range) {
            const tr = editor.state.tr;
            tr.delete(range.from, range.to);
            editor.view.dispatch(tr);
            appliedPosition = { from: range.from, to: range.from };
            applied = true;
            editor.commands.focus();
          }

          if (!applied) {
            console.warn(`[EnhanceSuggestionsPanel] Could not find text to delete: "${suggestion.find.substring(0, 80)}..."`);
          }
        }
        break;
    }

    // Create lineage entry for the applied suggestion
    if (applied) {
      try {
        // Note: The backend expects a nested suggestion object format
        // We're using the simpler lineage-only endpoint by sending the flat format
        // If this fails, it means the route conflict needs to be resolved on the backend
        await applyEnhancement({
          document_id: documentId,
          suggestion_title: suggestion.title,
          suggestion_action: suggestion.action,
          suggestion_type: suggestion.type,
        });
      } catch (err) {
        console.error('[EnhanceSuggestionsPanel] Failed to create lineage entry:', err);
        // Don't block the UI if lineage creation fails
      }
    }

    // Mark as accepted and store original content + position for revert
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Store the original content that was modified
        let originalContent = '';
        if (suggestion.action === 'replace' && suggestion.find) {
          originalContent = suggestion.find;
        } else if (suggestion.action === 'delete' && suggestion.find) {
          originalContent = suggestion.find;
        } else if (suggestion.action === 'add' && suggestion.content) {
          originalContent = suggestion.content;
        }
        return { 
          ...s, 
          status: "accepted" as SuggestionStatus,
          originalContent: originalContent || undefined,
          appliedPosition
        };
      }
      return s;
    }));

    onApplySuggestion?.(suggestion);
  };

  // Reject a suggestion
  const handleReject = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => 
      s.id === suggestionId ? { ...s, status: "rejected" as SuggestionStatus } : s
    ));
  };

  // Revert an accepted suggestion using reverse find-and-replace
  // (avoids Y.js undo stack issues that cause double-apply bugs)
  const handleRevert = (suggestionId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !editor || suggestion.status !== 'accepted') return;

    try {
      const { doc } = editor.state;
      let reverted = false;

      switch (suggestion.action) {
        case 'replace':
          // Reverse: find the replacement text, put back the original
          if (suggestion.replace && suggestion.find) {
            const range = findTextRange(doc, suggestion.replace);
            if (range) {
              const tr = editor.state.tr;
              tr.insertText(suggestion.find, range.from, range.to);
              editor.view.dispatch(tr);
              reverted = true;
            }
          }
          break;

        case 'delete':
          // Reverse: re-insert the deleted text at stored position
          if (suggestion.find && suggestion.appliedPosition) {
            const tr = editor.state.tr;
            tr.insertText(suggestion.find, suggestion.appliedPosition.from, suggestion.appliedPosition.from);
            editor.view.dispatch(tr);
            reverted = true;
          }
          break;

        case 'add':
          // Reverse: find and remove the added content
          if (suggestion.content) {
            const range = findTextRange(doc, suggestion.content);
            if (range) {
              const tr = editor.state.tr;
              tr.delete(range.from, range.to);
              editor.view.dispatch(tr);
              reverted = true;
            }
          }
          break;
      }

      if (reverted) {
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { 
            ...s, 
            status: "pending" as SuggestionStatus, 
            originalContent: undefined,
            appliedPosition: undefined
          } : s
        ));
        console.log(`[EnhanceSuggestionsPanel] Successfully reverted suggestion: ${suggestion.title}`);
      } else {
        console.warn(`[EnhanceSuggestionsPanel] Could not find text to revert for: ${suggestion.title}`);
      }
    } catch (err) {
      console.error(`[EnhanceSuggestionsPanel] Failed to revert suggestion: ${suggestion.title}`, err);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
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
    <>
      {/* Mobile overlay backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={async () => {
          const hasAcceptedSuggestions = suggestions.some(s => s.status === 'accepted');
          if (hasAcceptedSuggestions) {
            try {
              const docResponse = await getDocument(documentId);
              if (docResponse.document.status === 'published') {
                setIsReindexing(true);
                await reindexDocument(documentId);
                console.log('[EnhanceSuggestionsPanel] RAG re-indexing triggered for published document');
              }
            } catch (err) {
              console.error('[EnhanceSuggestionsPanel] Failed to trigger re-indexing:', err);
            } finally {
              setIsReindexing(false);
            }
          }
          sessionStorage.removeItem(storageKey);
          onClose();
        }}
      />
      
      {/* AI enhance panel - modal on mobile, sidebar on desktop */}
      <div className="fixed lg:relative inset-y-0 right-0 w-full sm:w-[520px] lg:w-[520px] border-l border-[var(--dash-border-subtle)] bg-[var(--surface-card)] flex flex-col h-full z-50 lg:z-auto">
        {/* Header */}
        <div className="p-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--brand)]" />
          <h3 className="font-semibold text-[var(--dash-text-primary)]">AI Enhancement</h3>
        </div>
        <div className="flex items-center gap-3">
          {score !== null && (
            <span className={`text-sm font-medium ${getScoreColor(score)}`}>
              Score: {score}%
            </span>
          )}
          <button
            onClick={async () => {
              // Check if any suggestions were accepted and document is published
              const hasAcceptedSuggestions = suggestions.some(s => s.status === 'accepted');
              
              if (hasAcceptedSuggestions) {
                try {
                  // Check if document is published
                  const docResponse = await getDocument(documentId);
                  if (docResponse.document.status === 'published') {
                    setIsReindexing(true);
                    // Trigger RAG re-ingestion for published documents
                    await reindexDocument(documentId);
                    console.log('[EnhanceSuggestionsPanel] RAG re-indexing triggered for published document');
                  }
                } catch (err) {
                  console.error('[EnhanceSuggestionsPanel] Failed to trigger re-indexing:', err);
                  // Don't block closing if re-index fails
                } finally {
                  setIsReindexing(false);
                }
              }
              
              // Clear persisted data when user explicitly closes
              sessionStorage.removeItem(storageKey);
              onClose();
            }}
            disabled={isReindexing}
            className="p-1 hover:bg-[var(--surface-ground)] rounded-md transition-colors disabled:opacity-50"
            title={isReindexing ? "Re-indexing document..." : "Close and clear enhancement data"}
          >
            {isReindexing ? (
              <Loader2 className="w-4 h-4 text-[var(--dash-text-tertiary)] animate-spin" />
            ) : (
              <X className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Info Banner - Close to apply changes */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          Close this panel to apply accepted changes and re-index your document
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Initial State - No suggestions yet */}
        {!suggestions.length && !isAnalyzing && !error && (
          <div className="p-6 text-center">
            <Sparkles className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4" />
            <h4 className="font-medium text-[var(--dash-text-primary)] mb-2">
              Enhance Your Document
            </h4>
            <p className="text-sm text-[var(--dash-text-tertiary)] mb-4">
              AI will analyze your content and suggest improvements for clarity, grammar, structure, and style. (Claude Sonnet)
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-amber-600 mb-3">
              <Coins className="w-4 h-4" />
              <span>Costs {ENHANCE_CREDIT_COST} credits • {creditsRemaining} available</span>
            </div>
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

        {/* Analyzing State */}
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

        {/* Error State */}
        {error && (
          <div className="p-4 m-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-600 mb-1">Error</p>
                <p className="text-sm text-red-600/80">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions View */}
        {suggestions.length > 0 && (
          <div className="flex flex-col h-full">
            {/* Document Preview Toggle */}
            <button
              onClick={() => setShowDocument(!showDocument)}
              className="flex items-center justify-between p-3 mx-4 mt-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
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

            {/* Document Content Preview */}
            {showDocument && (
              <div className="mx-4 mt-2 p-3 bg-white border border-[var(--dash-border-subtle)] rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {documentContent || "No content"}
                </p>
              </div>
            )}

            {/* Stats Bar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border-subtle)]">
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
                    className="text-xs font-medium text-green-600 hover:text-green-700"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {suggestions.map((suggestion) => {
                const styles = getTypeStyles(suggestion.type);
                const isAccepted = suggestion.status === "accepted";
                const isRejected = suggestion.status === "rejected";
                const isPending = suggestion.status === "pending";

                return (
                  <div
                    key={suggestion.id}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isAccepted ? "border-green-500/30 bg-green-500/5" :
                      isRejected ? "border-red-500/30 bg-red-500/5 opacity-60" :
                      "border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]"
                    }`}
                  >
                    {/* Suggestion Header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => toggleExpand(suggestion.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`p-1.5 rounded ${styles.bg} ${styles.text}`}>
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
                            {(() => {
                              const line = getLineNumber(suggestion);
                              return line !== null ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    scrollToSuggestion(suggestion);
                                  }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                                  title="Click to scroll to this location in the document"
                                >
                                  <Target className="w-2.5 h-2.5" />
                                  Line {line}
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        {isAccepted && (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle className="w-3 h-3" /> Accepted
                          </span>
                        )}
                        {isRejected && (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </div>
                      {suggestion.expanded ? (
                        <ChevronUp className="w-4 h-4 text-[var(--dash-text-tertiary)] ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)] ml-2" />
                      )}
                    </div>

                    {/* Expanded Content */}
                    {suggestion.expanded && (
                      <div className="px-3 pb-3 space-y-3">
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
                          {suggestion.action === 'delete' && suggestion.find && (
                            <div className="bg-red-50 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Trash2 className="w-3 h-3 text-red-600" />
                                <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Text to Delete</span>
                              </div>
                              <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap bg-red-100/50 p-2 rounded line-through">
                                {suggestion.find}
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
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                                suggestion.action === 'delete' 
                                  ? 'bg-red-600 hover:bg-red-700' 
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              <Check className="w-4 h-4" />
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
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
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

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]">
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
          </div>
        )}
      </div>

      {/* Credit Warning Modal */}
      {showCreditWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Confirm Enhancement</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">
                      This will use {ENHANCE_CREDIT_COST} credits
                    </p>
                    <p className="text-sm text-gray-600">
                      AI will analyze your document and provide improvement suggestions for grammar, clarity, structure, completeness, and style.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Current balance: {creditsRemaining} credits
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p className="mb-2">The analysis will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Generate a quality score (0-100)</li>
                  <li>Provide 3-5 actionable suggestions</li>
                  <li>Allow you to accept or reject each change</li>
                </ul>
              </div>

              {/* Custom Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Update for 2026, make it more formal, focus on technical details..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--brand)] resize-none"
                />
                <p className="text-xs text-gray-400">
                  Add specific instructions to guide the AI's analysis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={cancelAnalyze}
                className="flex-1 h-11 px-4 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAnalyze}
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
    </>
  );
}

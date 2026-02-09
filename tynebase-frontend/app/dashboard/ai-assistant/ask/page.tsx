"use client";

import { useState, useRef, useEffect } from "react";
import {
    Send,
    Loader2,
    FileText,
    ExternalLink,
    Sparkles,
    AlertCircle,
    BookOpen,
    Database,
    Search,
    ChevronDown,
    Zap,
    Coins,
    Copy,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { chatStream, type ChatSource } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";
import { type AIModelOption, AVAILABLE_MODELS } from "@/lib/utils/conversation-storage";

interface SearchResult {
    content: string;
    sources: ChatSource[];
    timestamp: Date;
    model: AIModelOption;
}

const DEFAULT_MODEL: AIModelOption = 'deepseek-v3';

export default function AskPage() {
    const { decrementCredits, refreshCredits } = useCredits();
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [streamingContent, setStreamingContent] = useState("");
    const [selectedModel, setSelectedModel] = useState<AIModelOption>(DEFAULT_MODEL);
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);
    const modelSelectRef = useRef<HTMLDivElement>(null);

    // Close model select on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) {
                setShowModelSelect(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

    const handleCopy = async () => {
        if (result) {
            await navigator.clipboard.writeText(result.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        if (result || streamingContent) {
            resultRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [result, streamingContent]);

    const handleSubmit = async () => {
        if (!query.trim() || isLoading) return;

        const userQuery = query.trim();
        setQuery("");
        setIsLoading(true);
        setError(null);
        setStreamingContent("");
        setResult(null);

        try {
            let content = "";
            let sources: ChatSource[] = [];

            await chatStream(
                {
                    query: userQuery,
                    history: [],
                    model: selectedModel,
                    stream: true,
                },
                (chunk) => {
                    content += chunk;
                    setStreamingContent(content);
                },
                (receivedSources) => {
                    sources = receivedSources;
                }
            );

            setResult({
                content,
                sources,
                timestamp: new Date(),
                model: selectedModel,
            });
            setStreamingContent("");

            // Update credits based on model cost
            const modelCost = AVAILABLE_MODELS.find(m => m.id === selectedModel)?.credits || 1;
            decrementCredits(modelCost);
            refreshCredits();
        } catch (err) {
            console.error('ASK error:', err);
            setError(err instanceof Error ? err.message : 'Failed to get answer');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex-shrink-0 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-purple-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
                                ASK
                            </h1>
                            <p className="text-sm text-[var(--dash-text-secondary)]">
                                Query your knowledge base with AI-powered RAG
                            </p>
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className="relative" ref={modelSelectRef}>
                        <button
                            onClick={() => setShowModelSelect(!showModelSelect)}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg hover:border-[var(--brand)] transition-colors"
                        >
                            <div className="flex items-center gap-1.5">
                                <Zap className={cn("w-3.5 h-3.5", currentModel.speed === 'fast' ? "text-green-500" : currentModel.speed === 'medium' ? "text-yellow-500" : "text-purple-500")} />
                                <span className="text-sm font-medium text-[var(--dash-text-primary)]">{currentModel.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-[var(--dash-text-tertiary)]">
                                <Coins className="w-3 h-3" />
                                <span>{currentModel.credits}</span>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-[var(--dash-text-tertiary)] transition-transform", showModelSelect && "rotate-180")} />
                        </button>

                        {showModelSelect && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="p-3 border-b border-[var(--dash-border-subtle)]">
                                    <h4 className="font-semibold text-sm text-[var(--dash-text-primary)]">Select Model</h4>
                                    <p className="text-xs text-[var(--dash-text-tertiary)]">Choose based on your needs</p>
                                </div>
                                <div className="p-2">
                                    {AVAILABLE_MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => { setSelectedModel(model.id); setShowModelSelect(false); }}
                                            className={cn(
                                                "w-full p-3 rounded-lg text-left transition-all",
                                                selectedModel === model.id
                                                    ? "bg-[var(--brand-primary-muted)] border border-[var(--brand)]"
                                                    : "hover:bg-[var(--surface-hover)] border border-transparent"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <Zap className={cn("w-4 h-4", model.speed === 'fast' ? "text-green-500" : model.speed === 'medium' ? "text-yellow-500" : "text-purple-500")} />
                                                    <span className="font-medium text-sm text-[var(--dash-text-primary)]">{model.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-ground)] rounded-full">
                                                    <Coins className="w-3 h-3 text-amber-500" />
                                                    <span className="text-xs font-medium text-[var(--dash-text-primary)]">{model.credits} credit{model.credits > 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-[var(--dash-text-secondary)] ml-6">{model.description}</p>
                                            <div className="flex items-center gap-3 mt-1.5 ml-6">
                                                <span className="text-[10px] text-[var(--dash-text-tertiary)]">{model.provider}</span>
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded",
                                                    model.speed === 'fast' ? "bg-green-500/10 text-green-600" : 
                                                    model.speed === 'medium' ? "bg-yellow-500/10 text-yellow-600" : 
                                                    "bg-purple-500/10 text-purple-600"
                                                )}>
                                                    {model.speed === 'fast' ? 'Fastest' : model.speed === 'medium' ? 'Balanced' : 'Premium'}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Welcome State */}
                    {!result && !streamingContent && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--brand)]/20 to-purple-600/20 flex items-center justify-center mb-6">
                                <Search className="w-10 h-10 text-[var(--brand)]" />
                            </div>
                            <h2 className="text-xl font-bold text-[var(--dash-text-primary)] mb-3">
                                Ask Anything About Your Knowledge Base
                            </h2>
                            <p className="text-[var(--dash-text-secondary)] max-w-md mb-6">
                                Get instant, accurate answers from your documents using our advanced RAG system with semantic search and reranking.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                                <div className="p-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-left">
                                    <Database className="w-5 h-5 text-[var(--brand)] mb-2" />
                                    <h3 className="font-semibold text-sm text-[var(--dash-text-primary)] mb-1">
                                        Semantic Search
                                    </h3>
                                    <p className="text-xs text-[var(--dash-text-secondary)]">
                                        Hybrid vector + full-text search for best results
                                    </p>
                                </div>
                                <div className="p-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-left">
                                    <BookOpen className="w-5 h-5 text-[var(--brand)] mb-2" />
                                    <h3 className="font-semibold text-sm text-[var(--dash-text-primary)] mb-1">
                                        Source Citations
                                    </h3>
                                    <p className="text-xs text-[var(--dash-text-secondary)]">
                                        Every answer includes relevant source documents
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-500 mb-1">Error</h3>
                                <p className="text-sm text-red-500/80">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Streaming State */}
                    {streamingContent && (
                        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Loader2 className="w-4 h-4 animate-spin text-[var(--brand)]" />
                                <span className="text-sm font-semibold text-[var(--dash-text-primary)]">
                                    Generating answer...
                                </span>
                            </div>
                            <div className="prose prose-sm max-w-none text-[var(--dash-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                {streamingContent}
                            </div>
                        </div>
                    )}

                    {/* Result State */}
                    {result && (
                        <div className="space-y-6" ref={resultRef}>
                            {/* Answer */}
                            <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                                    <span className="text-sm font-semibold text-[var(--dash-text-primary)]">
                                        Answer
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface-ground)] rounded text-[var(--dash-text-muted)]">
                                        {AVAILABLE_MODELS.find(m => m.id === result.model)?.name}
                                    </span>
                                    <div className="flex items-center gap-2 ml-auto">
                                        <button
                                            onClick={handleCopy}
                                            className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                                            title="Copy answer"
                                        >
                                            {copied ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                                            )}
                                        </button>
                                        <span className="text-xs text-[var(--dash-text-tertiary)]">
                                            {result.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="prose prose-sm max-w-none text-[var(--dash-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                    {result.content}
                                </div>
                            </div>

                            {/* Sources */}
                            {result.sources && result.sources.length > 0 && (
                                <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText className="w-4 h-4 text-[var(--brand)]" />
                                        <span className="text-sm font-semibold text-[var(--dash-text-primary)]">
                                            Sources ({result.sources.length})
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {result.sources.map((source, idx) => (
                                            <div
                                                key={idx}
                                                className="p-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg hover:border-[var(--brand)]/30 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <span className="font-medium text-[var(--dash-text-primary)] text-sm">
                                                        {source.title}
                                                    </span>
                                                    <span className="text-xs text-[var(--dash-text-tertiary)] whitespace-nowrap px-2 py-0.5 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full">
                                                        {Math.round(source.similarity_score * 100)}% match
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--dash-text-secondary)] line-clamp-3 mb-3">
                                                    {source.chunk_text}
                                                </p>
                                                <a
                                                    href={`/dashboard/knowledge/${source.document_id}`}
                                                    className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                                                >
                                                    View document
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Area - Fixed at bottom */}
                <div className="flex-shrink-0 pt-6">
                    <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-4">
                        <div className="flex gap-3">
                            <textarea
                                ref={textareaRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask a question about your knowledge base..."
                                disabled={isLoading}
                                className="flex-1 min-h-[56px] max-h-32 p-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] resize-none text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={1}
                            />
                            <Button
                                onClick={handleSubmit}
                                disabled={!query.trim() || isLoading}
                                size="lg"
                                variant="primary"
                                className="h-14 px-6"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Ask
                                    </>
                                )}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2 px-1">
                            <div className="flex items-center gap-2 text-[10px] text-[var(--dash-text-tertiary)]">
                                <Coins className="w-3 h-3 text-amber-500" />
                                <span>{currentModel.credits} {currentModel.credits === 1 ? 'credit' : 'credits'} per question</span>
                            </div>
                            <div className="text-[10px] text-[var(--dash-text-tertiary)]">
                                Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded text-[10px]">Enter</kbd> to ask
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

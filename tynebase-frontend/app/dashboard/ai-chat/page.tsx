"use client";

import { useState, useRef, useEffect } from "react";
import {
    Send,
    Loader2,
    FileText,
    ExternalLink,
    Sparkles,
    AlertCircle,
    Bot,
    User,
    MessageSquare,
    Plus,
    Trash2,
    Download,
    Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { chatStream, type ChatRequest, type ChatSource, type ChatMessage } from "@/lib/api/ai";
import {
    getConversations,
    getConversation,
    createConversation,
    addMessage,
    deleteConversation,
    getActiveConversationId,
    setActiveConversationId,
    getRecentMessages,
    exportConversations,
    importConversations,
    type StoredMessage,
    type Conversation
} from "@/lib/utils/conversation-storage";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatSource[];
    timestamp: Date;
    isStreaming?: boolean;
}

const MAX_HISTORY_MESSAGES = 20;

export default function AIChatPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load conversations on mount
    useEffect(() => {
        const loadedConversations = getConversations();
        setConversations(loadedConversations);
        
        const activeId = getActiveConversationId();
        if (activeId && loadedConversations.find(c => c.id === activeId)) {
            loadConversation(activeId);
        } else if (loadedConversations.length > 0) {
            loadConversation(loadedConversations[0].id);
        }
    }, []);

    const loadConversation = (id: string) => {
        const conversation = getConversation(id);
        if (!conversation) return;
        
        setActiveConversationIdState(id);
        setActiveConversationId(id);
        setMessages(conversation.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
        })));
        setError(null);
    };

    const handleNewConversation = () => {
        const conversation = createConversation();
        setConversations([conversation, ...conversations]);
        loadConversation(conversation.id);
    };

    const handleDeleteConversation = (id: string) => {
        deleteConversation(id);
        const updated = conversations.filter(c => c.id !== id);
        setConversations(updated);
        
        if (activeConversationId === id) {
            if (updated.length > 0) {
                loadConversation(updated[0].id);
            } else {
                handleNewConversation();
            }
        }
    };

    const handleExport = () => {
        const json = exportConversations();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tynebase-conversations-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const json = event.target?.result as string;
            if (importConversations(json)) {
                const loadedConversations = getConversations();
                setConversations(loadedConversations);
                if (loadedConversations.length > 0) {
                    loadConversation(loadedConversations[0].id);
                }
            }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Ensure we have an active conversation
        let convId = activeConversationId;
        if (!convId) {
            const newConv = createConversation();
            setConversations([newConv, ...conversations]);
            convId = newConv.id;
            setActiveConversationIdState(convId);
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        addMessage(convId, userMessage);
        setInput("");
        setIsLoading(true);
        setError(null);

        // Create streaming assistant message
        const assistantId = (Date.now() + 1).toString();
        const streamingMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        };
        setMessages(prev => [...prev, streamingMessage]);

        try {
            // Get last 20 messages for context (excluding current streaming message)
            const recentMessages = getRecentMessages(convId, MAX_HISTORY_MESSAGES);
            const history: ChatMessage[] = recentMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));

            const request: ChatRequest = {
                query: userMessage.content,
                history,
                max_context_chunks: 5,
                stream: true,
            };

            let fullContent = '';
            let sources: ChatSource[] = [];

            await chatStream(
                request,
                (chunk) => {
                    fullContent += chunk;
                    setMessages(prev => 
                        prev.map(msg => 
                            msg.id === assistantId 
                                ? { ...msg, content: fullContent }
                                : msg
                        )
                    );
                },
                (receivedSources) => {
                    sources = receivedSources;
                    setMessages(prev => 
                        prev.map(msg => 
                            msg.id === assistantId 
                                ? { ...msg, sources: receivedSources }
                                : msg
                        )
                    );
                }
            );

            // Finalize message
            const finalMessage: Message = {
                id: assistantId,
                role: 'assistant',
                content: fullContent,
                sources,
                timestamp: new Date(),
                isStreaming: false,
            };

            setMessages(prev => 
                prev.map(msg => 
                    msg.id === assistantId ? finalMessage : msg
                )
            );

            // Save to storage
            addMessage(convId, finalMessage);

            // Update conversations list
            const updatedConversations = getConversations();
            setConversations(updatedConversations);

        } catch (err) {
            console.error('Chat error:', err);
            setError(err instanceof Error ? err.message : 'Failed to get response');
            
            // Remove streaming message on error
            setMessages(prev => prev.filter(msg => msg.id !== assistantId));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 min-h-0 flex flex-col bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm">
                
                {/* Header */}
                <div className="h-14 px-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[var(--brand-primary-muted)] to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[var(--dash-text-primary)]">AI Chat Assistant</h3>
                            <p className="text-xs text-[var(--dash-text-tertiary)]">Ask questions about your documents</p>
                        </div>
                    </div>
                    <div className="text-xs text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)] px-3 py-1 rounded-full border border-[var(--dash-border-subtle)]">
                        RAG-powered
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--brand-primary-muted)] flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-[var(--brand)]" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-[var(--dash-text-primary)]">Start a conversation</h3>
                                <p className="text-sm text-[var(--dash-text-tertiary)] max-w-md">
                                    Ask questions about your documents and I'll search through them to provide accurate answers with source citations.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-2xl">
                                <ExamplePrompt onClick={() => setInput("What are the key points in my documents?")}>
                                    What are the key points in my documents?
                                </ExamplePrompt>
                                <ExamplePrompt onClick={() => setInput("Summarize the main findings")}>
                                    Summarize the main findings
                                </ExamplePrompt>
                                <ExamplePrompt onClick={() => setInput("What information do I have about...")}>
                                    What information do I have about...
                                </ExamplePrompt>
                                <ExamplePrompt onClick={() => setInput("Compare the different approaches")}>
                                    Compare the different approaches
                                </ExamplePrompt>
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                message.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}
                            
                            <div className={cn(
                                "flex flex-col gap-2 max-w-[80%]",
                                message.role === 'user' ? "items-end" : "items-start"
                            )}>
                                <div className={cn(
                                    "rounded-2xl px-4 py-3 shadow-sm",
                                    message.role === 'user'
                                        ? "bg-[var(--brand)] text-white"
                                        : "bg-[var(--surface-ground)] text-[var(--dash-text-primary)] border border-[var(--dash-border-subtle)]"
                                )}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                </div>

                                {message.sources && message.sources.length > 0 && (
                                    <div className="space-y-2 w-full">
                                        <p className="text-xs font-medium text-[var(--dash-text-tertiary)] px-2">
                                            Sources ({message.sources.length})
                                        </p>
                                        <div className="space-y-2">
                                            {message.sources.map((source, idx) => (
                                                <SourceCard key={idx} source={source} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <span className="text-[10px] text-[var(--dash-text-tertiary)] px-2">
                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            {message.role === 'user' && (
                                <div className="w-8 h-8 rounded-lg bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-[var(--dash-text-secondary)]" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center flex-shrink-0">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="rounded-2xl px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)]">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-[var(--brand)]" />
                                        <span className="text-sm text-[var(--dash-text-secondary)]">Searching documents and generating response...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="rounded-2xl px-4 py-3 bg-red-50 border border-red-200">
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-[var(--dash-border-subtle)] flex-shrink-0 bg-[var(--surface-ground)]/30">
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="Ask a question about your documents..."
                                disabled={isLoading}
                                className="w-full min-h-[52px] max-h-32 px-4 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] resize-none custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                rows={1}
                            />
                            {messages.some(m => m.isStreaming) && (
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-[var(--dash-text-tertiary)]">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Streaming...</span>
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="h-[52px] px-6 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </Button>
                    </form>
                    <p className="text-[10px] text-[var(--dash-text-tertiary)] text-center mt-2">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </div>
            </div>
        </div>
    );
}

function ExamplePrompt({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="text-left px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:border-[var(--brand)] hover:text-[var(--dash-text-primary)] transition-all"
        >
            {children}
        </button>
    );
}

function SourceCard({ source }: { source: ChatSource }) {
    return (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-3 hover:border-[var(--brand)] transition-all group">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-[var(--brand-primary-muted)] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[var(--brand)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[var(--dash-text-primary)] truncate">
                            {source.title}
                        </h4>
                        <a
                            href={`/dashboard/knowledge/${source.document_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--dash-text-tertiary)] hover:text-[var(--brand)] transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                    <p className="text-xs text-[var(--dash-text-secondary)] line-clamp-2 mb-2">
                        {source.chunk_text}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--dash-text-tertiary)]">
                            Relevance: {Math.round(source.similarity_score * 100)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

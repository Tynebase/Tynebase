"use client";

import { useState, useEffect, useRef } from "react";
import {
    Send,
    Bot,
    User,
    Trash2,
    FileText,
    ExternalLink
} from "lucide-react";
import { GeminiGlow, GeminiThinkingBar } from "@/components/ui/GeminiGlow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { chatStream, ChatMessage, ChatSource } from "@/lib/api/ai";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ConversationMessage extends ChatMessage {
  id: string;
  timestamp: string;
  sources?: ChatSource[];
}

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const STORAGE_KEY = 'tynebase_chat_history';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load chat history:', e);
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateTitle(firstMessage: string): string {
  const words = firstMessage.split(' ').slice(0, 6);
  return words.join(' ') + (firstMessage.split(' ').length > 6 ? '...' : '');
}

export default function ChatPage() {
    // State management
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState("");
    const [showSidebar, setShowSidebar] = useState(true);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load conversations from local storage on mount
    useEffect(() => {
        const loaded = loadConversations();
        setConversations(loaded);
        if (loaded.length > 0 && !activeConversationId) {
            setActiveConversationId(loaded[0].id);
        }
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, streamingMessage]);

    // Get active conversation
    const activeConversation = conversations.find(c => c.id === activeConversationId);

    // Create new conversation
    const createNewConversation = () => {
        const newConv: Conversation = {
            id: generateId(),
            title: 'New Chat',
            messages: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const updated = [newConv, ...conversations];
        setConversations(updated);
        saveConversations(updated);
        setActiveConversationId(newConv.id);
        setShowSidebar(false);
    };

    // Delete conversation
    const deleteConversation = (id: string) => {
        const updated = conversations.filter(c => c.id !== id);
        setConversations(updated);
        saveConversations(updated);
        if (activeConversationId === id) {
            setActiveConversationId(updated.length > 0 ? updated[0].id : null);
        }
    };

    // Send message
    const sendMessage = async () => {
        if (!messageInput.trim() || isLoading) return;

        const userMessage = messageInput.trim();
        setMessageInput("");
        setIsLoading(true);
        setStreamingMessage("");

        try {
            // Create conversation if needed
            let convId = activeConversationId;
            let currentConv = activeConversation;

            if (!convId) {
                const newConv: Conversation = {
                    id: generateId(),
                    title: generateTitle(userMessage),
                    messages: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                convId = newConv.id;
                currentConv = newConv;
                setConversations(prev => [newConv, ...prev]);
                setActiveConversationId(convId);
            }

            // Add user message
            const userMsg: ConversationMessage = {
                id: generateId(),
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString(),
            };

            const updatedMessages = [...(currentConv?.messages || []), userMsg];
            
            // Update conversation with user message
            setConversations(prev => prev.map(c => 
                c.id === convId 
                    ? { ...c, messages: updatedMessages, updated_at: new Date().toISOString() }
                    : c
            ));

            // Prepare chat history for API
            const history: ChatMessage[] = updatedMessages.map(m => ({
                role: m.role,
                content: m.content,
            }));

            let assistantContent = "";
            let sources: ChatSource[] = [];

            // Stream response
            await chatStream(
                {
                    query: userMessage,
                    history: history.slice(0, -1), // Exclude current message
                    stream: true,
                },
                (chunk) => {
                    assistantContent += chunk;
                    setStreamingMessage(assistantContent);
                },
                (receivedSources) => {
                    sources = receivedSources;
                }
            );

            // Add assistant message
            const assistantMsg: ConversationMessage = {
                id: generateId(),
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date().toISOString(),
                sources: sources.length > 0 ? sources : undefined,
            };

            const finalMessages = [...updatedMessages, assistantMsg];
            
            // Update conversation with assistant response
            const updatedConvs = conversations.map(c => 
                c.id === convId 
                    ? { 
                        ...c, 
                        messages: finalMessages,
                        title: c.messages.length === 0 ? generateTitle(userMessage) : c.title,
                        updated_at: new Date().toISOString() 
                      }
                    : c
            );
            
            setConversations(updatedConvs);
            saveConversations(updatedConvs);
            setStreamingMessage("");

        } catch (error) {
            console.error('Chat error:', error);
            alert(error instanceof Error ? error.message : 'Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 min-h-0 flex bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm">

                {/* Sidebar - Conversation History */}
                <div className={cn(
                    "w-full md:w-64 flex-shrink-0 bg-[var(--surface-ground)] border-r border-[var(--dash-border-subtle)] flex-col",
                    showSidebar ? "flex" : "hidden md:flex"
                )}>
                    {/* Header */}
                    <div className="h-14 px-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0">
                        <h2 className="font-bold text-[var(--dash-text-primary)] truncate">Chat History</h2>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={createNewConversation}
                            className="h-8 w-8 p-0"
                        >
                            <Bot className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar highlight-scrollbar py-2">
                        {conversations.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-[var(--dash-text-tertiary)]">
                                No conversations yet.
                                <br />
                                Start a new chat!
                            </div>
                        ) : (
                            <div className="space-y-1 px-2">
                                {conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        className={cn(
                                            "group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                                            activeConversationId === conv.id
                                                ? "bg-[var(--brand-primary-muted)] text-[var(--brand)]"
                                                : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
                                        )}
                                        onClick={() => {
                                            setActiveConversationId(conv.id);
                                            setShowSidebar(false);
                                        }}
                                    >
                                        <FileText className="w-4 h-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{conv.title}</div>
                                            <div className="text-xs opacity-70">
                                                {conv.messages.length} messages
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteConversation(conv.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-card)] relative">
                    {/* Chat Header */}
                    <div className="h-14 px-4 sm:px-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className="md:hidden p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                            >
                                <FileText className="w-5 h-5" />
                            </button>
                            <Bot className="w-6 h-6 text-[var(--brand)]" />
                            <div>
                                <h3 className="font-bold text-[var(--dash-text-primary)]">
                                    {activeConversation?.title || 'AI Assistant'}
                                </h3>
                                <p className="text-xs text-[var(--dash-text-tertiary)]">RAG-powered knowledge chat</p>
                            </div>
                        </div>
                        {activeConversation && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={createNewConversation}
                            >
                                New Chat
                            </Button>
                        )}
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 custom-scrollbar">
                        {!activeConversation || activeConversation.messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <Bot className="w-16 h-16 text-[var(--brand)] mb-4" />
                                <h3 className="text-xl font-bold text-[var(--dash-text-primary)] mb-2">
                                    Welcome to AI Chat
                                </h3>
                                <p className="text-[var(--dash-text-secondary)] max-w-md">
                                    Ask questions about your documents and get AI-powered answers with source citations.
                                </p>
                            </div>
                        ) : (
                            <>
                                {activeConversation.messages.map((msg) => (
                                    <div key={msg.id} className="flex gap-4">
                                        <div className="flex-shrink-0">
                                            {msg.role === 'user' ? (
                                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary-muted)] text-[var(--brand)] flex items-center justify-center">
                                                    <User className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center">
                                                    <Bot className="w-4 h-4 text-[var(--brand)]" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-[var(--dash-text-primary)]">
                                                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                                                </span>
                                                <span className="text-xs text-[var(--dash-text-tertiary)]">
                                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-[var(--dash-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                                {msg.content}
                                            </div>
                                            {msg.sources && msg.sources.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <div className="text-xs font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider">
                                                        Sources
                                                    </div>
                                                    <div className="space-y-2">
                                                        {msg.sources.map((source, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="p-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm"
                                                            >
                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                    <span className="font-medium text-[var(--dash-text-primary)]">
                                                                        {source.title}
                                                                    </span>
                                                                    <span className="text-xs text-[var(--dash-text-tertiary)] whitespace-nowrap">
                                                                        {Math.round(source.similarity_score * 100)}% match
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-[var(--dash-text-secondary)] line-clamp-2">
                                                                    {source.chunk_text}
                                                                </p>
                                                                <a
                                                                    href={`/dashboard/knowledge/${source.document_id}`}
                                                                    className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--brand)] hover:underline"
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
                                    </div>
                                ))}
                                {streamingMessage && (
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center">
                                                <Bot className="w-4 h-4 text-[var(--brand)]" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-[var(--dash-text-primary)]">AI Assistant</span>
                                                <GeminiGlow size="sm" />
                                            </div>
                                            <GeminiThinkingBar className="mb-2" />
                                            <div className="prose prose-sm max-w-none text-[var(--dash-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                                {streamingMessage}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-[var(--dash-border-subtle)] flex-shrink-0">
                        <div className="flex gap-3">
                            <textarea
                                ref={textareaRef}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask a question about your documents..."
                                disabled={isLoading}
                                className="flex-1 min-h-[48px] max-h-32 p-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] resize-none text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={1}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!messageInput.trim() || isLoading}
                                size="lg"
                                variant="primary"
                                className="h-12 px-6"
                            >
                                {isLoading ? (
                                    <GeminiGlow size="sm" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Send
                                    </>
                                )}
                            </Button>
                        </div>
                        <div className="text-xs text-[var(--dash-text-tertiary)] text-center mt-2">
                            Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded text-[10px]">Shift+Enter</kbd> for new line
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

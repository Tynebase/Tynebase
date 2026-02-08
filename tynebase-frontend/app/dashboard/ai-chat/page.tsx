"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Send,
    Loader2,
    FileText,
    ExternalLink,
    Sparkles,
    AlertCircle,
    Bot,
    User,
    Plus,
    Trash2,
    Download,
    Upload,
    ChevronDown,
    Zap,
    Clock,
    Coins,
    Search,
    Settings2,
    PanelLeftClose,
    PanelLeft,
    MoreVertical,
    Copy,
    Check,
    RefreshCw,
    Pencil,
    X,
    MessageSquare,
    Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { RainbowProgressBar } from "@/components/ui/RainbowProgressBar";
import { chatStream, type ChatRequest, type ChatSource, type ChatMessage } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";
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
    updateConversation,
    replaceMessages,
    type StoredMessage,
    type Conversation,
    type AIModelOption,
    type ModelInfo,
    AVAILABLE_MODELS
} from "@/lib/utils/conversation-storage";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatSource[];
    timestamp: Date;
    isStreaming?: boolean;
    model?: AIModelOption;
}

const MAX_HISTORY_MESSAGES = 20;
const DEFAULT_MODEL: AIModelOption = 'deepseek-v3';

export default function AIChatPage() {
    const { decrementCredits, refreshCredits } = useCredits();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedModel, setSelectedModel] = useState<AIModelOption>(DEFAULT_MODEL);
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelSelectRef = useRef<HTMLDivElement>(null);
    const editTextareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Hide sidebar on mobile by default
    useEffect(() => {
        if (isMobile) setShowSidebar(false);
    }, [isMobile]);

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

    // Focus edit textarea when editing
    useEffect(() => {
        if (editingMessageId && editTextareaRef.current) {
            editTextareaRef.current.focus();
            editTextareaRef.current.setSelectionRange(editingContent.length, editingContent.length);
        }
    }, [editingMessageId]);

    // Load conversations on mount
    useEffect(() => {
        const loadedConversations = getConversations();
        setConversations(loadedConversations);
        
        const activeId = getActiveConversationId();
        if (activeId && loadedConversations.find(c => c.id === activeId)) {
            loadConversation(activeId, loadedConversations);
        } else if (loadedConversations.length > 0) {
            loadConversation(loadedConversations[0].id, loadedConversations);
        }
    }, []);

    const loadConversation = (id: string, convs?: Conversation[]) => {
        const conversationList = convs || conversations;
        const conversation = conversationList.find(c => c.id === id) || getConversation(id);
        if (!conversation) return;
        
        setActiveConversationIdState(id);
        setActiveConversationId(id);
        setMessages(conversation.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
        })));
        setSelectedModel(conversation.model || DEFAULT_MODEL);
        setError(null);
    };

    const handleNewConversation = () => {
        const conversation = createConversation();
        const updated = [conversation, ...conversations];
        setConversations(updated);
        setActiveConversationIdState(conversation.id);
        setActiveConversationId(conversation.id);
        setMessages([]);
        setSelectedModel(DEFAULT_MODEL);
        setError(null);
    };

    const handleDeleteConversation = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDeleteConversation = () => {
        if (!deleteConfirmId) return;
        deleteConversation(deleteConfirmId);
        const updated = conversations.filter(c => c.id !== deleteConfirmId);
        setConversations(updated);
        
        if (activeConversationId === deleteConfirmId) {
            if (updated.length > 0) {
                loadConversation(updated[0].id, updated);
            } else {
                setActiveConversationIdState(null);
                setActiveConversationId(null);
                setMessages([]);
            }
        }
        setDeleteConfirmId(null);
    };

    const handleModelChange = (model: AIModelOption) => {
        setSelectedModel(model);
        setShowModelSelect(false);
        if (activeConversationId) {
            updateConversation(activeConversationId, { model });
            setConversations(getConversations());
        }
    };

    const handleCopyMessage = async (content: string, messageId: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    const handleEditMessage = (message: Message) => {
        setEditingMessageId(message.id);
        setEditingContent(message.content);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditingContent("");
    };

    const handleSaveEdit = async (messageId: string) => {
        if (!editingContent.trim() || !activeConversationId) return;
        
        // Find the message index and remove all messages after it
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        // Update the user message and remove subsequent messages
        const updatedMessages = messages.slice(0, messageIndex);
        const editedMessage: Message = {
            ...messages[messageIndex],
            content: editingContent.trim(),
        };
        updatedMessages.push(editedMessage);
        setMessages(updatedMessages);
        setEditingMessageId(null);
        setEditingContent("");

        // Persist the edited messages to storage
        replaceMessages(activeConversationId, updatedMessages);
        setConversations(getConversations());

        // Regenerate the response
        await regenerateFromMessage(editedMessage, updatedMessages);
    };

    const handleRegenerate = async (messageId: string) => {
        if (!activeConversationId || isLoading) return;
        
        // Find the assistant message and get the preceding user message
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1 || msgIndex === 0) return;
        
        const userMessage = messages[msgIndex - 1];
        if (userMessage.role !== 'user') return;

        // Remove the assistant message
        const updatedMessages = messages.slice(0, msgIndex);
        setMessages(updatedMessages);
        
        // Persist the state before regenerating
        replaceMessages(activeConversationId, updatedMessages);
        setConversations(getConversations());
        
        await regenerateFromMessage(userMessage, updatedMessages);
    };

    const regenerateFromMessage = async (userMessage: Message, currentMessages: Message[]) => {
        if (!activeConversationId) return;
        
        setIsLoading(true);
        setError(null);

        const assistantId = (Date.now() + 1).toString();
        const streamingMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
            model: selectedModel,
        };
        setMessages([...currentMessages, streamingMessage]);

        try {
            const history: ChatMessage[] = currentMessages
                .slice(-MAX_HISTORY_MESSAGES)
                .map(msg => ({ role: msg.role, content: msg.content }));

            const request: ChatRequest = {
                query: userMessage.content,
                history,
                max_context_chunks: 5,
                model: selectedModel,
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
                            msg.id === assistantId ? { ...msg, content: fullContent } : msg
                        )
                    );
                },
                (receivedSources) => {
                    sources = receivedSources;
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === assistantId ? { ...msg, sources: receivedSources } : msg
                        )
                    );
                }
            );

            const finalMessage: Message = {
                id: assistantId,
                role: 'assistant',
                content: fullContent,
                sources,
                timestamp: new Date(),
                isStreaming: false,
                model: selectedModel,
            };

            setMessages(prev =>
                prev.map(msg => (msg.id === assistantId ? finalMessage : msg))
            );

            // Persist the regenerated conversation to storage
            const finalMessages = [...currentMessages, finalMessage];
            replaceMessages(activeConversationId, finalMessages);
            setConversations(getConversations());
        } catch (err) {
            console.error('Regenerate error:', err);
            setError(err instanceof Error ? err.message : 'Failed to regenerate response');
            setMessages(prev => prev.filter(msg => msg.id !== assistantId));
            // Persist the state without the failed message
            replaceMessages(activeConversationId, currentMessages);
        } finally {
            setIsLoading(false);
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
                    loadConversation(loadedConversations[0].id, loadedConversations);
                }
            }
        };
        reader.readAsText(file);
    };

    const filteredConversations = searchQuery
        ? conversations.filter(c => 
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : conversations;

    const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Ensure we have an active conversation
        let convId = activeConversationId;
        if (!convId) {
            const newConv = createConversation();
            updateConversation(newConv.id, { model: selectedModel });
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
            model: selectedModel,
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
                model: selectedModel,
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
                model: selectedModel,
            };

            setMessages(prev => 
                prev.map(msg => 
                    msg.id === assistantId ? finalMessage : msg
                )
            );

            // Save to storage
            addMessage(convId, { ...finalMessage, model: selectedModel });

            // Update conversations list
            const updatedConversations = getConversations();
            setConversations(updatedConversations);

            // Decrement credits based on model cost and refresh from server
            const modelCost = AVAILABLE_MODELS.find(m => m.id === selectedModel)?.credits || 1;
            decrementCredits(modelCost);
            refreshCredits();

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
        <div className="flex flex-col flex-1 min-h-0">
            <RainbowProgressBar isLoading={isLoading} />
            <div className="flex-1 min-h-0 flex bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm relative">
                
                {/* Mobile Overlay */}
                {isMobile && showSidebar && (
                    <div 
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setShowSidebar(false)}
                    />
                )}

                {/* Sidebar - Conversation History */}
                <div className={cn(
                    "bg-[var(--surface-ground)] border-r border-[var(--dash-border-subtle)] flex-col transition-all duration-300",
                    isMobile 
                        ? "fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw]" 
                        : "w-72 flex-shrink-0",
                    showSidebar ? "flex" : "hidden"
                )}>
                    {/* Sidebar Header */}
                    <div className="h-14 px-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0">
                        <h2 className="font-bold text-[var(--dash-text-primary)]">Conversations</h2>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleNewConversation}
                                className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-orange-500/10 hover:text-orange-500 text-[var(--dash-text-primary)] transition-all duration-200 group relative"
                            >
                                <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                                    New Chat
                                </span>
                            </button>
                            <button
                                onClick={() => setShowSidebar(false)}
                                className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-orange-500/10 hover:text-orange-500 text-[var(--dash-text-primary)] transition-all duration-200 group relative"
                            >
                                <PanelLeftClose className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                                    Hide Sidebar
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-[var(--dash-border-subtle)]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search conversations..."
                                className="w-full h-9 pl-9 pr-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                            />
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                        {filteredConversations.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-[var(--dash-text-tertiary)]">
                                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                            </div>
                        ) : (
                            <div className="space-y-1 px-2">
                                {filteredConversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        className={cn(
                                            "group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                                            activeConversationId === conv.id
                                                ? "bg-[var(--brand-primary-muted)] text-[var(--brand)]"
                                                : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
                                        )}
                                        onClick={() => loadConversation(conv.id)}
                                    >
                                        <FileText className="w-4 h-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{conv.title}</div>
                                            <div className="text-xs opacity-70 flex items-center gap-2">
                                                <span>{conv.messages.length} msgs</span>
                                                {conv.model && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface-ground)] rounded">
                                                        {AVAILABLE_MODELS.find(m => m.id === conv.model)?.name.split(' ')[0]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    <div className="p-3 border-t border-[var(--dash-border-subtle)] flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleExport} className="flex-1 h-8 text-xs">
                            <Download className="w-3 h-3 mr-1" /> Export
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 h-8 text-xs">
                            <Upload className="w-3 h-3 mr-1" /> Import
                        </Button>
                        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="h-14 px-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[var(--brand-primary-muted)] to-transparent">
                        <div className="flex items-center gap-3">
                            {!showSidebar && (
                                <Button size="sm" variant="ghost" onClick={() => setShowSidebar(true)} className="h-8 w-8 p-0 mr-1">
                                    <PanelLeft className="w-4 h-4" />
                                </Button>
                            )}
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--dash-text-primary)]">AI Chat</h3>
                                <p className="text-xs text-[var(--dash-text-tertiary)]">RAG-powered document assistant</p>
                            </div>
                        </div>

                        {/* Model Selector */}
                        <div className="relative" ref={modelSelectRef}>
                            <button
                                onClick={() => setShowModelSelect(!showModelSelect)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg hover:border-[var(--brand)] transition-colors"
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
                                                onClick={() => handleModelChange(model.id)}
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
                                        Ask questions about your documents. I'll search through them to provide accurate answers with source citations.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)] px-3 py-1.5 rounded-full">
                                    <span>Using</span>
                                    <span className="font-medium text-[var(--dash-text-primary)]">{currentModel.name}</span>
                                    <span>•</span>
                                    <Coins className="w-3 h-3 text-amber-500" />
                                    <span>{currentModel.credits} credit/msg</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-2xl">
                                    <ExamplePrompt onClick={() => setInput("What are the key points in my documents?")}>
                                        What are the key points in my documents?
                                    </ExamplePrompt>
                                    <ExamplePrompt onClick={() => setInput("Summarise the main findings")}>
                                        Summarise the main findings
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
                                    "group flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
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
                                        "relative rounded-2xl px-4 py-3 shadow-sm",
                                        message.role === 'user'
                                            ? "bg-[var(--brand)] text-white"
                                            : "bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)]"
                                    )}>
                                        {editingMessageId === message.id ? (
                                            <div className="w-full">
                                                <textarea
                                                    ref={editTextareaRef}
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    className="w-full min-h-[60px] p-2 bg-white dark:bg-[var(--surface-ground)] text-[var(--dash-text-primary)] border border-[var(--dash-border-subtle)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSaveEdit(message.id);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    <Button size="sm" onClick={() => handleSaveEdit(message.id)} className="h-7 text-xs">
                                                        <Send className="w-3 h-3 mr-1" /> Send
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 text-xs">
                                                        <X className="w-3 h-3 mr-1" /> Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className={cn(
                                                "text-sm leading-relaxed whitespace-pre-wrap",
                                                message.role === 'user' ? "!text-white" : "text-[var(--dash-text-primary)]"
                                            )}>{message.content}</p>
                                        )}
                                        {message.isStreaming && (
                                            <span className="inline-block w-2 h-4 bg-[var(--brand)] animate-pulse ml-1" />
                                        )}
                                        
                                        {/* Action buttons for user messages */}
                                        {message.role === 'user' && !editingMessageId && (
                                            <button
                                                onClick={() => handleEditMessage(message)}
                                                className="absolute -left-2 -top-2 opacity-0 group-hover:opacity-100 p-1.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-sm hover:bg-[var(--surface-hover)] transition-all"
                                                title="Edit message"
                                            >
                                                <Pencil className="w-3.5 h-3.5 text-[var(--dash-text-tertiary)]" />
                                            </button>
                                        )}

                                        {/* Action buttons for assistant messages */}
                                        {message.role === 'assistant' && !message.isStreaming && (
                                            <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                                <button
                                                    onClick={() => handleRegenerate(message.id)}
                                                    className="p-1.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-sm hover:bg-[var(--surface-hover)] transition-all"
                                                    title="Regenerate response"
                                                    disabled={isLoading}
                                                >
                                                    <RefreshCw className={cn("w-3.5 h-3.5 text-[var(--dash-text-tertiary)]", isLoading && "animate-spin")} />
                                                </button>
                                                <button
                                                    onClick={() => handleCopyMessage(message.content, message.id)}
                                                    className="p-1.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-sm hover:bg-[var(--surface-hover)] transition-all"
                                                    title="Copy message"
                                                >
                                                    {copiedMessageId === message.id ? (
                                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 text-[var(--dash-text-tertiary)]" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {message.sources && message.sources.length > 0 && (() => {
                                        // Deduplicate sources by document_id
                                        const uniqueSources = message.sources.reduce((acc, source) => {
                                            if (!acc.find(s => s.document_id === source.document_id)) {
                                                acc.push(source);
                                            }
                                            return acc;
                                        }, [] as ChatSource[]);
                                        
                                        return (
                                            <div className="space-y-2 w-full">
                                                <p className="text-xs font-medium text-[var(--dash-text-tertiary)] px-2">
                                                    Sources ({uniqueSources.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {uniqueSources.map((source, idx) => (
                                                        <SourceCard key={`${source.document_id}-${idx}`} source={source} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-[10px] text-[var(--dash-text-tertiary)]">
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {message.model && message.role === 'assistant' && (
                                            <span className="text-[10px] text-[var(--dash-text-muted)] px-1.5 py-0.5 bg-[var(--surface-ground)] rounded">
                                                {AVAILABLE_MODELS.find(m => m.id === message.model)?.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] flex items-center justify-center flex-shrink-0">
                                        <User className="w-5 h-5 text-[var(--dash-text-primary)]" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {error && (
                            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="rounded-2xl px-4 py-3 bg-red-50 border border-red-200">
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => setError(null)} className="w-fit text-xs text-red-600">
                                        <RefreshCw className="w-3 h-3 mr-1" /> Dismiss
                                    </Button>
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
                        <div className="flex items-center justify-between mt-2 px-1">
                            <div className="flex items-center gap-2 text-[10px] text-[var(--dash-text-tertiary)]">
                                <Coins className="w-3 h-3 text-amber-500" />
                                <span>{currentModel.credits} credit per message</span>
                            </div>
                            <p className="text-[10px] text-[var(--dash-text-tertiary)]">
                                Press Enter to send, Shift+Enter for new line
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Conversation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--dash-text-primary)]">Delete Conversation</h3>
                                <p className="text-sm text-[var(--dash-text-tertiary)]">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--dash-text-secondary)] mb-6">
                            Are you sure you want to delete this conversation? All messages will be permanently removed.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 h-10 px-4 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-sm font-medium text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteConversation}
                                className="flex-1 h-10 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
        <a
            href={`/dashboard/knowledge/${source.document_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-3 hover:border-[var(--brand)] hover:shadow-md transition-all group cursor-pointer"
        >
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-[var(--brand-primary-muted)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <FileText className="w-4 h-4 text-[var(--brand)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[var(--dash-text-primary)] truncate group-hover:text-[var(--brand)] transition-colors">
                            {source.title}
                        </h4>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--dash-text-tertiary)] group-hover:text-[var(--brand)] transition-colors flex-shrink-0" />
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
        </a>
    );
}

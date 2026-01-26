"use client";

import { useState } from "react";
import {
    Hash,
    MessageCircle,
    Plus,
    MoreHorizontal,
    Smile,
    Send,
    AtSign,
    Image as ImageIcon,
    ChevronDown,
    ChevronRight,
    ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// Mock Data
const channels = [
    { id: 1, name: "general", unread: 0 },
    { id: 2, name: "announcements", unread: 2 },
    { id: 3, name: "engineering", unread: 0 },
    { id: 4, name: "design", unread: 5 },
    { id: 5, name: "random", unread: 0 },
    { id: 6, name: "marketing", unread: 0 },
    { id: 7, name: "sales", unread: 0 },
];

const directMessages = [
    { id: 1, name: "Sarah Chen", status: "online", unread: 1, avatarColor: "bg-emerald-500" },
    { id: 2, name: "John Smith", status: "offline", unread: 0, avatarColor: "bg-blue-500" },
    { id: 3, name: "Emily Davis", status: "away", unread: 0, avatarColor: "bg-purple-500" },
    { id: 4, name: "TyneBase Bot", status: "online", unread: 0, avatarColor: "bg-indigo-500", isBot: true },
    { id: 5, name: "Alex Morgan", status: "online", unread: 3, avatarColor: "bg-orange-500" },
];

const messages = [
    {
        id: 1,
        sender: "Sarah Chen",
        avatar: "SC",
        time: "10:30 AM",
        timestamp: "Yesterday",
        content: "Hey team, just deployed the new search feature to staging. Can everyone take a look?",
        reactions: [{ emoji: "🚀", count: 3 }, { emoji: "👀", count: 2 }],
        threadReplies: 0,
    },
    {
        id: 2,
        sender: "You",
        avatar: "ME",
        time: "10:32 AM",
        timestamp: "Yesterday",
        content: "Awesome! Checking it out now.",
        reactions: [],
        threadReplies: 0,
    },
    {
        id: 3,
        sender: "John Smith",
        avatar: "JS",
        time: "10:35 AM",
        timestamp: "Today",
        content: "I found a small styling issue on the results page. @Sarah Chen Posting a screenshot in #design.",
        reactions: [{ emoji: "👍", count: 1 }],
        threadReplies: 2,
    },
    {
        id: 4,
        sender: "Emily Davis",
        avatar: "ED",
        time: "10:40 AM",
        timestamp: "Today",
        content: "Great work @Sarah Chen! The performance improvements are noticeable.",
        reactions: [{ emoji: "🔥", count: 2 }],
        threadReplies: 0,
    },
    {
        id: 5,
        sender: "Sarah Chen",
        avatar: "SC",
        time: "10:42 AM",
        timestamp: "Today",
        content: "Thanks! @John Smith let me know if you need help fixing that style bug.",
        reactions: [],
        threadReplies: 0,
    },
];

// Helper to highlight mentions
const renderMessageContent = (content: string) => {
    // Regex to match @Name up to a logical break
    const parts = content.split(/(@[\w\s]+)/g);
    return parts.map((part, i) => {
        if (part.startsWith("@")) {
            // Simple heuristic: if it looks like a mention, style it
            // Real implementation would verify user existence
            return <span key={i} className="bg-[var(--brand-primary-muted)] text-[var(--brand)] px-1 rounded font-medium cursor-pointer hover:underline">{part}</span>;
        }
        return part;
    });
};

export default function ChatPage() {
    const [activeChannel, setActiveChannel] = useState("general");
    const [messageInput, setMessageInput] = useState("");
    const [channelsOpen, setChannelsOpen] = useState(true);
    const [dmsOpen, setDmsOpen] = useState(true);
    const [showMobileChat, setShowMobileChat] = useState(false);

    const handleChannelSelect = (channelName: string) => {
        setActiveChannel(channelName);
        setShowMobileChat(true);
    };

    return (
        // Flex column to ensure children fill the space
        <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 min-h-0 flex bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm">

                {/* Sidebar - Channels & DMs */}
                <div className={cn(
                    "w-full md:w-64 flex-shrink-0 bg-[var(--surface-ground)] border-r border-[var(--dash-border-subtle)] flex-col",
                    showMobileChat ? "hidden md:flex" : "flex"
                )}>
                    {/* Header */}
                    <div className="h-14 px-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex-shrink-0">
                        <h2 className="font-bold text-[var(--dash-text-primary)] truncate">TyneBase Team</h2>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <ChevronDown className="w-4 h-4 text-[var(--dash-text-primary)]" />
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar highlight-scrollbar py-4 space-y-6">
                        {/* Channels Section */}
                        <div className="px-2">
                            <div
                                className="flex items-center justify-between px-2 mb-1 group cursor-pointer text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-secondary)]"
                                onClick={() => setChannelsOpen(!channelsOpen)}
                            >
                                <div className="flex items-center gap-1">
                                    {channelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    <span className="text-xs font-semibold uppercase tracking-wider">Channels</span>
                                </div>
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--brand)]" />
                            </div>

                            {channelsOpen && (
                                <div className="space-y-0.5 mt-1">
                                    {channels.map(channel => (
                                        <button
                                            key={channel.id}
                                            onClick={() => handleChannelSelect(channel.name)}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${activeChannel === channel.name
                                                ? "bg-[var(--brand-primary-muted)] text-[var(--brand)] font-medium"
                                                : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:translate-x-1"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Hash className={`w-4 h-4 ${activeChannel === channel.name ? "opacity-100" : "opacity-60"}`} />
                                                <span className="truncate">{channel.name}</span>
                                            </div>
                                            {channel.unread > 0 && (
                                                <span className="bg-[var(--brand)] text-white text-[10px] font-bold px-1.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                                                    {channel.unread}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Direct Messages Section */}
                        <div className="px-2">
                            <div
                                className="flex items-center justify-between px-2 mb-1 group cursor-pointer text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-secondary)]"
                                onClick={() => setDmsOpen(!dmsOpen)}
                            >
                                <div className="flex items-center gap-1">
                                    {dmsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    <span className="text-xs font-semibold uppercase tracking-wider">Direct Messages</span>
                                </div>
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--brand)]" />
                            </div>

                            {dmsOpen && (
                                <div className="space-y-0.5 mt-1">
                                    {directMessages.map(dm => (
                                        <button
                                            key={dm.id}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-all duration-200 text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)] hover:translate-x-1`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="relative">
                                                    <div className={`w-4 h-4 rounded shadow-sm flex items-center justify-center text-[8px] font-bold text-white ${dm.avatarColor || "bg-gray-400"}`}>
                                                        {dm.name.split(" ").map(n => n[0]).join("")}
                                                    </div>
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--surface-ground)] ${dm.status === "online" ? "bg-green-500" : dm.status === "away" ? "bg-amber-500" : "bg-gray-400 opacity-0"
                                                        }`} />
                                                </div>
                                                <span className={`truncate ${dm.unread > 0 ? "font-semibold text-[var(--dash-text-primary)]" : "opacity-90"}`}>{dm.name}</span>
                                            </div>
                                            {dm.unread > 0 && (
                                                <span className="bg-[var(--brand)] text-white text-[10px] font-bold px-1.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                                                    {dm.unread}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className={cn(
                    "flex-1 flex-col min-w-0 bg-[var(--surface-card)] relative",
                    showMobileChat ? "flex" : "hidden md:flex"
                )}>
                    {/* Chat Header */}
                    <div className="h-14 px-4 sm:px-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between flex-shrink-0 z-10">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowMobileChat(false)}
                                className="md:hidden p-1 -ml-1 mr-1 hover:bg-[var(--surface-hover)] rounded-full text-[var(--dash-text-secondary)]"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <Hash className="w-5 h-5 text-[var(--dash-text-muted)]" />
                            <h3 className="font-bold text-[var(--dash-text-primary)]">{activeChannel}</h3>
                            <span className="text-sm text-[var(--dash-text-tertiary)] ml-2 hidden sm:inline border-l border-[var(--dash-border-subtle)] pl-3">Top secret project discussions</span>
                        </div>
                        <div className="flex items-center gap-3 text-[var(--dash-text-muted)]">
                            <div className="hidden sm:flex -space-x-2 mr-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-7 h-7 rounded-lg border-2 border-[var(--surface-card)] bg-[var(--surface-ground)] text-[10px] flex items-center justify-center font-bold">U{i}</div>
                                ))}
                                <div className="w-7 h-7 rounded-lg border-2 border-[var(--surface-card)] bg-[var(--surface-hover)] text-[10px] flex items-center justify-center font-bold">+5</div>
                            </div>
                        </div>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-2 custom-scrollbar">
                        {messages.map((msg, index) => {
                            const showHeader = index === 0 || messages[index - 1].sender !== msg.sender || messages[index - 1].timestamp !== msg.timestamp;
                            const showDateDivider = index === 0 || messages[index - 1].timestamp !== msg.timestamp;

                            return (
                                <div key={msg.id}>
                                    {/* Date Divider */}
                                    {showDateDivider && (
                                        <div className="relative py-4 flex items-center justify-center">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-[var(--dash-border-subtle)]" />
                                            </div>
                                            <div className="relative">
                                                <span className="bg-[var(--surface-card)] px-4 text-xs font-medium text-[var(--dash-text-tertiary)] border border-[var(--dash-border-subtle)] rounded-full py-0.5">
                                                    {msg.timestamp}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`flex gap-4 group px-2 py-1 -mx-2 rounded-lg hover:bg-[var(--surface-ground)]/50 transition-colors ${showHeader ? "mt-4" : "mt-0.5"}`}>
                                        <div className="w-10 flex-shrink-0 pt-1">
                                            {showHeader ? (
                                                <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary-muted)] text-[var(--brand)] flex items-center justify-center font-bold text-sm shadow-sm">
                                                    {msg.avatar}
                                                </div>
                                            ) : (
                                                <div className="w-10 opacity-0 text-[10px] text-right text-[var(--dash-text-muted)] group-hover:opacity-100 transition-opacity select-none pt-0.5">
                                                    {msg.time.split(" ")[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {showHeader && (
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="font-bold text-[var(--dash-text-primary)] cursor-pointer hover:underline">{msg.sender}</span>
                                                    <span className="text-xs text-[var(--dash-text-muted)] font-medium">{msg.time}</span>
                                                </div>
                                            )}
                                            <div className="text-[var(--dash-text-secondary)] leading-relaxed relative">
                                                {renderMessageContent(msg.content)}
                                            </div>

                                            {/* Reactions & Thread Info */}
                                            {(msg.reactions.length > 0 || msg.threadReplies > 0) && (
                                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                                    {msg.reactions.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {msg.reactions.map((reaction, i) => (
                                                                <button key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] text-xs hover:bg-[var(--surface-hover)] transition-colors">
                                                                    <span>{reaction.emoji}</span>
                                                                    <span className="text-[var(--dash-text-muted)] font-medium">{reaction.count}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {msg.threadReplies > 0 && (
                                                        <div className="flex items-center gap-2 cursor-pointer group/thread">
                                                            <div className="flex -space-x-1.5">
                                                                <div className="w-4 h-4 rounded bg-blue-100 border border-[var(--surface-card)]" />
                                                                <div className="w-4 h-4 rounded bg-green-100 border border-[var(--surface-card)]" />
                                                            </div>
                                                            <span className="text-xs font-bold text-[var(--brand)] group-hover/thread:underline">{msg.threadReplies} replies</span>
                                                            <span className="text-[10px] text-[var(--dash-text-tertiary)] group-hover/thread:text-[var(--dash-text-secondary)]">Last reply today at 10:45 AM</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Actions */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-sm p-1 flex items-center gap-0.5 absolute right-10 -mt-2 transform translate-y-1 group-hover:translate-y-0 z-20">
                                            <ActionBtn icon={Smile} />
                                            <ActionBtn icon={MessageCircle} />
                                            <ActionBtn icon={MoreHorizontal} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 flex-shrink-0">
                        <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)] transition-all shadow-sm">
                            {/* Toolbar */}
                            <div className="flex items-center gap-1 p-1.5 bg-[var(--surface-hover)]/30 border-b border-[var(--dash-border-subtle)]/50">
                                <ToolBtn><BoldIcon className="w-3.5 h-3.5" /></ToolBtn>
                                <ToolBtn><ItalicIcon className="w-3.5 h-3.5" /></ToolBtn>
                                <ToolBtn><StrikeIcon className="w-3.5 h-3.5" /></ToolBtn>
                                <div className="w-px h-3.5 bg-[var(--dash-border-subtle)] mx-1" />
                                <ToolBtn><ListIcon className="w-3.5 h-3.5" /></ToolBtn>
                            </div>

                            <textarea
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder={`Message #${activeChannel}`}
                                className="w-full max-h-40 min-h-[60px] p-3 bg-transparent border-none text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:ring-0 resize-none header-scroll text-sm leading-relaxed"
                            />

                            <div className="flex items-center justify-between p-2 pt-0">
                                <div className="flex items-center gap-1">
                                    <InputBtn><Plus className="w-4 h-4" /></InputBtn>
                                    <InputBtn><Smile className="w-4 h-4" /></InputBtn>
                                    <InputBtn><AtSign className="w-4 h-4" /></InputBtn>
                                    <InputBtn><ImageIcon className="w-4 h-4" /></InputBtn>
                                </div>

                                <Button
                                    size="sm"
                                    variant={messageInput.trim() ? "primary" : "ghost"}
                                    className={`transition-all ${messageInput.trim() ? "h-8 px-4" : "h-8 px-3 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)]"}`}
                                >
                                    <Send className={`w-4 h-4 ${messageInput.trim() ? "mr-1.5" : ""}`} />
                                    {messageInput.trim() && <span>Send</span>}
                                </Button>
                            </div>
                        </div>
                        <div className="text-[10px] text-[var(--dash-text-tertiary)] text-center mt-2 flex items-center justify-center gap-2">
                            <span><strong>Tip:</strong> Type / for commands</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Subcomponents for cleaner JSX
function ActionBtn({ icon: Icon }: { icon: React.ElementType<{ className?: string }> }) {
    return (
        <button className="p-1.5 hover:bg-[var(--surface-hover)] rounded text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] transition-colors">
            <Icon className="w-4 h-4" />
        </button>
    );
}

function ToolBtn({ children }: { children: React.ReactNode }) {
    return (
        <button className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors">
            {children}
        </button>
    );
}

function InputBtn({ children }: { children: React.ReactNode }) {
    return (
        <button className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--dash-text-muted)] hover:text-[var(--brand)] transition-colors">
            {children}
        </button>
    );
}

// Simple icons for toolbar (Visual representation)
function BoldIcon({ className }: { className?: string }) {
    return <span className={`font-bold ${className}`}>B</span>;
}
function ItalicIcon({ className }: { className?: string }) {
    return <span className={`italic ${className}`}>I</span>;
}
function StrikeIcon({ className }: { className?: string }) {
    return <span className={`line-through ${className}`}>S</span>;
}
function ListIcon({ className }: { className?: string }) {
    return <span className={`${className}`}>☰</span>;
}

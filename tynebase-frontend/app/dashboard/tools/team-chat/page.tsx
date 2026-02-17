"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  listChannels,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  markChannelAsRead,
  initializeChannels,
  listChatUsers,
  ChatChannel,
  ChatMessage,
  ChatUserInfo,
} from "@/lib/api/chat";
import {
  listDMConversations,
  startDMConversation,
  listDMMessages,
  sendDMMessage,
  editDMMessage,
  deleteDMMessage,
  addDMReaction,
  markDMAsRead,
  DMConversation,
  DMMessage,
} from "@/lib/api/dm";
import {
  Hash,
  Send,
  Smile,
  MoreHorizontal,
  MessageSquare,
  Edit2,
  Trash2,
  X,
  Users,
  Plus,
  Loader2,
  ChevronLeft,
  Reply,
  Mail,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

export default function TeamChatPage() {
  const { user } = useAuth();
  const supabase = createClient()!;

  // State - Channels
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamUsers, setTeamUsers] = useState<ChatUserInfo[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChatMessage[]>([]);
  const [threadInput, setThreadInput] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ type: 'channel' | 'dm'; messageId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State - Direct Messages
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [selectedDM, setSelectedDM] = useState<DMConversation | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmMessageInput, setDmMessageInput] = useState("");
  const [isLoadingDMs, setIsLoadingDMs] = useState(false);
  const [dmHasMore, setDmHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<"channels" | "dms">("channels");
  const [isStartingDM, setIsStartingDM] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Load channels and users on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Subscribe to realtime updates when channel is selected
  useEffect(() => {
    if (!selectedChannel) return;

    const channel = supabase
      .channel(`team-chat-${selectedChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          // Only add if not from current user (we already added it optimistically)
          if (newMessage.author_id !== user?.id) {
            // Fetch the full message with author info
            fetchNewMessage(newMessage.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMessage.id
                ? { ...m, content: updatedMessage.content, edited_at: updatedMessage.edited_at }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel?.id, user?.id]);

  const fetchNewMessage = async (messageId: string) => {
    try {
      // We need to fetch the message with author info
      // For now, we'll reload messages (could optimize later)
      if (selectedChannel) {
        const response = await listMessages(selectedChannel.id, { limit: 1 });
        if (response.messages.length > 0) {
          const newMsg = response.messages[0];
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch new message:", err);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [channelsRes, usersRes, dmsRes] = await Promise.all([
        listChannels(),
        listChatUsers(),
        listDMConversations(),
      ]);

      let channelList = channelsRes.channels;

      // If no channels exist, initialize default ones
      if (channelList.length === 0) {
        const initRes = await initializeChannels();
        channelList = initRes.channels;
      }

      setChannels(channelList);
      setTeamUsers(usersRes.users);
      setDmConversations(dmsRes.conversations);

      // Select first channel by default
      if (channelList.length > 0) {
        selectChannel(channelList[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load chat data");
    } finally {
      setIsLoading(false);
    }
  };

  // DM Functions
  const selectDM = async (conversation: DMConversation) => {
    setSelectedDM(conversation);
    setSelectedChannel(null);
    setThreadMessage(null);
    setThreadReplies([]);
    setShowMobileSidebar(false);
    setActiveTab("dms");
    await loadDMMessages(conversation.id);
    await markDMAsRead(conversation.id);

    // Update unread count locally
    setDmConversations((prev) =>
      prev.map((c) => (c.id === conversation.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const loadDMMessages = async (conversationId: string, before?: string) => {
    setIsLoadingDMs(true);
    try {
      const response = await listDMMessages(conversationId, { limit: 100, before });
      if (before) {
        setDmMessages((prev) => [...response.messages, ...prev]);
      } else {
        setDmMessages(response.messages);
      }
      setDmHasMore(response.has_more);
    } catch (err: any) {
      console.error("Failed to load DM messages:", err);
    } finally {
      setIsLoadingDMs(false);
    }
  };

  const handleSendDMMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmMessageInput.trim() || !selectedDM || isSending) return;

    const content = dmMessageInput.trim();
    setDmMessageInput("");
    setIsSending(true);

    try {
      const response = await sendDMMessage(selectedDM.id, { content });
      setDmMessages((prev) => [...prev, response.message]);
      scrollToBottom();
    } catch (err: any) {
      console.error("Failed to send DM:", err);
      setDmMessageInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartDM = async (targetUser: ChatUserInfo) => {
    if (targetUser.id === user?.id || isStartingDM) return;

    setIsStartingDM(true);
    try {
      const response = await startDMConversation({ user_id: targetUser.id });
      
      // Add to conversations if not already there
      setDmConversations((prev) => {
        const exists = prev.some((c) => c.id === response.conversation.id);
        if (exists) return prev;
        return [response.conversation, ...prev];
      });

      // Select the conversation
      await selectDM(response.conversation);
    } catch (err: any) {
      console.error("Failed to start DM:", err);
    } finally {
      setIsStartingDM(false);
    }
  };

  const handleEditDMMessage = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await editDMMessage(messageId, { content: editContent.trim() });
      setDmMessages((prev) =>
        prev.map((m) => (m.id === messageId ? response.message : m))
      );
      setEditingMessage(null);
      setEditContent("");
    } catch (err: any) {
      console.error("Failed to edit DM:", err);
    }
  };

  const handleDeleteDMMessage = async (messageId: string) => {
    setIsDeleting(true);
    try {
      await deleteDMMessage(messageId);
      setDmMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      console.error("Failed to delete DM:", err);
    } finally {
      setIsDeleting(false);
      setDeleteModal(null);
    }
  };

  const handleDMReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await addDMReaction(messageId, { emoji });
      
      setDmMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          
          if (response.removed) {
            return {
              ...m,
              reactions: m.reactions.filter(
                (r) => !(r.emoji === emoji && r.user_id === user?.id)
              ),
            };
          } else if (response.reaction) {
            return {
              ...m,
              reactions: [...m.reactions, response.reaction],
            };
          }
          return m;
        })
      );
      setShowEmojiPicker(null);
    } catch (err: any) {
      console.error("Failed to add DM reaction:", err);
    }
  };

  const selectChannel = async (channel: ChatChannel) => {
    setSelectedChannel(channel);
    setSelectedDM(null); // Clear DM selection
    setThreadMessage(null);
    setThreadReplies([]);
    setShowMobileSidebar(false);
    setActiveTab("channels");
    await loadMessages(channel.id);
    await markChannelAsRead(channel.id);

    // Update unread count locally
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const loadMessages = async (channelId: string, before?: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await listMessages(channelId, { limit: 100, before });
      if (before) {
        setMessages((prev) => [...response.messages, ...prev]);
      } else {
        setMessages(response.messages);
      }
      setHasMore(response.has_more);
    } catch (err: any) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChannel || isSending) return;

    const content = messageInput.trim();
    setMessageInput("");
    setIsSending(true);

    try {
      const response = await sendMessage(selectedChannel.id, { content });
      setMessages((prev) => [...prev, response.message]);
      scrollToBottom();
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setMessageInput(content); // Restore input on error
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await editMessage(messageId, { content: editContent.trim() });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? response.message : m))
      );
      setEditingMessage(null);
      setEditContent("");
    } catch (err: any) {
      console.error("Failed to edit message:", err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setIsDeleting(true);
    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      console.error("Failed to delete message:", err);
    } finally {
      setIsDeleting(false);
      setDeleteModal(null);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await addReaction(messageId, { emoji });
      
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          
          if (response.removed) {
            return {
              ...m,
              reactions: m.reactions.filter(
                (r) => !(r.emoji === emoji && r.user_id === user?.id)
              ),
            };
          } else if (response.reaction) {
            return {
              ...m,
              reactions: [...m.reactions, response.reaction],
            };
          }
          return m;
        })
      );
      setShowEmojiPicker(null);
    } catch (err: any) {
      console.error("Failed to add reaction:", err);
    }
  };

  const openThread = async (message: ChatMessage) => {
    setThreadMessage(message);
    try {
      const response = await listMessages(selectedChannel!.id, {
        parent_id: message.id,
      });
      setThreadReplies(response.messages);
    } catch (err: any) {
      console.error("Failed to load thread:", err);
    }
  };

  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim() || !selectedChannel || !threadMessage) return;

    const content = threadInput.trim();
    setThreadInput("");

    try {
      const response = await sendMessage(selectedChannel.id, {
        content,
        parent_id: threadMessage.id,
      });
      setThreadReplies((prev) => [...prev, response.message]);
      
      // Update reply count in main messages
      setMessages((prev) =>
        prev.map((m) =>
          m.id === threadMessage.id
            ? { ...m, reply_count: m.reply_count + 1 }
            : m
        )
      );
    } catch (err: any) {
      console.error("Failed to send reply:", err);
      setThreadInput(content);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    
    if (isToday) {
      return timeStr;
    }
    const dateStr2 = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${dateStr2}, ${timeStr}`;
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for bold, italic, and code
    return content
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-[var(--surface-ground)] px-1 py-0.5 rounded text-sm">$1</code>');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={loadInitialData}
          className="px-4 py-2 bg-[var(--brand)] text-white rounded-lg hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[var(--surface-ground)] overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setShowMobileSidebar(true)}
        className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-[var(--brand)] text-white rounded-full shadow-lg"
      >
        <Hash className="w-5 h-5" />
      </button>

      {/* Channels Sidebar */}
      <aside
        className={cn(
          "w-64 bg-[var(--surface-card)] border-r border-[var(--border-subtle)] flex flex-col",
          "fixed inset-y-0 left-0 z-40 lg:relative lg:translate-x-0 transition-transform",
          showMobileSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setShowMobileSidebar(false)}
          className="lg:hidden absolute top-4 right-4 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Chat</h2>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            <h3 className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Channels
            </h3>
            <div className="space-y-0.5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => selectChannel(channel)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                    selectedChannel?.id === channel.id
                      ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className={cn("flex-1 text-left truncate", channel.unread_count > 0 && "font-semibold")}>
                    {channel.name}
                  </span>
                  {channel.unread_count > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[var(--brand)] text-white">
                      {channel.unread_count > 99 ? "99+" : channel.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div className="mb-4">
            <h3 className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center justify-between">
              <span>Direct Messages</span>
              <Mail className="w-3.5 h-3.5" />
            </h3>
            <div className="space-y-0.5">
              {dmConversations.map((conv) => {
                const otherUser = conv.other_user;
                const displayName = otherUser?.full_name || otherUser?.email || "Unknown";
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectDM(conv)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                      selectedDM?.id === conv.id
                        ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-medium text-green-600">
                      {displayName[0]?.toUpperCase()}
                    </div>
                    <span className={cn("flex-1 text-left truncate", conv.unread_count > 0 && "font-semibold")}>
                      {displayName}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-500 text-white">
                        {conv.unread_count > 99 ? "99+" : conv.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
              {dmConversations.length === 0 && (
                <p className="px-2 py-2 text-xs text-[var(--text-muted)]">No conversations yet</p>
              )}
            </div>
          </div>

          {/* Team Members - Click to start DM */}
          <div>
            <h3 className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Team Members
            </h3>
            <div className="space-y-0.5">
              {teamUsers.filter(m => m.id !== user?.id).map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleStartDM(member)}
                  disabled={isStartingDM}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--brand)]/20 flex items-center justify-center text-xs font-medium text-[var(--brand)]">
                    {(member.full_name || member.email)?.[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 text-left truncate">{member.full_name || member.email}</span>
                  <Mail className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedDM ? (
          <>
            {/* DM Header */}
            <header className="h-14 px-4 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-medium text-green-600">
                {(selectedDM.other_user?.full_name || selectedDM.other_user?.email)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">
                  {selectedDM.other_user?.full_name || selectedDM.other_user?.email}
                </h1>
                <p className="text-xs text-[var(--text-tertiary)]">Direct Message</p>
              </div>
            </header>

            {/* DM Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {dmHasMore && (
                <button
                  onClick={() => loadDMMessages(selectedDM.id, dmMessages[0]?.created_at)}
                  disabled={isLoadingDMs}
                  className="w-full py-2 text-sm text-[var(--brand)] hover:underline disabled:opacity-50"
                >
                  {isLoadingDMs ? "Loading..." : "Load older messages"}
                </button>
              )}

              {dmMessages.length === 0 && !isLoadingDMs && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Mail className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-secondary)]">No messages yet</p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Start the conversation!
                  </p>
                </div>
              )}

              {dmMessages.map((message) => (
                <div
                  key={message.id}
                  className="group flex gap-3 hover:bg-[var(--surface-hover)] -mx-2 px-2 py-1 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-medium text-green-600 flex-shrink-0">
                    {(message.author?.full_name || message.author?.email)?.[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {message.author?.full_name || message.author?.email}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatMessageTime(message.created_at)}
                      </span>
                      {message.edited_at && (
                        <span className="text-xs text-[var(--text-tertiary)]">(edited)</span>
                      )}
                    </div>

                    {editingMessage?.id === message.id ? (
                      <div className="mt-1">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-sm resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEditDMMessage(message.id)}
                            className="px-3 py-1 text-sm bg-[var(--brand)] text-white rounded-lg hover:opacity-90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessage(null);
                              setEditContent("");
                            }}
                            className="px-3 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-[var(--text-primary)] text-sm break-words"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    )}

                    {/* DM Reactions */}
                    {message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(
                          message.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasUser: false };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.user?.full_name || "Unknown");
                            if (r.user_id === user?.id) acc[r.emoji].hasUser = true;
                            return acc;
                          }, {} as Record<string, { count: number; users: string[]; hasUser: boolean }>)
                        ).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => handleDMReaction(message.id, emoji)}
                            className={cn(
                              "px-2 py-0.5 text-sm rounded-full border transition-colors",
                              data.hasUser
                                ? "bg-green-500/10 border-green-500 text-green-600"
                                : "bg-[var(--surface-ground)] border-[var(--border-subtle)] hover:border-green-500"
                            )}
                            title={data.users.join(", ")}
                          >
                            {emoji} {data.count}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DM Message Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {showEmojiPicker === message.id && (
                        <div className="absolute right-0 top-8 z-10 flex gap-1 p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-lg">
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleDMReaction(message.id, emoji)}
                              className="p-1 hover:bg-[var(--surface-hover)] rounded text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.author?.id === user?.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessage(message as any);
                            setEditContent(message.content);
                          }}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: 'dm', messageId: message.id })}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--surface-ground)] rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* DM Message Input */}
            <form
              onSubmit={handleSendDMMessage}
              className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card)]"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={dmMessageInput}
                  onChange={(e) => setDmMessageInput(e.target.value)}
                  placeholder={`Message ${selectedDM.other_user?.full_name || selectedDM.other_user?.email}`}
                  className="flex-1 px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:border-green-500"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!dmMessageInput.trim() || isSending}
                  className="p-2.5 bg-green-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Supports **bold**, *italic*, and `code` formatting
              </p>
            </form>
          </>
        ) : selectedChannel ? (
          <>
            {/* Channel Header */}
            <header className="h-14 px-4 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <Hash className="w-5 h-5 text-[var(--text-tertiary)]" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">
                  {selectedChannel.name}
                </h1>
                {selectedChannel.description && (
                  <p className="text-xs text-[var(--text-tertiary)] truncate">
                    {selectedChannel.description}
                  </p>
                )}
              </div>
              <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg">
                <Users className="w-5 h-5" />
              </button>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {hasMore && (
                <button
                  onClick={() => loadMessages(selectedChannel.id, messages[0]?.created_at)}
                  disabled={isLoadingMessages}
                  className="w-full py-2 text-sm text-[var(--brand)] hover:underline disabled:opacity-50"
                >
                  {isLoadingMessages ? "Loading..." : "Load older messages"}
                </button>
              )}

              {messages.length === 0 && !isLoadingMessages && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-secondary)]">No messages yet</p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Be the first to say something!
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className="group flex gap-3 hover:bg-[var(--surface-hover)] -mx-2 px-2 py-1 rounded-lg"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[var(--brand)]/20 flex items-center justify-center text-sm font-medium text-[var(--brand)] flex-shrink-0">
                    {(message.author?.full_name || message.author?.email)?.[0]?.toUpperCase()}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {message.author?.full_name || message.author?.email}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatMessageTime(message.created_at)}
                      </span>
                      {message.edited_at && (
                        <span className="text-xs text-[var(--text-tertiary)]">(edited)</span>
                      )}
                    </div>

                    {editingMessage?.id === message.id ? (
                      <div className="mt-1">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-sm resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEditMessage(message.id)}
                            className="px-3 py-1 text-sm bg-[var(--brand)] text-white rounded-lg hover:opacity-90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessage(null);
                              setEditContent("");
                            }}
                            className="px-3 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-[var(--text-primary)] text-sm break-words"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    )}

                    {/* Reactions */}
                    {message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(
                          message.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasUser: false };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.user?.full_name || "Unknown");
                            if (r.user_id === user?.id) acc[r.emoji].hasUser = true;
                            return acc;
                          }, {} as Record<string, { count: number; users: string[]; hasUser: boolean }>)
                        ).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className={cn(
                              "px-2 py-0.5 text-sm rounded-full border transition-colors",
                              data.hasUser
                                ? "bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)]"
                                : "bg-[var(--surface-ground)] border-[var(--border-subtle)] hover:border-[var(--brand)]"
                            )}
                            title={data.users.join(", ")}
                          >
                            {emoji} {data.count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Thread indicator */}
                    {message.reply_count > 0 && (
                      <button
                        onClick={() => openThread(message)}
                        className="flex items-center gap-1 mt-2 text-sm text-[var(--brand)] hover:underline"
                      >
                        <Reply className="w-4 h-4" />
                        {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
                      </button>
                    )}
                  </div>

                  {/* Message Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {showEmojiPicker === message.id && (
                        <div className="absolute right-0 top-8 z-10 flex gap-1 p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-lg">
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message.id, emoji)}
                              className="p-1 hover:bg-[var(--surface-hover)] rounded text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openThread(message)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {message.author?.id === user?.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessage(message);
                            setEditContent(message.content);
                          }}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: 'channel', messageId: message.id })}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--surface-ground)] rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card)]"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`Message #${selectedChannel.name}`}
                  className="flex-1 px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:border-[var(--brand)]"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="p-2.5 bg-[var(--brand)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Supports **bold**, *italic*, and `code` formatting
              </p>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Hash className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </main>

      {/* Thread Sidebar */}
      {threadMessage && (
        <aside className="w-80 bg-[var(--surface-card)] border-l border-[var(--border-subtle)] flex flex-col">
          <header className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <h2 className="font-semibold text-[var(--text-primary)]">Thread</h2>
            <button
              onClick={() => {
                setThreadMessage(null);
                setThreadReplies([]);
              }}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Original Message */}
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--brand)]/20 flex items-center justify-center text-sm font-medium text-[var(--brand)]">
                {(threadMessage.author?.full_name || threadMessage.author?.email)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[var(--text-primary)] text-sm">
                    {threadMessage.author?.full_name || threadMessage.author?.email}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {formatMessageTime(threadMessage.created_at)}
                  </span>
                </div>
                <p
                  className="text-[var(--text-primary)] text-sm break-words"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(threadMessage.content) }}
                />
              </div>
            </div>
          </div>

          {/* Thread Replies */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {threadReplies.map((reply) => (
              <div key={reply.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--brand)]/20 flex items-center justify-center text-xs font-medium text-[var(--brand)]">
                  {(reply.author?.full_name || reply.author?.email)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[var(--text-primary)] text-sm">
                      {reply.author?.full_name || reply.author?.email}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {formatMessageTime(reply.created_at)}
                    </span>
                  </div>
                  <p
                    className="text-[var(--text-primary)] text-sm break-words"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.content) }}
                  />
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>

          {/* Thread Reply Input */}
          <form
            onSubmit={handleSendThreadReply}
            className="p-4 border-t border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                placeholder="Reply..."
                className="flex-1 px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:border-[var(--brand)]"
              />
              <button
                type="submit"
                disabled={!threadInput.trim()}
                className="p-2 bg-[var(--brand)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </aside>
      )}

      {/* Delete Message Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isDeleting && setDeleteModal(null)}
          />
          <div className="relative bg-[var(--surface-card)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-full">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Delete Message
              </h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteModal.type === 'dm') {
                    handleDeleteDMMessage(deleteModal.messageId);
                  } else {
                    handleDeleteMessage(deleteModal.messageId);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

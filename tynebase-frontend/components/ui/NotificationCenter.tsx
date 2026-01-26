"use client";

import { useState } from "react";
import { 
  Bell, 
  X, 
  CheckCheck,
  FileText, 
  MessageSquare, 
  Users, 
  AlertCircle,
  Sparkles,
  Settings,
  Clock,
  Trash2
} from "lucide-react";
import { Button } from "./Button";

interface Notification {
  id: string;
  type: "document" | "comment" | "mention" | "system" | "ai";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "comment",
    title: "New comment on your document",
    description: "Sarah Chen commented on 'Getting Started Guide'",
    timestamp: "5 min ago",
    read: false,
    actionUrl: "/dashboard/knowledge/1",
  },
  {
    id: "2",
    type: "mention",
    title: "You were mentioned",
    description: "John Smith mentioned you in 'API Documentation'",
    timestamp: "15 min ago",
    read: false,
    actionUrl: "/dashboard/knowledge/2",
  },
  {
    id: "3",
    type: "ai",
    title: "AI generation complete",
    description: "Your document 'Q4 Strategy' has been generated",
    timestamp: "1 hour ago",
    read: false,
    actionUrl: "/dashboard/ai-assistant",
  },
  {
    id: "4",
    type: "document",
    title: "Document published",
    description: "'Security Best Practices' is now live",
    timestamp: "2 hours ago",
    read: true,
    actionUrl: "/dashboard/knowledge/3",
  },
  {
    id: "5",
    type: "system",
    title: "Welcome to TyneBase!",
    description: "Complete your profile to get started",
    timestamp: "1 day ago",
    read: true,
    actionUrl: "/dashboard/settings",
  },
];

const typeIcons = {
  document: FileText,
  comment: MessageSquare,
  mention: Users,
  system: AlertCircle,
  ai: Sparkles,
};

const typeColors = {
  document: "text-blue-500 bg-blue-500/10",
  comment: "text-green-500 bg-green-500/10",
  mention: "text-purple-500 bg-purple-500/10",
  system: "text-amber-500 bg-amber-500/10",
  ai: "text-pink-500 bg-pink-500/10",
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = filter === "unread" 
    ? notifications.filter((n) => !n.read)
    : notifications;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-16 right-6 z-50 w-96 bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[var(--text-primary)]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              title="Mark all as read"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "unread"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)]"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--text-tertiary)] opacity-50" />
              <p className="text-[var(--text-secondary)]">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredNotifications.map((notification) => {
                const Icon = typeIcons[notification.type];
                const colorClass = typeColors[notification.type];

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-[var(--surface-ground)] transition-colors cursor-pointer group ${
                      !notification.read ? "bg-[var(--brand-primary)]/5" : ""
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${
                            !notification.read 
                              ? "text-[var(--text-primary)]" 
                              : "text-[var(--text-secondary)]"
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-tertiary)] truncate">
                          {notification.description}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {notification.timestamp}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--surface-card)] rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3 text-[var(--text-tertiary)]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
            <Button variant="ghost" size="sm">
              View all notifications
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

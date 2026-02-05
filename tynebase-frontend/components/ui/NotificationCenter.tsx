"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Trash2,
  Loader2
} from "lucide-react";
import { Button } from "./Button";
import { 
  listNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification,
  clearAllNotifications,
  type Notification 
} from "@/lib/api/notifications";

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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications when opened
  const fetchNotifications = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await listNotifications({ 
        limit: 50, 
        unread_only: filter === "unread" 
      });
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (err) {
      setError("Failed to load notifications");
      console.error("Error fetching notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = notifications;

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id, true);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      onClose();
      router.push(notification.action_url);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    try {
      await markNotificationAsRead(id, true);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      setError("Failed to mark all as read");
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    try {
      await deleteNotification(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Error clearing all notifications:", err);
      setError("Failed to clear notifications");
    }
  };

  const handleViewAll = () => {
    onClose();
    router.push("/dashboard/notifications");
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
              onClick={handleMarkAllAsRead}
              title="Mark all as read"
              disabled={unreadCount === 0 || isLoading}
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              title="Settings"
              onClick={handleViewAll}
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

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border-b border-[var(--border-subtle)]">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-[var(--text-tertiary)] animate-spin" />
              <p className="text-[var(--text-secondary)]">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
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
                    onClick={() => handleNotificationClick(notification)}
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
                            {formatTimestamp(notification.created_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {!notification.read && (
                              <button
                                onClick={(e) => handleMarkAsRead(e, notification.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--surface-card)] rounded transition-all"
                                title="Mark as read"
                              >
                                <CheckCheck className="w-3 h-3 text-[var(--text-tertiary)]" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDeleteNotification(e, notification.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--surface-card)] rounded transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3 text-[var(--text-tertiary)]" />
                            </button>
                          </div>
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
            <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={isLoading}>
              Clear all
            </Button>
            <Button variant="ghost" size="sm" onClick={handleViewAll}>
              View all notifications
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

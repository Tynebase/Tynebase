"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, FileText, MessageSquare, Users, AlertCircle, Sparkles, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  listNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  type Notification 
} from "@/lib/api/notifications";
import { Button } from "@/components/ui/Button";

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

const typeLabels = {
  document: "Document",
  comment: "Comment",
  mention: "Mention",
  system: "System",
  ai: "AI",
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

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await listNotifications({ 
        limit: 100, 
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
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
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

    if (notification.action_url) {
      router.push(notification.action_url);
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--dash-text-primary)]">Notifications</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-2">Stay updated with your workspace activity</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || isLoading}
          className="flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Mark all as read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            filter === "all"
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          All Notifications
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            filter === "unread"
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-[var(--dash-text-tertiary)] animate-spin" />
            <p className="text-[var(--dash-text-secondary)]">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-[var(--dash-text-tertiary)] opacity-50" />
            <h3 className="text-lg font-medium text-[var(--dash-text-primary)] mb-2">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </h3>
            <p className="text-[var(--dash-text-secondary)]">
              {filter === "unread" 
                ? "You're all caught up!" 
                : "You'll see notifications here when there's activity in your workspace."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              const colorClass = typeColors[notification.type];

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-6 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex gap-4 items-start group",
                    notification.read ? "" : "bg-[var(--brand-primary-muted)]/30"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    colorClass
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className={cn(
                          "text-base font-semibold",
                          notification.read ? "text-[var(--dash-text-secondary)]" : "text-[var(--dash-text-primary)]"
                        )}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)] px-2 py-0.5 rounded mt-1 inline-block">
                          {typeLabels[notification.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--dash-text-tertiary)] whitespace-nowrap">
                          {formatTimestamp(notification.created_at)}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--dash-text-secondary)] mt-2">
                      {notification.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      {notification.action_url && (
                        <span className="text-xs text-[var(--brand)] hover:underline">
                          Click to view →
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--surface-card)] rounded transition-all ml-auto"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

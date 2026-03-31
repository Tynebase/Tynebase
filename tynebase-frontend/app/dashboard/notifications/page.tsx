"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  FileText,
  MessageSquare,
  Users,
  AlertCircle,
  Sparkles,
  Loader2,
  Trash2,
  CreditCard,
  ListTodo,
  MessageCircle,
  Coins,
  Receipt,
  Mail,
  Clock,
  Settings,
  Filter,
  ArrowUpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";
import type { Notification, NotificationType, NotificationPriority } from "@/lib/api/notifications";
import { Button } from "@/components/ui/Button";

const typeIcons: Record<NotificationType, typeof Bell> = {
  document: FileText,
  comment: MessageSquare,
  mention: Users,
  system: AlertCircle,
  ai: Sparkles,
  billing: CreditCard,
  task: ListTodo,
  chat: MessageCircle,
  credits: Coins,
  invoice: Receipt,
  invitation: Mail,
};

const typeColors: Record<NotificationType, string> = {
  document: "text-blue-500 bg-blue-500/10",
  comment: "text-green-500 bg-green-500/10",
  mention: "text-purple-500 bg-purple-500/10",
  system: "text-amber-500 bg-amber-500/10",
  ai: "text-pink-500 bg-pink-500/10",
  billing: "text-orange-500 bg-orange-500/10",
  task: "text-indigo-500 bg-indigo-500/10",
  chat: "text-teal-500 bg-teal-500/10",
  credits: "text-yellow-500 bg-yellow-500/10",
  invoice: "text-red-500 bg-red-500/10",
  invitation: "text-cyan-500 bg-cyan-500/10",
};

const typeLabels: Record<NotificationType, string> = {
  document: "Document",
  comment: "Comment",
  mention: "Mention",
  system: "System",
  ai: "AI",
  billing: "Billing",
  task: "Task",
  chat: "Chat",
  credits: "Credits",
  invoice: "Invoice",
  invitation: "Invitation",
};

const priorityConfig: Record<NotificationPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "text-[var(--dash-text-tertiary)] bg-[var(--surface-ground)]" },
  normal: { label: "", className: "" },
  high: { label: "High", className: "text-orange-600 bg-orange-500/10" },
  urgent: { label: "Urgent", className: "text-red-600 bg-red-500/10" },
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
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

type ReadFilter = "all" | "unread";
type TypeFilter = "all" | NotificationType;

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
  } = useNotifications();

  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    let result = notifications;
    if (readFilter === "unread") {
      result = result.filter((n) => !n.read);
    }
    if (typeFilter !== "all") {
      result = result.filter((n) => n.type === typeFilter);
    }
    return result;
  }, [notifications, readFilter, typeFilter]);

  // Compute which type filters have items
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NotificationType, number>> = {};
    for (const n of notifications) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, [notifications]);

  const activeTypes = Object.keys(typeCounts) as NotificationType[];

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await remove(id);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--dash-text-primary)]">Notifications</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">Stay updated with your workspace activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings/notifications">
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Preferences</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || isLoading}
            className="flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Mark all read</span>
          </Button>
          <Button
            variant="outline"
            onClick={clearAll}
            disabled={notifications.length === 0 || isLoading}
            className="flex items-center gap-2 text-[var(--status-error)]"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear all</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Read / Unread filter */}
        <div className="flex items-center gap-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-1">
          <button
            onClick={() => setReadFilter("all")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              readFilter === "all"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            All
          </button>
          <button
            onClick={() => setReadFilter("unread")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              readFilter === "unread"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Type filter chips */}
        {activeTypes.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-4 h-4 text-[var(--dash-text-tertiary)] mr-1" />
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-colors border",
                typeFilter === "all"
                  ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                  : "text-[var(--dash-text-secondary)] border-[var(--dash-border-subtle)] hover:bg-[var(--surface-hover)]"
              )}
            >
              All types
            </button>
            {activeTypes.map((type) => {
              const Icon = typeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors border",
                    typeFilter === type
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "text-[var(--dash-text-secondary)] border-[var(--dash-border-subtle)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {typeLabels[type]} ({typeCounts[type]})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-[var(--dash-text-tertiary)] animate-spin" />
            <p className="text-[var(--dash-text-secondary)]">Loading notifications…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-[var(--dash-text-tertiary)] opacity-50" />
            <h3 className="text-lg font-medium text-[var(--dash-text-primary)] mb-2">
              {readFilter === "unread" ? "No unread notifications" : "No notifications yet"}
            </h3>
            <p className="text-[var(--dash-text-secondary)]">
              {readFilter === "unread"
                ? "You're all caught up!"
                : "You'll see notifications here when there's activity in your workspace."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {filtered.map((notification) => {
              const Icon = typeIcons[notification.type] || Bell;
              const colorClass = typeColors[notification.type] || "text-gray-500 bg-gray-500/10";
              const priority = priorityConfig[notification.priority] || priorityConfig.normal;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex gap-4 items-start group",
                    !notification.read && "bg-[var(--brand)]/5"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={cn(
                              "text-base font-semibold",
                              notification.read ? "text-[var(--dash-text-secondary)]" : "text-[var(--dash-text-primary)]"
                            )}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && <span className="w-2 h-2 rounded-full bg-[var(--brand)] flex-shrink-0" />}
                          {priority.label && (
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1", priority.className)}>
                              <ArrowUpCircle className="w-3 h-3" />
                              {priority.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", colorClass)}>
                            {typeLabels[notification.type]}
                          </span>
                          <span className="text-xs text-[var(--dash-text-tertiary)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(notification.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--surface-card)] rounded transition-all flex-shrink-0"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      </button>
                    </div>
                    {notification.description && (
                      <p className="text-sm text-[var(--dash-text-secondary)] mt-2">{notification.description}</p>
                    )}
                    {notification.action_url && (
                      <span className="text-xs text-[var(--brand)] mt-2 inline-block hover:underline">Click to view →</span>
                    )}
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

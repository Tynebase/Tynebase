"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  type Notification,
} from "@/lib/api/notifications";

// ============================================================================
// TYPES
// ============================================================================

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

interface NotificationContextType extends NotificationState {
  /** Refresh notifications from the server */
  refresh: () => Promise<void>;
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a single notification */
  remove: (id: string) => Promise<void>;
  /** Clear all notifications */
  clearAll: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // ------------------------------------------------------------------
  // Play notification sound (ding)
  // ------------------------------------------------------------------
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a pleasant "ding" sound
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {
      console.error('[NotificationContext] Failed to play notification sound:', err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Fetch notifications from API
  // ------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await listNotifications({ limit: 50 });

      if (isMountedRef.current && response && response.notifications) {
        setState({
          notifications: response.notifications,
          unreadCount: response.unreadCount || 0,
          isLoading: false,
          error: null,
        });
      } else if (isMountedRef.current) {
        // Handle case where response is undefined or doesn't have expected structure
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Invalid response format from server",
        }));
      }
    } catch (err) {
      console.error("[NotificationContext] Failed to fetch notifications:", err);
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to fetch notifications",
        }));
      }
    }
  }, [user]);

  // ------------------------------------------------------------------
  // Mark single notification as read
  // ------------------------------------------------------------------
  const markAsRead = useCallback(async (id: string) => {
    try {
      await markNotificationAsRead(id, true);
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err) {
      console.error("[NotificationContext] Failed to mark as read:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Mark all notifications as read
  // ------------------------------------------------------------------
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error("[NotificationContext] Failed to mark all as read:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Delete a single notification
  // ------------------------------------------------------------------
  const remove = useCallback(async (id: string) => {
    try {
      const target = state.notifications.find(n => n.id === id);
      await deleteNotification(id);
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id),
        unreadCount: target && !target.read
          ? Math.max(0, prev.unreadCount - 1)
          : prev.unreadCount,
      }));
    } catch (err) {
      console.error("[NotificationContext] Failed to delete notification:", err);
    }
  }, [state.notifications]);

  // ------------------------------------------------------------------
  // Clear all notifications
  // ------------------------------------------------------------------
  const clearAll = useCallback(async () => {
    try {
      await clearAllNotifications();
      setState(prev => ({
        ...prev,
        notifications: [],
        unreadCount: 0,
      }));
    } catch (err) {
      console.error("[NotificationContext] Failed to clear all:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Initial fetch
  // ------------------------------------------------------------------
  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setState({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
      });
    }
  }, [user, refresh]);

  // ------------------------------------------------------------------
  // Real-time Supabase subscription
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    if (!supabase) return;

    // Subscribe to INSERT events on the notifications table for this user
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          const newNotification = payload.new as Notification;
          setState(prev => ({
            ...prev,
            notifications: [newNotification, ...prev.notifications].slice(0, 50),
            unreadCount: prev.unreadCount + 1,
          }));
          
          // Play notification sound
          playNotificationSound();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          const updated = payload.new as Notification;
          setState(prev => {
            const oldNotif = prev.notifications.find(n => n.id === updated.id);
            const readDelta =
              oldNotif && !oldNotif.read && updated.read ? -1 :
              oldNotif && oldNotif.read && !updated.read ? 1 : 0;

            return {
              ...prev,
              notifications: prev.notifications.map(n =>
                n.id === updated.id ? updated : n
              ),
              unreadCount: Math.max(0, prev.unreadCount + readDelta),
            };
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          const deleted = payload.old as { id: string; read?: boolean };
          setState(prev => ({
            ...prev,
            notifications: prev.notifications.filter(n => n.id !== deleted.id),
            unreadCount: deleted.read === false
              ? Math.max(0, prev.unreadCount - 1)
              : prev.unreadCount,
          }));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  // ------------------------------------------------------------------
  // Cleanup on unmount
  // ------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ------------------------------------------------------------------
  // Periodic background refresh (every 60s as fallback)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refresh();
    }, 60_000);

    return () => clearInterval(interval);
  }, [user, refresh]);

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        refresh,
        markAsRead,
        markAllAsRead,
        remove,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

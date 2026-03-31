/**
 * Notifications API Service Layer
 * 
 * Provides functions for interacting with the backend /api/notifications endpoints.
 * Handles notification CRUD operations, marking as read, and clearing notifications.
 */

import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NotificationType = 'document' | 'comment' | 'mention' | 'system' | 'ai' | 'billing' | 'task' | 'chat' | 'credits' | 'invoice' | 'invitation';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationCategory = 'general' | 'workspace' | 'billing' | 'security';

export interface Notification {
  id: string;
  user_id: string;
  tenant_id: string | null;
  type: NotificationType;
  title: string;
  description: string | null;
  action_url: string | null;
  read: boolean;
  priority: NotificationPriority;
  category: NotificationCategory;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread_only?: boolean;
}

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all notifications for the authenticated user
 * 
 * @param params - Query parameters for pagination and filtering
 * @returns List of notifications with pagination metadata and unread count
 */
export async function listNotifications(
  params?: NotificationListParams
): Promise<NotificationListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }

  if (params?.unread_only !== undefined) {
    queryParams.append('unread_only', params.unread_only.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/notifications?${queryString}` : '/api/notifications';
  
  const response = await apiGet<{
    success: true;
    data: NotificationListResponse;
  }>(endpoint);

  return response.data;
}

/**
 * Mark a notification as read or unread
 * 
 * @param id - Notification UUID
 * @param read - Read status (true for read, false for unread)
 * @returns Updated notification
 */
export async function markNotificationAsRead(
  id: string,
  read: boolean = true
): Promise<Notification> {
  const response = await apiPatch<{
    success: true;
    data: Notification;
  }>(`/api/notifications/${id}`, { read });

  return response.data;
}

/**
 * Mark all notifications as read for the authenticated user
 * 
 * @returns Success confirmation
 */
export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const response = await apiPost<{
    message: string;
  }>('/api/notifications/mark-all-read', {});

  return response;
}

/**
 * Delete a single notification
 * 
 * @param id - Notification UUID
 * @returns Deletion confirmation
 */
export async function deleteNotification(id: string): Promise<{ message: string }> {
  const response = await apiDelete<{
    message: string;
  }>(`/api/notifications/${id}`);

  return response;
}

/**
 * Clear all notifications for the authenticated user
 * 
 * @returns Deletion confirmation
 */
export async function clearAllNotifications(): Promise<{ message: string }> {
  const response = await apiDelete<{
    message: string;
  }>('/api/notifications');

  return response;
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  document_enabled: boolean;
  comment_enabled: boolean;
  mention_enabled: boolean;
  system_enabled: boolean;
  ai_enabled: boolean;
  billing_enabled: boolean;
  task_enabled: boolean;
  chat_enabled: boolean;
  credits_enabled: boolean;
  invoice_enabled: boolean;
  invitation_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

/**
 * Get notification preferences for the authenticated user
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiGet<{
    success: true;
    data: NotificationPreferences;
  }>('/api/notifications/preferences');

  return response.data;
}

/**
 * Update notification preferences for the authenticated user
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response = await apiPut<{
    success: true;
    data: NotificationPreferences;
  }>('/api/notifications/preferences', prefs);

  return response.data;
}

// ============================================================================
// CREATE NOTIFICATION (admin use)
// ============================================================================

export interface CreateNotificationParams {
  user_id?: string;
  type: NotificationType;
  title: string;
  description?: string;
  action_url?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new notification
 */
export async function createNewNotification(
  params: CreateNotificationParams
): Promise<{ id: string }> {
  const response = await apiPost<{
    success: true;
    data: { id: string };
  }>('/api/notifications', params);

  return response.data;
}

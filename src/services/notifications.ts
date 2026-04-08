/**
 * Notification Service
 * 
 * Centralized service for creating and managing notifications.
 * Called from various backend routes when events occur that should notify users.
 */

import { supabaseAdmin } from '../lib/supabase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NotificationType = 
  | 'document' 
  | 'comment' 
  | 'mention' 
  | 'system' 
  | 'ai' 
  | 'billing' 
  | 'task' 
  | 'chat' 
  | 'credits' 
  | 'invoice' 
  | 'invitation';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationCategory = 'general' | 'workspace' | 'billing' | 'security';

export interface CreateNotificationParams {
  userId: string;
  tenantId?: string;
  type: NotificationType;
  title: string;
  description?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  metadata?: Record<string, unknown>;
}

export interface CreateBatchNotificationParams {
  userIds: string[];
  tenantId?: string;
  type: NotificationType;
  title: string;
  description?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Create a single notification for a user.
 * Checks user preferences before creating.
 */
export async function createNotification(params: CreateNotificationParams): Promise<{ id: string } | null> {
  try {
    // Check if user has disabled this notification type
    const isEnabled = await isNotificationTypeEnabled(params.userId, params.type);
    if (!isEnabled) {
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        tenant_id: params.tenantId || null,
        type: params.type,
        title: params.title,
        description: params.description || null,
        action_url: params.actionUrl || null,
        priority: params.priority || 'normal',
        category: params.category || 'general',
        metadata: params.metadata || {},
        read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[NotificationService] Failed to create notification:', error.message, {
        userId: params.userId,
        type: params.type,
      });
      return null;
    }

    return { id: data.id };
  } catch (err) {
    console.error('[NotificationService] Unexpected error creating notification:', err);
    return null;
  }
}

/**
 * Create notifications for multiple users at once (e.g., team-wide announcements).
 * Respects individual user preferences.
 */
export async function createBatchNotifications(params: CreateBatchNotificationParams): Promise<number> {
  try {
    if (!params.userIds.length) return 0;

    // Fetch preferences for all target users in one query
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id, ' + getPreferenceColumn(params.type))
      .in('user_id', params.userIds);

    // Build a set of users who have disabled this type
    const disabledUsers = new Set<string>();
    if (prefs) {
      for (const pref of prefs) {
        const col = getPreferenceColumn(params.type);
        if ((pref as any)[col] === false) {
          disabledUsers.add((pref as any).user_id);
        }
      }
    }

    // Filter out users who disabled this notification type
    const enabledUserIds = params.userIds.filter(id => !disabledUsers.has(id));
    if (!enabledUserIds.length) return 0;

    const rows = enabledUserIds.map(userId => ({
      user_id: userId,
      tenant_id: params.tenantId || null,
      type: params.type,
      title: params.title,
      description: params.description || null,
      action_url: params.actionUrl || null,
      priority: params.priority || 'normal',
      category: params.category || 'general',
      metadata: params.metadata || {},
      read: false,
    }));

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(rows);

    if (error) {
      console.error('[NotificationService] Failed to create batch notifications:', error.message);
      return 0;
    }

    return enabledUserIds.length;
  } catch (err) {
    console.error('[NotificationService] Unexpected error in batch create:', err);
    return 0;
  }
}

/**
 * Get the unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('[NotificationService] Failed to get unread count:', error.message);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// PREFERENCE HELPERS
// ============================================================================

/**
 * Map notification type to its preference column name.
 */
function getPreferenceColumn(type: NotificationType): string {
  return `${type}_enabled`;
}

/**
 * Check if a user has a specific notification type enabled.
 * Returns true by default (all enabled if no preferences row exists).
 */
async function isNotificationTypeEnabled(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const col = getPreferenceColumn(type);
    
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select(`in_app_enabled, ${col}`)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      // No preferences row = all enabled by default
      return true;
    }

    // Both in_app and the specific type must be enabled
    return (data as any).in_app_enabled !== false && (data as any)[col] !== false;
  } catch {
    return true; // Default to enabled on error
  }
}

// ============================================================================
// CONVENIENCE NOTIFICATION CREATORS
// ============================================================================

/** Notify when a document is shared with or assigned to a user */
export async function notifyDocumentShared(params: {
  userId: string;
  tenantId?: string;
  documentTitle: string;
  sharedBy: string;
  documentId: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'document',
    title: `Document shared with you`,
    description: `"${params.documentTitle}" was shared by ${params.sharedBy}`,
    actionUrl: `/dashboard/knowledge/${params.documentId}`,
    category: 'workspace',
    metadata: { document_id: params.documentId, shared_by: params.sharedBy },
  });
}

/** Notify when someone comments on a user's document or discussion */
export async function notifyNewComment(params: {
  userId: string;
  tenantId?: string;
  commenterName: string;
  targetTitle: string;
  targetUrl: string;
  commentId?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'comment',
    title: `New comment from ${params.commenterName}`,
    description: `Commented on "${params.targetTitle}"`,
    actionUrl: params.targetUrl,
    category: 'workspace',
    metadata: { commenter: params.commenterName, comment_id: params.commentId },
  });
}

/** Notify when a user is mentioned */
export async function notifyMention(params: {
  userId: string;
  tenantId?: string;
  mentionedBy: string;
  context: string;
  targetUrl: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'mention',
    title: `${params.mentionedBy} mentioned you`,
    description: params.context,
    actionUrl: params.targetUrl,
    category: 'workspace',
    priority: 'high',
    metadata: { mentioned_by: params.mentionedBy },
  });
}

/** Notify about AI generation completion */
export async function notifyAiComplete(params: {
  userId: string;
  tenantId?: string;
  taskDescription: string;
  documentId?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'ai',
    title: 'AI generation complete',
    description: params.taskDescription,
    actionUrl: params.documentId ? `/dashboard/knowledge/${params.documentId}` : undefined,
    category: 'workspace',
    metadata: { document_id: params.documentId },
  });
}

/** Notify about credit usage warnings */
export async function notifyCreditsLow(params: {
  userId: string;
  tenantId?: string;
  creditsRemaining: number;
  creditsTotal: number;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'credits',
    title: 'AI credits running low',
    description: `You have ${params.creditsRemaining} of ${params.creditsTotal} credits remaining`,
    actionUrl: '/dashboard/settings/billing',
    priority: params.creditsRemaining <= 1 ? 'urgent' : 'high',
    category: 'billing',
    metadata: { credits_remaining: params.creditsRemaining, credits_total: params.creditsTotal },
  });
}

/** Notify about credits being exhausted */
export async function notifyCreditsExhausted(params: {
  userId: string;
  tenantId?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'credits',
    title: 'AI credits exhausted',
    description: 'You have used all your AI credits. Upgrade your plan to continue using AI features.',
    actionUrl: '/dashboard/settings/billing',
    priority: 'urgent',
    category: 'billing',
    metadata: {},
  });
}

/** Notify about billing events (subscription changes, payment issues) */
export async function notifyBillingEvent(params: {
  userId: string;
  tenantId?: string;
  title: string;
  description: string;
  priority?: NotificationPriority;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'billing',
    title: params.title,
    description: params.description,
    actionUrl: '/dashboard/settings/billing',
    priority: params.priority || 'high',
    category: 'billing',
    metadata: {},
  });
}

/** Notify about upcoming or processed invoices */
export async function notifyInvoice(params: {
  userId: string;
  tenantId?: string;
  title: string;
  description: string;
  invoiceUrl?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'invoice',
    title: params.title,
    description: params.description,
    actionUrl: params.invoiceUrl || '/dashboard/settings/billing',
    category: 'billing',
    metadata: { invoice_url: params.invoiceUrl },
  });
}

/** Notify about new chat messages */
export async function notifyChatMessage(params: {
  userId: string;
  tenantId?: string;
  senderName: string;
  channelName?: string;
  messagePreview: string;
  channelId?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'chat',
    title: params.channelName
      ? `New message in #${params.channelName}`
      : `New message from ${params.senderName}`,
    description: params.messagePreview.length > 100
      ? params.messagePreview.substring(0, 100) + '...'
      : params.messagePreview,
    actionUrl: params.channelId ? `/dashboard/chat?channel=${params.channelId}` : '/dashboard/chat',
    category: 'workspace',
    metadata: { sender: params.senderName, channel_id: params.channelId },
  });
}

/** Notify about direct messages */
export async function notifyDirectMessage(params: {
  userId: string;
  tenantId?: string;
  senderName: string;
  messagePreview: string;
  conversationId?: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'chat',
    title: `Direct message from ${params.senderName}`,
    description: params.messagePreview.length > 100
      ? params.messagePreview.substring(0, 100) + '...'
      : params.messagePreview,
    actionUrl: params.conversationId
      ? `/dashboard/chat/dm/${params.conversationId}`
      : '/dashboard/chat',
    priority: 'high',
    category: 'workspace',
    metadata: { sender: params.senderName, conversation_id: params.conversationId },
  });
}

/** Notify about task/document assignments */
export async function notifyTaskAssigned(params: {
  userId: string;
  tenantId?: string;
  assignedBy: string;
  taskTitle: string;
  taskUrl: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'task',
    title: 'New task assigned to you',
    description: `"${params.taskTitle}" assigned by ${params.assignedBy}`,
    actionUrl: params.taskUrl,
    priority: 'high',
    category: 'workspace',
    metadata: { assigned_by: params.assignedBy },
  });
}

/** Notify about workspace invitations */
export async function notifyInvitation(params: {
  userId: string;
  tenantId?: string;
  inviterName: string;
  workspaceName: string;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'invitation',
    title: `You've been invited to ${params.workspaceName}`,
    description: `${params.inviterName} invited you to join their workspace`,
    actionUrl: '/dashboard',
    priority: 'high',
    category: 'workspace',
    metadata: { inviter: params.inviterName, workspace: params.workspaceName },
  });
}

/** Notify about system events (maintenance, updates, security) */
export async function notifySystemEvent(params: {
  userId: string;
  tenantId?: string;
  title: string;
  description: string;
  actionUrl?: string;
  priority?: NotificationPriority;
}) {
  return createNotification({
    userId: params.userId,
    tenantId: params.tenantId,
    type: 'system',
    title: params.title,
    description: params.description,
    actionUrl: params.actionUrl,
    priority: params.priority || 'normal',
    category: 'security',
    metadata: {},
  });
}

/**
 * Notify all users in a tenant about something (e.g., system announcements).
 */
export async function notifyAllTenantUsers(params: {
  tenantId: string;
  type: NotificationType;
  title: string;
  description?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  excludeUserId?: string;
}) {
  try {
    let query = supabaseAdmin
      .from('users')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('status', 'active');

    if (params.excludeUserId) {
      query = query.neq('id', params.excludeUserId);
    }

    const { data: users, error } = await query;

    if (error || !users?.length) return 0;

    return createBatchNotifications({
      userIds: users.map(u => u.id),
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      description: params.description,
      actionUrl: params.actionUrl,
      priority: params.priority,
      category: params.category,
    });
  } catch (err) {
    console.error('[NotificationService] Failed to notify all tenant users:', err);
    return 0;
  }
}

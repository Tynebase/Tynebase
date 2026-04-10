"use strict";
/**
 * Notification Service
 *
 * Centralized service for creating and managing notifications.
 * Called from various backend routes when events occur that should notify users.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.createBatchNotifications = createBatchNotifications;
exports.getUnreadCount = getUnreadCount;
exports.notifyDocumentShared = notifyDocumentShared;
exports.notifyNewComment = notifyNewComment;
exports.notifyMention = notifyMention;
exports.notifyAiComplete = notifyAiComplete;
exports.notifyCreditsLow = notifyCreditsLow;
exports.notifyCreditsExhausted = notifyCreditsExhausted;
exports.notifyBillingEvent = notifyBillingEvent;
exports.notifyInvoice = notifyInvoice;
exports.notifyChatMessage = notifyChatMessage;
exports.notifyDirectMessage = notifyDirectMessage;
exports.notifyTaskAssigned = notifyTaskAssigned;
exports.notifyInvitation = notifyInvitation;
exports.notifySystemEvent = notifySystemEvent;
exports.notifyAllTenantUsers = notifyAllTenantUsers;
const supabase_1 = require("../lib/supabase");
// ============================================================================
// CORE FUNCTIONS
// ============================================================================
/**
 * Create a single notification for a user.
 * Checks user preferences before creating.
 */
async function createNotification(params) {
    try {
        // Check if user has disabled this notification type
        const isEnabled = await isNotificationTypeEnabled(params.userId, params.type);
        if (!isEnabled) {
            return null;
        }
        const { data, error } = await supabase_1.supabaseAdmin
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
    }
    catch (err) {
        console.error('[NotificationService] Unexpected error creating notification:', err);
        return null;
    }
}
/**
 * Create notifications for multiple users at once (e.g., team-wide announcements).
 * Respects individual user preferences.
 */
async function createBatchNotifications(params) {
    try {
        if (!params.userIds.length)
            return 0;
        // Fetch preferences for all target users in one query
        const { data: prefs } = await supabase_1.supabaseAdmin
            .from('notification_preferences')
            .select('user_id, ' + getPreferenceColumn(params.type))
            .in('user_id', params.userIds);
        // Build a set of users who have disabled this type
        const disabledUsers = new Set();
        if (prefs) {
            for (const pref of prefs) {
                const col = getPreferenceColumn(params.type);
                if (pref[col] === false) {
                    disabledUsers.add(pref.user_id);
                }
            }
        }
        // Filter out users who disabled this notification type
        const enabledUserIds = params.userIds.filter(id => !disabledUsers.has(id));
        if (!enabledUserIds.length)
            return 0;
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
        const { error } = await supabase_1.supabaseAdmin
            .from('notifications')
            .insert(rows);
        if (error) {
            console.error('[NotificationService] Failed to create batch notifications:', error.message);
            return 0;
        }
        return enabledUserIds.length;
    }
    catch (err) {
        console.error('[NotificationService] Unexpected error in batch create:', err);
        return 0;
    }
}
/**
 * Get the unread notification count for a user.
 */
async function getUnreadCount(userId) {
    const { count, error } = await supabase_1.supabaseAdmin
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
function getPreferenceColumn(type) {
    return `${type}_enabled`;
}
/**
 * Check if a user has a specific notification type enabled.
 * Returns true by default (all enabled if no preferences row exists).
 */
async function isNotificationTypeEnabled(userId, type) {
    try {
        const col = getPreferenceColumn(type);
        const { data, error } = await supabase_1.supabaseAdmin
            .from('notification_preferences')
            .select(`in_app_enabled, ${col}`)
            .eq('user_id', userId)
            .maybeSingle();
        if (error || !data) {
            // No preferences row = all enabled by default
            return true;
        }
        // Both in_app and the specific type must be enabled
        return data.in_app_enabled !== false && data[col] !== false;
    }
    catch {
        return true; // Default to enabled on error
    }
}
// ============================================================================
// CONVENIENCE NOTIFICATION CREATORS
// ============================================================================
/** Notify when a document is shared with or assigned to a user */
async function notifyDocumentShared(params) {
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
async function notifyNewComment(params) {
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
async function notifyMention(params) {
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
async function notifyAiComplete(params) {
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
async function notifyCreditsLow(params) {
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
async function notifyCreditsExhausted(params) {
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
async function notifyBillingEvent(params) {
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
async function notifyInvoice(params) {
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
async function notifyChatMessage(params) {
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
        actionUrl: params.channelId ? `/dashboard/tools/team-chat?channel=${params.channelId}` : '/dashboard/tools/team-chat',
        category: 'workspace',
        metadata: { sender: params.senderName, channel_id: params.channelId },
    });
}
/** Notify about direct messages */
async function notifyDirectMessage(params) {
    return createNotification({
        userId: params.userId,
        tenantId: params.tenantId,
        type: 'chat',
        title: `Direct message from ${params.senderName}`,
        description: params.messagePreview.length > 100
            ? params.messagePreview.substring(0, 100) + '...'
            : params.messagePreview,
        actionUrl: params.conversationId
            ? `/dashboard/tools/team-chat?dm=${params.conversationId}`
            : '/dashboard/tools/team-chat',
        priority: 'high',
        category: 'workspace',
        metadata: { sender: params.senderName, conversation_id: params.conversationId },
    });
}
/** Notify about task/document assignments */
async function notifyTaskAssigned(params) {
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
async function notifyInvitation(params) {
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
async function notifySystemEvent(params) {
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
async function notifyAllTenantUsers(params) {
    try {
        let query = supabase_1.supabaseAdmin
            .from('users')
            .select('id')
            .eq('tenant_id', params.tenantId)
            .eq('status', 'active');
        if (params.excludeUserId) {
            query = query.neq('id', params.excludeUserId);
        }
        const { data: users, error } = await query;
        if (error || !users?.length)
            return 0;
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
    }
    catch (err) {
        console.error('[NotificationService] Failed to notify all tenant users:', err);
        return 0;
    }
}
//# sourceMappingURL=notifications.js.map
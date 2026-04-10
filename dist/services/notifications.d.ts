/**
 * Notification Service
 *
 * Centralized service for creating and managing notifications.
 * Called from various backend routes when events occur that should notify users.
 */
export type NotificationType = 'document' | 'comment' | 'mention' | 'system' | 'ai' | 'billing' | 'task' | 'chat' | 'credits' | 'invoice' | 'invitation';
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
/**
 * Create a single notification for a user.
 * Checks user preferences before creating.
 */
export declare function createNotification(params: CreateNotificationParams): Promise<{
    id: string;
} | null>;
/**
 * Create notifications for multiple users at once (e.g., team-wide announcements).
 * Respects individual user preferences.
 */
export declare function createBatchNotifications(params: CreateBatchNotificationParams): Promise<number>;
/**
 * Get the unread notification count for a user.
 */
export declare function getUnreadCount(userId: string): Promise<number>;
/** Notify when a document is shared with or assigned to a user */
export declare function notifyDocumentShared(params: {
    userId: string;
    tenantId?: string;
    documentTitle: string;
    sharedBy: string;
    documentId: string;
}): Promise<{
    id: string;
} | null>;
/** Notify when someone comments on a user's document or discussion */
export declare function notifyNewComment(params: {
    userId: string;
    tenantId?: string;
    commenterName: string;
    targetTitle: string;
    targetUrl: string;
    commentId?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify when a user is mentioned */
export declare function notifyMention(params: {
    userId: string;
    tenantId?: string;
    mentionedBy: string;
    context: string;
    targetUrl: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about AI generation completion */
export declare function notifyAiComplete(params: {
    userId: string;
    tenantId?: string;
    taskDescription: string;
    documentId?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about credit usage warnings */
export declare function notifyCreditsLow(params: {
    userId: string;
    tenantId?: string;
    creditsRemaining: number;
    creditsTotal: number;
}): Promise<{
    id: string;
} | null>;
/** Notify about credits being exhausted */
export declare function notifyCreditsExhausted(params: {
    userId: string;
    tenantId?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about billing events (subscription changes, payment issues) */
export declare function notifyBillingEvent(params: {
    userId: string;
    tenantId?: string;
    title: string;
    description: string;
    priority?: NotificationPriority;
}): Promise<{
    id: string;
} | null>;
/** Notify about upcoming or processed invoices */
export declare function notifyInvoice(params: {
    userId: string;
    tenantId?: string;
    title: string;
    description: string;
    invoiceUrl?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about new chat messages */
export declare function notifyChatMessage(params: {
    userId: string;
    tenantId?: string;
    senderName: string;
    channelName?: string;
    messagePreview: string;
    channelId?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about direct messages */
export declare function notifyDirectMessage(params: {
    userId: string;
    tenantId?: string;
    senderName: string;
    messagePreview: string;
    conversationId?: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about task/document assignments */
export declare function notifyTaskAssigned(params: {
    userId: string;
    tenantId?: string;
    assignedBy: string;
    taskTitle: string;
    taskUrl: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about workspace invitations */
export declare function notifyInvitation(params: {
    userId: string;
    tenantId?: string;
    inviterName: string;
    workspaceName: string;
}): Promise<{
    id: string;
} | null>;
/** Notify about system events (maintenance, updates, security) */
export declare function notifySystemEvent(params: {
    userId: string;
    tenantId?: string;
    title: string;
    description: string;
    actionUrl?: string;
    priority?: NotificationPriority;
}): Promise<{
    id: string;
} | null>;
/**
 * Notify all users in a tenant about something (e.g., system announcements).
 */
export declare function notifyAllTenantUsers(params: {
    tenantId: string;
    type: NotificationType;
    title: string;
    description?: string;
    actionUrl?: string;
    priority?: NotificationPriority;
    category?: NotificationCategory;
    excludeUserId?: string;
}): Promise<number>;
//# sourceMappingURL=notifications.d.ts.map
/**
 * Email Service using Resend
 *
 * Sends transactional emails for user actions like role changes,
 * removal notifications, etc.
 */
interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}
/**
 * Send an email using Resend
 */
export declare function sendEmail(options: SendEmailOptions): Promise<boolean>;
/**
 * Email template wrapper
 */
export declare function emailTemplate(content: string): string;
/**
 * Send role change notification email
 */
export declare function sendRoleChangeEmail(params: {
    to: string;
    userName: string;
    tenantName: string;
    oldRole: string;
    newRole: string;
    changedBy: string;
}): Promise<boolean>;
/**
 * Send user removed notification email
 */
export declare function sendUserRemovedEmail(params: {
    to: string;
    userName: string;
    tenantName: string;
    removedBy: string;
}): Promise<boolean>;
/**
 * Send welcome email when user is added to workspace
 */
export declare function sendWelcomeEmail(params: {
    to: string;
    userName: string;
    tenantName: string;
    role: string;
    addedBy: string;
    loginUrl: string;
}): Promise<boolean>;
/**
 * Send workspace invite email
 */
export declare function sendWorkspaceInviteEmail(params: {
    to: string;
    tenantName: string;
    role: string;
    invitedBy: string;
    acceptUrl: string;
    declineUrl?: string;
}): Promise<boolean>;
/**
 * Send confirmation email to user who left a workspace
 */
export declare function sendUserLeftEmail(params: {
    to: string;
    userName: string;
    tenantName: string;
    restored: boolean;
    restoredTenantName?: string;
}): Promise<boolean>;
/**
 * Notify workspace admin that a user has left
 */
export declare function sendUserLeftAdminNotification(params: {
    to: string;
    adminName: string;
    userName: string;
    userEmail: string;
    tenantName: string;
}): Promise<boolean>;
export {};
//# sourceMappingURL=email.d.ts.map
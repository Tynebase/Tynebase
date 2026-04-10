export type AuditActionType = 'auth' | 'document' | 'user' | 'settings' | 'chat';
interface AuditLogParams {
    tenantId: string;
    actorId: string;
    action: string;
    actionType: AuditActionType;
    targetName?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, any>;
}
/**
 * Write an entry to the audit_logs table.
 * Fire-and-forget — errors are logged but never thrown so they
 * cannot break the calling request.
 */
export declare function writeAuditLog(params: AuditLogParams): Promise<void>;
/**
 * Helper to extract client IP from a Fastify request.
 */
export declare function getClientIp(request: any): string;
export {};
//# sourceMappingURL=auditLog.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
exports.getClientIp = getClientIp;
const supabase_1 = require("./supabase");
/**
 * Write an entry to the audit_logs table.
 * Fire-and-forget — errors are logged but never thrown so they
 * cannot break the calling request.
 */
async function writeAuditLog(params) {
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('audit_logs')
            .insert({
            tenant_id: params.tenantId,
            actor_id: params.actorId,
            action: params.action,
            action_type: params.actionType,
            target_name: params.targetName ?? null,
            ip_address: params.ipAddress ?? null,
            metadata: params.metadata ?? {},
        });
        if (error) {
            console.error('[auditLog] Failed to write audit log:', error.message, params);
        }
    }
    catch (err) {
        console.error('[auditLog] Unexpected error writing audit log:', err);
    }
}
/**
 * Helper to extract client IP from a Fastify request.
 */
function getClientIp(request) {
    return (request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
        request.headers['x-real-ip']?.toString() ||
        request.ip ||
        'unknown');
}
//# sourceMappingURL=auditLog.js.map
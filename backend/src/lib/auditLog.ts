import { supabaseAdmin } from './supabase';

export type AuditActionType = 'auth' | 'document' | 'user' | 'settings';

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
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin
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
  } catch (err) {
    console.error('[auditLog] Unexpected error writing audit log:', err);
  }
}

/**
 * Helper to extract client IP from a Fastify request.
 */
export function getClientIp(request: any): string {
  return (
    request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    request.headers['x-real-ip']?.toString() ||
    request.ip ||
    'unknown'
  );
}

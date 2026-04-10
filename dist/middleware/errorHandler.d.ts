import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
/**
 * Error handler middleware
 * Logs errors with full context (stack trace, user info, request details)
 * Returns generic error messages to clients (never expose internal details)
 *
 * Security:
 * - Stack traces logged internally, never sent to client
 * - Generic error messages for 500 errors
 * - User context logged for audit trail
 * - Sensitive data redacted from logs
 *
 * Logged Fields:
 * - error_type: Error class name
 * - error_message: Error message
 * - error_code: Error code (if available)
 * - stack_trace: Full stack trace (internal only)
 * - method: HTTP method
 * - path: Request URL path
 * - user_id: Authenticated user ID (if available)
 * - tenant_id: Tenant ID (if available)
 * - ip: Client IP address
 * - request_id: Unique request identifier
 * - timestamp: Error occurrence time
 */
export declare const errorHandler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=errorHandler.d.ts.map
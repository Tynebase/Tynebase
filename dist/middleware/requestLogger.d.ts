import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Request logging middleware
 * Logs all API requests with method, path, user_id, tenant_id, duration, and status
 *
 * Security:
 * - Excludes /health endpoint from logs (high volume, low value)
 * - Authorization header already redacted by logger config
 * - Logs user and tenant context for audit trail
 *
 * Logged Fields:
 * - method: HTTP method (GET, POST, etc.)
 * - path: Request URL path
 * - user_id: Authenticated user ID (if available)
 * - tenant_id: Tenant ID (if available)
 * - duration: Request processing time in milliseconds
 * - status: HTTP response status code
 * - ip: Client IP address
 */
export declare const requestLoggerMiddleware: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=requestLogger.d.ts.map
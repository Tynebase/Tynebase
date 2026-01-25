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
export const requestLoggerMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Skip logging for health check endpoint (high volume, low value)
  if (request.url === '/health') {
    return;
  }

  const startTime = Date.now();

  // Extract user and tenant context if available
  const user = (request as any).user;
  const tenant = (request as any).tenant;

  // Log request start
  request.log.info(
    {
      type: 'request_start',
      method: request.method,
      path: request.url,
      user_id: user?.id || null,
      tenant_id: tenant?.id || null,
      ip: request.ip,
    },
    'Request started'
  );

  // Hook into response to log completion
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;

    request.log.info(
      {
        type: 'request_complete',
        method: request.method,
        path: request.url,
        user_id: user?.id || null,
        tenant_id: tenant?.id || null,
        status: reply.statusCode,
        duration,
        ip: request.ip,
      },
      'Request completed'
    );
  });
};

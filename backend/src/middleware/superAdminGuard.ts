import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Super Admin Guard Middleware
 * 
 * Verifies that the authenticated user has super admin privileges.
 * This middleware should be used to protect super admin-only routes.
 * 
 * Prerequisites:
 * - Must be used AFTER authMiddleware (requires request.user)
 * 
 * @param request - Fastify request object with user populated
 * @param reply - Fastify reply object
 * 
 * Security:
 * - Checks is_super_admin flag from authenticated user
 * - Logs all super admin actions for audit trail
 * - Returns 403 if user is not a super admin
 * - Returns 401 if user context is missing
 */
export async function superAdminGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;

  if (!user) {
    request.log.error('superAdminGuard called without user context');
    return reply.status(401).send({
      error: {
        code: 'MISSING_USER_CONTEXT',
        message: 'Authentication required',
      },
    });
  }

  if (!user.is_super_admin) {
    request.log.warn(
      {
        userId: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        path: request.url,
        method: request.method,
      },
      'Non-super-admin attempted to access super admin route'
    );
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin privileges required',
      },
    });
  }

  request.log.info(
    {
      userId: user.id,
      email: user.email,
      path: request.url,
      method: request.method,
    },
    'Super admin access granted'
  );
}

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Tenant Membership Guard Middleware
 * 
 * Verifies that the authenticated user belongs to the tenant specified in the request context.
 * Super admins bypass this check and can access any tenant.
 * 
 * Prerequisites:
 * - Must be used AFTER authMiddleware (requires request.user)
 * - Must be used AFTER tenantContextMiddleware (requires request.tenant)
 * 
 * @param request - Fastify request object with user and tenant populated
 * @param reply - Fastify reply object
 * 
 * Security:
 * - Queries database to verify membership (doesn't trust client claims)
 * - Super admins can access any tenant for platform oversight
 * - Returns 403 if user doesn't belong to the requested tenant
 * - Returns 401 if user or tenant context is missing
 */
export async function membershipGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;
  const tenant = request.tenant;

  if (!user) {
    request.log.error('membershipGuard called without user context');
    return reply.status(401).send({
      error: {
        code: 'MISSING_USER_CONTEXT',
        message: 'Authentication required',
      },
    });
  }

  if (!tenant) {
    request.log.error('membershipGuard called without tenant context');
    return reply.status(400).send({
      error: {
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Tenant context required',
      },
    });
  }

  if (user.is_super_admin) {
    request.log.info(
      {
        userId: user.id,
        tenantId: tenant.id,
        userTenantId: user.tenant_id,
      },
      'Super admin bypassing membership check'
    );
    return;
  }

  if (user.tenant_id !== tenant.id) {
    request.log.warn(
      {
        userId: user.id,
        userTenantId: user.tenant_id,
        requestedTenantId: tenant.id,
        requestedSubdomain: tenant.subdomain,
      },
      'User attempted to access tenant they do not belong to'
    );
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this tenant',
      },
    });
  }

  request.log.debug(
    {
      userId: user.id,
      tenantId: tenant.id,
    },
    'Membership verified'
  );
}

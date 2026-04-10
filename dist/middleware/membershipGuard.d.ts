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
export declare function membershipGuard(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=membershipGuard.d.ts.map
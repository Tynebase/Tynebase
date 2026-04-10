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
export declare function superAdminGuard(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=superAdminGuard.d.ts.map
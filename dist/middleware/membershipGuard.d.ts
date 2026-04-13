import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Tenant Membership Guard Middleware
 *
 * Verifies that the authenticated user belongs to the tenant specified in the
 * request context.  Super admins bypass this check and can access any tenant.
 *
 * For multi-tenant users (composite PK), the auth middleware already resolves
 * `request.user.tenant_id` to match the subdomain-derived `request.tenant.id`.
 * This guard acts as a secondary safety net.
 *
 * Prerequisites:
 *   - Must be used AFTER authMiddleware (requires request.user)
 *   - Must be used AFTER tenantContextMiddleware (requires request.tenant)
 */
export declare function membershipGuard(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=membershipGuard.d.ts.map
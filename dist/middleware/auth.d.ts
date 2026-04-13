import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * JWT Authentication Middleware (Multi-Tenant Aware)
 *
 * Verifies Supabase JWT token and resolves the user's profile for the
 * correct tenant.  Resolution order:
 *
 *   1. If `request.tenant` is already set (by tenantContextMiddleware from
 *      the `x-tenant-subdomain` header), look up the user row for that
 *      specific tenant.
 *   2. Otherwise fall back to the user's *primary* workspace — identified by
 *      `original_tenant_id IS NULL` (they created it) or by the admin role.
 *   3. If neither is found, take the first active membership.
 *
 * After resolution, `request.user` and (if missing) `request.tenant` are
 * populated for downstream handlers.
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=auth.d.ts.map
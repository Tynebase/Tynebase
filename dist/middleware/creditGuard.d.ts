import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Credit Guard Middleware
 *
 * Protects AI endpoints by verifying the tenant has sufficient credits.
 * Uses an atomic DB query to check the balance and prevent race conditions.
 *
 * Auto-initialises a monthly credit pool if one doesn't exist yet for the
 * current calendar month (e.g. first AI operation in a new month).
 *
 * @param request - Fastify request (requires request.tenant to be set by
 *                  tenantContextMiddleware)
 * @param reply   - Fastify reply
 */
export declare function creditGuardMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=creditGuard.d.ts.map
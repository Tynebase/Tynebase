import { FastifyInstance } from 'fastify';
/**
 * Document routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits (100 req/10min global)
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default function documentRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=documents.d.ts.map
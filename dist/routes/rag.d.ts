import { FastifyInstance } from 'fastify';
/**
 * RAG routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default function ragRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=rag.d.ts.map
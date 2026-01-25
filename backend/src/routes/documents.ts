import { FastifyInstance } from 'fastify';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Document routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits (100 req/10min global)
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request) => {
      return {
        success: true,
        message: 'Documents endpoint - membership verified',
        tenant: request.tenant,
        user: {
          id: request.user?.id,
          email: request.user?.email,
          role: request.user?.role,
        },
      };
    }
  );
}

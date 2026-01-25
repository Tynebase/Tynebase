import { FastifyInstance } from 'fastify';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';

/**
 * Document routes with full middleware chain:
 * 1. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 2. authMiddleware - verifies JWT and loads user
 * 3. membershipGuard - verifies user belongs to tenant
 */
export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/documents',
    {
      preHandler: [tenantContextMiddleware, authMiddleware, membershipGuard],
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

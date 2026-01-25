import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';

/**
 * AI test route for validating AI endpoint rate limiting (10 req/min)
 */
export default async function aiTestRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/ai/test',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware],
    },
    async (request) => {
      return {
        success: true,
        message: 'AI test endpoint',
        user: request.user?.id,
      };
    }
  );
}

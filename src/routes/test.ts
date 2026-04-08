import { FastifyInstance } from 'fastify';
import { tenantContextMiddleware } from '../middleware/tenantContext';

export default async function testRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/test/tenant',
    { preHandler: tenantContextMiddleware },
    async (request) => {
      return {
        success: true,
        tenant: request.tenant,
        message: 'Tenant context resolved successfully',
      };
    }
  );
}

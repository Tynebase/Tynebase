import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';

/**
 * Integration Import Stubs
 * These endpoints are placeholders for future integration implementations (Milestone 3)
 * All endpoints return 501 Not Implemented
 */
export default async function integrationRoutes(fastify: FastifyInstance) {
  /**
   * Notion Import Endpoint (Stub)
   * POST /api/integrations/notion/import
   * Returns 501 Not Implemented - deferred to Milestone 3
   */
  fastify.post(
    '/api/integrations/notion/import',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      request.log.info(
        {
          tenantId: tenant?.id,
          userId: user?.id,
          endpoint: '/api/integrations/notion/import',
        },
        'Notion import endpoint called (not yet implemented)'
      );

      return reply.status(501).send({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Notion integration is not yet implemented. This feature will be available in Milestone 3.',
        },
      });
    }
  );

  /**
   * Confluence Import Endpoint (Stub)
   * POST /api/integrations/confluence/import
   * Returns 501 Not Implemented - deferred to Milestone 3
   */
  fastify.post(
    '/api/integrations/confluence/import',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      request.log.info(
        {
          tenantId: tenant?.id,
          userId: user?.id,
          endpoint: '/api/integrations/confluence/import',
        },
        'Confluence import endpoint called (not yet implemented)'
      );

      return reply.status(501).send({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Confluence integration is not yet implemented. This feature will be available in Milestone 3.',
        },
      });
    }
  );

  /**
   * Google Docs Import Endpoint (Stub)
   * POST /api/integrations/gdocs/import
   * Returns 501 Not Implemented - deferred to Milestone 3
   */
  fastify.post(
    '/api/integrations/gdocs/import',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      request.log.info(
        {
          tenantId: tenant?.id,
          userId: user?.id,
          endpoint: '/api/integrations/gdocs/import',
        },
        'Google Docs import endpoint called (not yet implemented)'
      );

      return reply.status(501).send({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Google Docs integration is not yet implemented. This feature will be available in Milestone 3.',
        },
      });
    }
  );
}

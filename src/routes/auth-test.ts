import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';

export default async function authTestRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/test/auth',
    {
      preHandler: authMiddleware,
    },
    async (request) => {
      return {
        success: true,
        message: 'Authentication successful',
        user: request.user,
      };
    }
  );
}

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';

export default async function superAdminTestRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/superadmin/test',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request) => {
      if (!request.user) {
        throw new Error('User context missing after authentication');
      }

      return {
        success: true,
        message: 'Super admin access granted',
        user: {
          id: request.user.id,
          email: request.user.email,
          is_super_admin: request.user.is_super_admin,
        },
      };
    }
  );
}

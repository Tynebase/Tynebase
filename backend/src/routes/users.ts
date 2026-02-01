import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';

/**
 * Zod schema for GET /api/users query parameters
 */
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  role: z.enum(['admin', 'editor', 'member', 'viewer']).optional(),
});

/**
 * Users management routes
 */
export default async function usersRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/users
   * Lists users in the tenant with pagination
   * 
   * Query Parameters:
   * - page (optional): Page number (default: 1)
   * - limit (optional): Items per page, max 100 (default: 50)
   * - status (optional): Filter by status (active, pending, suspended)
   * - role (optional): Filter by role (admin, editor, member, viewer)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * 
   * Response includes:
   * - users: Array of user objects
   * - pagination: Page info with total count
   */
  fastify.get(
    '/api/users',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate query parameters
        const query = listUsersQuerySchema.parse(request.query);
        const { page, limit, status, role } = query;

        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Build query for users in tenant
        let usersQuery = supabaseAdmin
          .from('users')
          .select('id, email, full_name, role, status, created_at, last_active_at', { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        // Apply filters
        if (status) {
          usersQuery = usersQuery.eq('status', status);
        }
        if (role) {
          usersQuery = usersQuery.eq('role', role);
        }

        // Apply pagination
        usersQuery = usersQuery.range(offset, offset + limit - 1);

        const { data: users, count, error } = await usersQuery;

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch users');
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch users',
              details: {},
            },
          });
        }

        // Get document counts for each user
        const userIds = users?.map(u => u.id) || [];
        let documentCounts: Record<string, number> = {};

        if (userIds.length > 0) {
          const { data: docCounts, error: docError } = await supabaseAdmin
            .from('documents')
            .select('author_id')
            .eq('tenant_id', tenant.id)
            .in('author_id', userIds);

          if (!docError && docCounts) {
            documentCounts = docCounts.reduce((acc: Record<string, number>, doc) => {
              acc[doc.author_id] = (acc[doc.author_id] || 0) + 1;
              return acc;
            }, {});
          }
        }

        // Enrich users with document counts
        const enrichedUsers = users?.map(u => ({
          ...u,
          documents_count: documentCounts[u.id] || 0,
        })) || [];

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        fastify.log.info(
          { tenantId: tenant.id, userId: user.id, userCount: enrichedUsers.length },
          'Users fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            users: enrichedUsers,
            pagination: {
              page,
              limit,
              total,
              totalPages,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/users');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );
}

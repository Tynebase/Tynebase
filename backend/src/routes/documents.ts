import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Zod schema for GET /api/documents query parameters
 */
const listDocumentsQuerySchema = z.object({
  parent_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Document routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits (100 req/10min global)
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default async function documentRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/documents
   * Lists documents with optional filtering by parent_id and status
   * 
   * Query Parameters:
   * - parent_id (optional): Filter by parent document UUID (for folder structure)
   * - status (optional): Filter by status ('draft' or 'published')
   * - page (optional): Page number for pagination (default: 1)
   * - limit (optional): Items per page, max 100 (default: 50)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Validates all query parameters with Zod
   * - Prevents SQL injection via parameterized queries
   * - Limits page size to prevent resource exhaustion
   */
  fastify.get(
    '/api/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate query parameters
        const query = listDocumentsQuerySchema.parse(request.query);
        const { parent_id, status, page, limit } = query;

        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Build query with tenant isolation
        let dbQuery = supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            parent_id,
            is_public,
            status,
            author_id,
            published_at,
            created_at,
            updated_at,
            users!documents_author_id_fkey (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Apply optional filters
        if (parent_id !== undefined) {
          dbQuery = dbQuery.eq('parent_id', parent_id);
        }

        if (status !== undefined) {
          dbQuery = dbQuery.eq('status', status);
        }

        // Execute query
        const { data: documents, error, count } = await dbQuery;

        if (error) {
          fastify.log.error(
            { error, tenantId: tenant.id, userId: user.id },
            'Failed to fetch documents'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch documents',
              details: {},
            },
          });
        }

        // Calculate pagination metadata
        const totalPages = count ? Math.ceil(count / limit) : 0;
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            count: documents?.length || 0,
            filters: { parent_id, status },
            page,
          },
          'Documents fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            documents: documents || [],
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages,
              hasNextPage,
              hasPrevPage,
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

        fastify.log.error({ error }, 'Unexpected error in GET /api/documents');
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

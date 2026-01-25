import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Zod schema for GET /api/templates query parameters
 */
const listTemplatesQuerySchema = z.object({
  category: z.string().optional(),
  visibility: z.enum(['internal', 'public']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Zod schema for POST /api/templates request body
 */
const createTemplateBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  visibility: z.enum(['internal', 'public']).default('internal'),
});

/**
 * Template routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits (100 req/10min global)
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default async function templateRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/templates
   * Lists available templates: approved global templates + tenant's own templates
   * 
   * Query Parameters:
   * - category (optional): Filter by template category
   * - visibility (optional): Filter by visibility ('internal' or 'public')
   * - page (optional): Page number for pagination (default: 1)
   * - limit (optional): Items per page, max 100 (default: 50)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * 
   * Security:
   * - Returns approved global templates (tenant_id IS NULL AND is_approved = TRUE)
   * - Returns tenant's own templates (tenant_id = user's tenant)
   * - Validates all query parameters with Zod
   * - Prevents SQL injection via parameterized queries
   * - Limits page size to prevent resource exhaustion
   * 
   * Behavior:
   * - Global templates: tenant_id IS NULL AND is_approved = TRUE
   * - Tenant templates: tenant_id = user's tenant (any approval status)
   * - Results ordered by created_at DESC
   * - Includes creator information via join
   */
  fastify.get(
    '/api/templates',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate query parameters
        const query = listTemplatesQuerySchema.parse(request.query);
        const { category, visibility, page, limit } = query;

        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Build query for global approved templates OR tenant's own templates
        // Global templates: tenant_id IS NULL AND is_approved = TRUE
        // Tenant templates: tenant_id = tenant.id (any approval status)
        let dbQuery = supabaseAdmin
          .from('templates')
          .select(`
            id,
            tenant_id,
            title,
            description,
            content,
            category,
            visibility,
            is_approved,
            created_by,
            created_at,
            updated_at,
            users!templates_created_by_fkey (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Apply filters for global approved templates OR tenant's templates
        // Using OR logic: (tenant_id IS NULL AND is_approved = TRUE) OR (tenant_id = tenant.id)
        dbQuery = dbQuery.or(`and(tenant_id.is.null,is_approved.eq.true),tenant_id.eq.${tenant.id}`);

        // Apply optional category filter
        if (category !== undefined) {
          dbQuery = dbQuery.eq('category', category);
        }

        // Apply optional visibility filter
        if (visibility !== undefined) {
          dbQuery = dbQuery.eq('visibility', visibility);
        }

        // Execute query
        const { data: templates, error, count } = await dbQuery;

        if (error) {
          fastify.log.error(
            { error, tenantId: tenant.id, userId: user.id },
            'Failed to fetch templates'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch templates',
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
            count: templates?.length || 0,
            filters: { category, visibility },
            page,
          },
          'Templates fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            templates: templates || [],
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

        fastify.log.error({ error }, 'Unexpected error in GET /api/templates');
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

  /**
   * POST /api/templates
   * Creates a new template (admin only)
   * 
   * Request Body:
   * - title (required): Template title (1-500 chars)
   * - description (optional): Template description (max 2000 chars)
   * - content (required): Markdown template content
   * - category (optional): Template category (max 100 chars)
   * - visibility (optional): 'internal' or 'public' (default: 'internal')
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' role
   * 
   * Security:
   * - Validates user has admin role
   * - Validates all input fields with Zod
   * - Sets tenant_id to user's tenant (tenant-scoped templates)
   * - Sets created_by to authenticated user
   * - Sets is_approved to FALSE by default (requires approval for public visibility)
   * - Prevents SQL injection via parameterized queries
   * 
   * Behavior:
   * - Creates template with tenant_id = user's tenant
   * - For 'public' visibility, is_approved defaults to FALSE (requires admin approval)
   * - For 'internal' visibility, template is immediately available to tenant
   * - Returns created template with full details
   */
  fastify.post(
    '/api/templates',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Check user has admin role
        if (user.role !== 'admin') {
          fastify.log.warn(
            { userId: user.id, userRole: user.role, tenantId: tenant.id },
            'User attempted to create template without admin role'
          );
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admin role can create templates',
              details: {},
            },
          });
        }

        // Validate request body
        const body = createTemplateBodySchema.parse(request.body);
        const { title, description, content, category, visibility } = body;

        // Insert template into database
        const { data: template, error } = await supabaseAdmin
          .from('templates')
          .insert({
            tenant_id: tenant.id,
            title,
            description: description || null,
            content,
            category: category || null,
            visibility,
            is_approved: false, // Requires approval for public marketplace
            created_by: user.id,
          })
          .select(`
            id,
            tenant_id,
            title,
            description,
            content,
            category,
            visibility,
            is_approved,
            created_by,
            created_at,
            updated_at,
            users!templates_created_by_fkey (
              id,
              email,
              full_name
            )
          `)
          .single();

        if (error) {
          fastify.log.error(
            { error, tenantId: tenant.id, userId: user.id },
            'Failed to create template'
          );
          return reply.code(500).send({
            error: {
              code: 'CREATE_FAILED',
              message: 'Failed to create template',
              details: {},
            },
          });
        }

        fastify.log.info(
          {
            templateId: template.id,
            tenantId: tenant.id,
            userId: user.id,
            visibility,
          },
          'Template created successfully'
        );

        return reply.code(201).send({
          success: true,
          data: {
            template,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/templates');
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

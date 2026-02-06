import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Zod schema for GET /api/tags query parameters
 */
const listTagsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Zod schema for POST /api/tags request body
 */
const createTagBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
});

/**
 * Zod schema for PATCH /api/tags/:id request body
 */
const updateTagBodySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Zod schema for path parameters
 */
const tagIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for POST /api/tags/:id/documents request body
 */
const tagDocumentsBodySchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1),
});

/**
 * Zod schema for POST /api/tags/reorder request body
 */
const reorderTagsBodySchema = z.object({
  tag_ids: z.array(z.string().uuid()).min(1),
});

/**
 * Tags routes with full middleware chain
 */
export default async function tagRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/tags
   * Lists all tags for the tenant with pagination
   */
  fastify.get(
    '/api/tags',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;

        const query = listTagsQuerySchema.parse(request.query);
        const { page, limit } = query;
        const offset = (page - 1) * limit;

        // Get tags with document count
        const { data: tags, error: tagsError, count } = await supabaseAdmin
          .from('tags')
          .select(`
            id,
            name,
            description,
            sort_order,
            created_by,
            created_at,
            updated_at,
            users:created_by(id, email, full_name)
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);

        if (tagsError) {
          request.log.error({ error: tagsError }, 'Failed to fetch tags');
          throw tagsError;
        }

        // Get document counts for each tag
        const tagIds = tags?.map(t => t.id) || [];
        const { data: docCounts } = await supabaseAdmin
          .from('document_tags')
          .select('tag_id')
          .in('tag_id', tagIds);

        const countMap = (docCounts || []).reduce((acc, dt) => {
          acc[dt.tag_id] = (acc[dt.tag_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const tagsWithCounts = (tags || []).map(tag => ({
          ...tag,
          document_count: countMap[tag.id] || 0,
        }));

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        return reply.status(200).send({
          success: true,
          data: {
            tags: tagsWithCounts,
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
        request.log.error({ error }, 'Error in list tags endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while fetching tags',
          },
        });
      }
    }
  );

  /**
   * POST /api/tags
   * Creates a new tag
   */
  fastify.post(
    '/api/tags',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const body = createTagBodySchema.parse(request.body);

        const { data: tag, error: createError } = await supabaseAdmin
          .from('tags')
          .insert({
            tenant_id: tenant.id,
            name: body.name,
            description: body.description || null,
            created_by: user.id,
          })
          .select(`
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at,
            users:created_by(id, email, full_name)
          `)
          .single();

        if (createError) {
          if (createError.code === '23505') {
            return reply.status(409).send({
              error: {
                code: 'TAG_ALREADY_EXISTS',
                message: 'A tag with this name already exists in your workspace',
              },
            });
          }
          request.log.error({ error: createError }, 'Failed to create tag');
          throw createError;
        }

        return reply.status(201).send({
          success: true,
          data: {
            tag: {
              ...tag,
              document_count: 0,
            },
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Error in create tag endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while creating the tag',
          },
        });
      }
    }
  );

  /**
   * PATCH /api/tags/:id
   * Updates a tag
   */
  fastify.patch(
    '/api/tags/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;

        const params = tagIdParamsSchema.parse(request.params);
        const body = updateTagBodySchema.parse(request.body);

        const { data: tag, error: updateError } = await supabaseAdmin
          .from('tags')
          .update({
            name: body.name,
            description: body.description,
            sort_order: body.sort_order,
          })
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .select(`
            id,
            name,
            description,
            sort_order,
            created_by,
            created_at,
            updated_at,
            users:created_by(id, email, full_name)
          `)
          .single();

        if (updateError) {
          if (updateError.code === 'PGRST116') {
            return reply.status(404).send({
              error: {
                code: 'TAG_NOT_FOUND',
                message: 'Tag not found',
              },
            });
          }
          if (updateError.code === '23505') {
            return reply.status(409).send({
              error: {
                code: 'TAG_ALREADY_EXISTS',
                message: 'A tag with this name already exists in your workspace',
              },
            });
          }
          request.log.error({ error: updateError }, 'Failed to update tag');
          throw updateError;
        }

        return reply.status(200).send({
          success: true,
          data: { tag },
        });
      } catch (error) {
        request.log.error({ error }, 'Error in update tag endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while updating the tag',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/tags/:id
   * Deletes a tag
   */
  fastify.delete(
    '/api/tags/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const params = tagIdParamsSchema.parse(request.params);

        const { error: deleteError } = await supabaseAdmin
          .from('tags')
          .delete()
          .eq('id', params.id)
          .eq('tenant_id', tenant.id);

        if (deleteError) {
          request.log.error({ error: deleteError }, 'Failed to delete tag');
          throw deleteError;
        }

        return reply.status(200).send({
          success: true,
          data: {
            message: 'Tag deleted successfully',
            tagId: params.id,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Error in delete tag endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while deleting the tag',
          },
        });
      }
    }
  );

  /**
   * POST /api/tags/:id/documents
   * Adds tags to documents
   */
  fastify.post(
    '/api/tags/:id/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const params = tagIdParamsSchema.parse(request.params);
        const body = tagDocumentsBodySchema.parse(request.body);

        // Verify tag exists and belongs to tenant
        const { data: tag, error: tagError } = await supabaseAdmin
          .from('tags')
          .select('id')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (tagError || !tag) {
          return reply.status(404).send({
            error: {
              code: 'TAG_NOT_FOUND',
              message: 'Tag not found',
            },
          });
        }

        // Create document-tag relationships
        const relationships = body.document_ids.map(doc_id => ({
          tag_id: params.id,
          document_id: doc_id,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('document_tags')
          .insert(relationships);

        if (insertError) {
          request.log.error({ error: insertError }, 'Failed to add tags to documents');
          throw insertError;
        }

        return reply.status(200).send({
          success: true,
          data: {
            message: 'Tags added to documents successfully',
            count: body.document_ids.length,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Error in add tags to documents endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while adding tags to documents',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/tags/:id/documents/:documentId
   * Removes a tag from a document
   */
  fastify.delete(
    '/api/tags/:id/documents/:documentId',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const params = z.object({
          id: z.string().uuid(),
          documentId: z.string().uuid(),
        }).parse(request.params);

        const { error: deleteError } = await supabaseAdmin
          .from('document_tags')
          .delete()
          .eq('tag_id', params.id)
          .eq('document_id', params.documentId);

        if (deleteError) {
          request.log.error({ error: deleteError }, 'Failed to remove tag from document');
          throw deleteError;
        }

        return reply.status(200).send({
          success: true,
          data: {
            message: 'Tag removed from document successfully',
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Error in remove tag from document endpoint');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while removing tag from document',
          },
        });
      }
    }
  );

  fastify.post('/api/tags/reorder', {
    preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
  }, async (request, reply) => {
    try {
      const tenant = (request as any).tenant;
      const body = reorderTagsBodySchema.parse(request.body);
      const { tag_ids } = body;

      const { data: existingTags } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('tenant_id', tenant.id)
        .in('id', tag_ids);

      const validTagIds = new Set(existingTags?.map((t: { id: string }) => t.id) || []);
      const invalidIds = tag_ids.filter((id: string) => !validTagIds.has(id));

      if (invalidIds.length > 0) {
        return reply.status(400).send({
          error: { code: 'INVALID_TAGS', message: 'Some tag IDs are invalid' },
        });
      }

      for (let i = 0; i < tag_ids.length; i++) {
        await supabaseAdmin
          .from('tags')
          .update({ sort_order: i + 1 })
          .eq('id', tag_ids[i])
          .eq('tenant_id', tenant.id);
      }

      return reply.status(200).send({ success: true, data: { message: 'Tags reordered successfully' } });
    } catch (error) {
      request.log.error({ error }, 'Error in reorder tags endpoint');
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reorder tags' } });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Zod schema for GET /api/categories query parameters
 */
const listCategoriesQuerySchema = z.object({
  parent_id: z.string().uuid().nullable().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Zod schema for POST /api/categories request body
 */
const createCategoryBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().min(1).max(50).optional(),
});

/**
 * Zod schema for PATCH /api/categories/:id request body
 */
const updateCategoryBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().min(1).max(50).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Zod schema for DELETE /api/categories/:id query parameters
 */
const deleteCategoryQuerySchema = z.object({
  migrate_to_category_id: z.string().uuid().nullable().optional(),
});

/**
 * Category routes for organizing documents hierarchically
 * Categories are proper folders stored in the categories table
 */
export default async function categoryRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/categories
   * Lists all categories for the tenant, optionally filtered by parent
   */
  fastify.get(
    '/api/categories',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;

        const query = listCategoriesQuerySchema.parse(request.query);
        const { parent_id, page, limit } = query;
        const offset = (page - 1) * limit;

        // Query categories from the categories table
        let dbQuery = supabaseAdmin
          .from('categories')
          .select(`
            id,
            name,
            description,
            color,
            icon,
            parent_id,
            author_id,
            sort_order,
            created_at,
            updated_at,
            users:author_id (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);

        // Filter by parent
        if (parent_id !== undefined) {
          if (parent_id === null) {
            dbQuery = dbQuery.is('parent_id', null);
          } else {
            dbQuery = dbQuery.eq('parent_id', parent_id);
          }
        } else {
          // Default: show root categories
          dbQuery = dbQuery.is('parent_id', null);
        }

        const { data: categories, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch categories');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch categories', details: {} },
          });
        }

        // Get document counts for each category
        const categoryIds = categories?.map(c => c.id) || [];
        let documentCounts: Record<string, number> = {};
        let subcategoryCounts: Record<string, number> = {};

        if (categoryIds.length > 0) {
          // Count documents in each category
          const { data: docCounts } = await supabaseAdmin
            .from('documents')
            .select('category_id')
            .eq('tenant_id', tenant.id)
            .in('category_id', categoryIds);

          if (docCounts) {
            docCounts.forEach(d => {
              if (d.category_id) {
                documentCounts[d.category_id] = (documentCounts[d.category_id] || 0) + 1;
              }
            });
          }

          // Count subcategories in each category
          const { data: subCounts } = await supabaseAdmin
            .from('categories')
            .select('parent_id')
            .eq('tenant_id', tenant.id)
            .in('parent_id', categoryIds);

          if (subCounts) {
            subCounts.forEach(c => {
              if (c.parent_id) {
                subcategoryCounts[c.parent_id] = (subcategoryCounts[c.parent_id] || 0) + 1;
              }
            });
          }
        }

        // Enrich categories with counts
        const enrichedCategories = categories?.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description || null,
          color: category.color || '#3b82f6',
          icon: category.icon || 'folder',
          parent_id: category.parent_id,
          sort_order: category.sort_order ?? 0,
          document_count: documentCounts[category.id] || 0,
          subcategory_count: subcategoryCounts[category.id] || 0,
          author_id: category.author_id,
          created_at: category.created_at,
          updated_at: category.updated_at,
          users: category.users,
        })) || [];

        const totalPages = count ? Math.ceil(count / limit) : 0;

        return reply.code(200).send({
          success: true,
          data: {
            categories: enrichedCategories,
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/categories');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/categories/:id
   * Get a single category by ID with its subcategories
   */
  fastify.get(
    '/api/categories/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const { id } = request.params as { id: string };

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
          });
        }

        // Fetch category
        const { data: category, error } = await supabaseAdmin
          .from('categories')
          .select(`
            id,
            name,
            description,
            color,
            parent_id,
            author_id,
            sort_order,
            created_at,
            updated_at,
            users:author_id (
              id,
              email,
              full_name
            )
          `)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (error || !category) {
          return reply.code(404).send({
            error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
          });
        }

        // Get document count
        const { count: docCount } = await supabaseAdmin
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', id)
          .eq('tenant_id', tenant.id);

        // Get subcategories
        const { data: subcategories } = await supabaseAdmin
          .from('categories')
          .select(`
            id,
            name,
            description,
            color,
            parent_id,
            author_id,
            created_at,
            updated_at
          `)
          .eq('parent_id', id)
          .eq('tenant_id', tenant.id)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        return reply.code(200).send({
          success: true,
          data: {
            category: {
              id: category.id,
              name: category.name,
              description: category.description || null,
              color: category.color || '#3b82f6',
              parent_id: category.parent_id,
              document_count: docCount || 0,
              subcategories: subcategories || [],
              author_id: category.author_id,
              created_at: category.created_at,
              updated_at: category.updated_at,
              users: category.users,
            },
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/categories/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/categories
   * Create a new category
   */
  fastify.post(
    '/api/categories',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const body = createCategoryBodySchema.parse(request.body);
        const { name, description, parent_id, color, icon } = body;

        // Verify parent category exists if provided
        if (parent_id) {
          const { data: parentCategory, error: parentError } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('id', parent_id)
            .eq('tenant_id', tenant.id)
            .single();

          if (parentError || !parentCategory) {
            return reply.code(400).send({
              error: { code: 'INVALID_PARENT', message: 'Parent category not found', details: {} },
            });
          }
        }

        // Create category
        const { data: category, error: createError } = await supabaseAdmin
          .from('categories')
          .insert({
            tenant_id: tenant.id,
            author_id: user.id,
            name,
            description: description || null,
            color: color || '#3b82f6',
            icon: icon || 'folder',
            parent_id: parent_id || null,
          })
          .select(`
            id,
            name,
            description,
            color,
            icon,
            parent_id,
            author_id,
            created_at,
            updated_at
          `)
          .single();

        if (createError) {
          if (createError.code === '23505') {
            return reply.code(409).send({
              error: { code: 'CATEGORY_EXISTS', message: 'A category with this name already exists', details: {} },
            });
          }
          fastify.log.error({ error: createError }, 'Failed to create category');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to create category', details: {} },
          });
        }

        fastify.log.info({ categoryId: category.id, tenantId: tenant.id, userId: user.id }, 'Category created');

        return reply.code(201).send({
          success: true,
          data: {
            category: {
              id: category.id,
              name: category.name,
              description: category.description || null,
              color: category.color || '#3b82f6',
              icon: category.icon || 'folder',
              parent_id: category.parent_id,
              document_count: 0,
              subcategory_count: 0,
              author_id: category.author_id,
              created_at: category.created_at,
              updated_at: category.updated_at,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/categories');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * PATCH /api/categories/:id
   * Update a category
   */
  fastify.patch(
    '/api/categories/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
          });
        }

        const body = updateCategoryBodySchema.parse(request.body);

        // Verify category exists and user owns it
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('categories')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !existing) {
          return reply.code(404).send({
            error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
          });
        }

        // Build update object
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.color !== undefined) updateData.color = body.color;
        if (body.icon !== undefined) updateData.icon = body.icon;
        if (body.parent_id !== undefined) updateData.parent_id = body.parent_id;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

        // Allow any tenant member to reorder (sort_order only), but require author for other fields
        const isSortOrderOnly = Object.keys(updateData).length === 1 && updateData.sort_order !== undefined;
        if (!isSortOrderOnly && existing.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only the category author can update this category', details: {} },
          });
        }

        // Update category
        const { data: category, error: updateError } = await supabaseAdmin
          .from('categories')
          .update(updateData)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select(`
            id,
            name,
            description,
            color,
            icon,
            parent_id,
            author_id,
            created_at,
            updated_at
          `)
          .single();

        if (updateError) {
          fastify.log.error({ error: updateError }, 'Failed to update category');
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to update category', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: {
            category: {
              id: category.id,
              name: category.name,
              description: category.description || null,
              color: category.color || '#3b82f6',
              icon: category.icon || 'folder',
              parent_id: category.parent_id,
              author_id: category.author_id,
              created_at: category.created_at,
              updated_at: category.updated_at,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/categories/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/categories/:id/documents
   * Get all documents in a category
   */
  fastify.get(
    '/api/categories/:id/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const { id } = request.params as { id: string };

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
          });
        }

        // Verify category exists in tenant
        const { data: category, error: categoryError } = await supabaseAdmin
          .from('categories')
          .select('id, name')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (categoryError || !category) {
          return reply.code(404).send({
            error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
          });
        }

        // Get documents in this category
        const { data: documents, error: docsError } = await supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            status,
            author_id,
            created_at,
            updated_at,
            users:author_id (
              id,
              email,
              full_name
            )
          `)
          .eq('category_id', id)
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false });

        if (docsError) {
          fastify.log.error({ error: docsError }, 'Failed to fetch documents for category');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch documents', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: {
            category: {
              id: category.id,
              name: category.name,
            },
            documents: documents || [],
            count: documents?.length || 0,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/categories/:id/documents');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/categories/uncategorized
   * Get the Uncategorized system category for the tenant
   */
  fastify.get(
    '/api/categories/uncategorized',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Find or create Uncategorized category using RPC
        const { data: categoryId, error: rpcError } = await supabaseAdmin
          .rpc('get_or_create_uncategorized_category', {
            p_tenant_id: tenant.id,
            p_user_id: user.id,
          });

        if (rpcError) {
          fastify.log.error({ error: rpcError }, 'Failed to get/create Uncategorized category');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to get Uncategorized category', details: {} },
          });
        }

        // Get full category details
        const { data: category, error: categoryError } = await supabaseAdmin
          .from('categories')
          .select(`
            id,
            name,
            description,
            color,
            icon,
            author_id,
            created_at,
            updated_at
          `)
          .eq('id', categoryId)
          .single();

        if (categoryError || !category) {
          return reply.code(404).send({
            error: { code: 'CATEGORY_NOT_FOUND', message: 'Uncategorized category not found', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { category },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/categories/uncategorized');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/categories/:id
   * Delete a category with optional document migration
   */
  fastify.delete(
    '/api/categories/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const query = deleteCategoryQuerySchema.parse(request.query);
        const { migrate_to_category_id } = query;

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
          });
        }

        // Verify category exists and user owns it
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('categories')
          .select('id, author_id, name')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !existing) {
          return reply.code(404).send({
            error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
          });
        }

        // Validate target category if provided
        if (migrate_to_category_id) {
          const { data: targetCategory, error: targetError } = await supabaseAdmin
            .from('categories')
            .select('id, tenant_id')
            .eq('id', migrate_to_category_id)
            .single();

          if (targetError || !targetCategory) {
            return reply.code(400).send({
              error: { code: 'INVALID_TARGET', message: 'Target category not found', details: {} },
            });
          }

          if (targetCategory.tenant_id !== tenant.id) {
            return reply.code(403).send({
              error: { code: 'FORBIDDEN', message: 'Target category must be in the same tenant', details: {} },
            });
          }

          if (targetCategory.id === id) {
            return reply.code(400).send({
              error: { code: 'INVALID_TARGET', message: 'Cannot migrate to the same category', details: {} },
            });
          }
        }

        // Count subcategories
        const { count: subcategoryCount } = await supabaseAdmin
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('parent_id', id)
          .eq('tenant_id', tenant.id);

        // Use the RPC function to safely delete with migration
        const { data: result, error: deleteError } = await supabaseAdmin
          .rpc('delete_category_with_migration', {
            p_category_id: id,
            p_target_category_id: migrate_to_category_id || null,
            p_user_id: user.id,
          });

        if (deleteError) {
          fastify.log.error({ error: deleteError }, 'Failed to delete category with migration');
          
          // Handle specific error cases
          if (deleteError.message?.includes('Cannot delete system categories')) {
            return reply.code(403).send({
              error: { code: 'CANNOT_DELETE_SYSTEM', message: 'System categories cannot be deleted', details: {} },
            });
          }
          
          if (deleteError.message?.includes('Not authorized')) {
            return reply.code(403).send({
              error: { code: 'FORBIDDEN', message: 'Not authorized to delete this category', details: {} },
            });
          }
          
          if (deleteError.message?.includes('Target category not found')) {
            return reply.code(400).send({
              error: { code: 'INVALID_TARGET', message: 'Target category not found', details: {} },
            });
          }
          
          return reply.code(500).send({
            error: { code: 'DELETE_FAILED', message: 'Failed to delete category', details: {} },
          });
        }

        // Get the target category info for response
        const migratedToId = result?.[0]?.target_category_id;
        const migratedCount = result?.[0]?.migrated_document_count || 0;

        let migratedToCategory = null;
        if (migratedToId) {
          const { data: targetCat } = await supabaseAdmin
            .from('categories')
            .select('id, name')
            .eq('id', migratedToId)
            .single();
          migratedToCategory = targetCat;
        }

        fastify.log.info({ 
          categoryId: id, 
          tenantId: tenant.id, 
          userId: user.id,
          migratedDocuments: migratedCount,
          migratedToCategoryId: migratedToId,
        }, 'Category deleted with migration');

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Category deleted successfully',
            categoryId: id,
            categoryName: existing.name,
            migrated: {
              documents: migratedCount,
              subcategories: subcategoryCount || 0,
              toCategory: migratedToCategory,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/categories/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );
}

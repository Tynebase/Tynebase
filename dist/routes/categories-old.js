"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = categoryRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const rateLimit_1 = require("../middleware/rateLimit");
/**
 * Zod schema for GET /api/categories query parameters
 */
const listCategoriesQuerySchema = zod_1.z.object({
    parent_id: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
});
/**
 * Zod schema for POST /api/categories request body
 */
const createCategoryBodySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    parent_id: zod_1.z.string().uuid().optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
/**
 * Zod schema for PATCH /api/categories/:id request body
 */
const updateCategoryBodySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
});
/**
 * Category routes for organizing documents hierarchically
 * Categories are stored as documents with __CATEGORY__ prefix in content field
 */
async function categoryRoutes(fastify) {
    /**
     * GET /api/categories
     * Lists all categories for the tenant, optionally filtered by parent
     */
    fastify.get('/api/categories', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const query = listCategoriesQuerySchema.parse(request.query);
            const { parent_id, page, limit } = query;
            const offset = (page - 1) * limit;
            // Query categories - documents where content starts with '__CATEGORY__'
            let dbQuery = supabase_1.supabaseAdmin
                .from('documents')
                .select(`
            id,
            title,
            content,
            parent_id,
            author_id,
            created_at,
            updated_at
          `, { count: 'exact' })
                .eq('tenant_id', tenant.id)
                .like('content', '__CATEGORY__%')
                .order('title', { ascending: true })
                .range(offset, offset + limit - 1);
            // Filter by parent
            if (parent_id !== undefined) {
                dbQuery = dbQuery.eq('parent_id', parent_id);
            }
            else {
                dbQuery = dbQuery.is('parent_id', null);
            }
            const { data: categories, error, count } = await dbQuery;
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch categories');
                return reply.code(500).send({
                    error: { code: 'FETCH_FAILED', message: 'Failed to fetch categories', details: {} },
                });
            }
            // Fetch user information for all authors
            const authorIds = categories?.map((c) => c.author_id).filter((id) => id) || [];
            let usersMap = {};
            if (authorIds.length > 0) {
                const { data: users } = await supabase_1.supabaseAdmin
                    .from('users')
                    .select('id, email, full_name')
                    .in('id', authorIds);
                usersMap = (users || []).reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});
            }
            // Merge user information into categories
            const categoriesWithUsers = categories?.map((cat) => ({
                ...cat,
                users: usersMap[cat.author_id] || null,
            })) || [];
            // Get document counts for each category
            const categoryIds = categoriesWithUsers?.map(c => c.id) || [];
            let documentCounts = {};
            let subcategoryCounts = {};
            if (categoryIds.length > 0) {
                // Count documents in each category
                const { data: docCounts } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .select('parent_id')
                    .eq('tenant_id', tenant.id)
                    .in('parent_id', categoryIds)
                    .not('content', 'like', '__CATEGORY__%');
                if (docCounts) {
                    docCounts.forEach(d => {
                        if (d.parent_id) {
                            documentCounts[d.parent_id] = (documentCounts[d.parent_id] || 0) + 1;
                        }
                    });
                }
                // Count subcategories in each category
                const { data: subCounts } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .select('parent_id')
                    .eq('tenant_id', tenant.id)
                    .in('parent_id', categoryIds)
                    .like('content', '__CATEGORY__%');
                if (subCounts) {
                    subCounts.forEach(d => {
                        if (d.parent_id) {
                            subcategoryCounts[d.parent_id] = (subcategoryCounts[d.parent_id] || 0) + 1;
                        }
                    });
                }
            }
            // Parse category metadata and enrich with counts
            const enrichedCategories = categoriesWithUsers?.map(category => {
                let metadata = {};
                try {
                    const metaStr = category.content?.replace('__CATEGORY__', '') || '{}';
                    metadata = JSON.parse(metaStr);
                }
                catch (e) {
                    // Ignore parse errors
                }
                return {
                    id: category.id,
                    name: category.title,
                    description: metadata.description || null,
                    color: metadata.color || '#3b82f6',
                    parent_id: category.parent_id,
                    document_count: documentCounts[category.id] || 0,
                    subcategory_count: subcategoryCounts[category.id] || 0,
                    author_id: category.author_id,
                    created_at: category.created_at,
                    updated_at: category.updated_at,
                    users: category.users,
                };
            }) || [];
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in GET /api/categories');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * GET /api/categories/:id
     * Get a single category by ID with its subcategories
     */
    fastify.get('/api/categories/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const { id } = request.params;
            if (!zod_1.z.string().uuid().safeParse(id).success) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
                });
            }
            // Fetch category
            const { data: category, error } = await supabase_1.supabaseAdmin
                .from('documents')
                .select(`
            id,
            title,
            content,
            parent_id,
            author_id,
            created_at,
            updated_at
          `)
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .like('content', '__CATEGORY__%')
                .single();
            if (error || !category) {
                return reply.code(404).send({
                    error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
                });
            }
            // Fetch user information for the author
            let users = null;
            if (category.author_id) {
                const { data: userData } = await supabase_1.supabaseAdmin
                    .from('users')
                    .select('id, email, full_name')
                    .eq('id', category.author_id)
                    .single();
                users = userData;
            }
            const categoryWithUser = {
                ...category,
                users,
            };
            // Get subcategories
            const { data: subcategories } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, title, content')
                .eq('tenant_id', tenant.id)
                .eq('parent_id', id)
                .like('content', '__CATEGORY__%')
                .order('title', { ascending: true });
            // Get document count
            const { count: docCount } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('parent_id', id)
                .not('content', 'like', '__CATEGORY__%');
            // Parse metadata
            let metadata = {};
            try {
                const metaStr = category.content?.replace('__CATEGORY__', '') || '{}';
                metadata = JSON.parse(metaStr);
            }
            catch (e) { }
            const enrichedSubcategories = subcategories?.map(sc => {
                let scMeta = {};
                try {
                    const metaStr = sc.content?.replace('__CATEGORY__', '') || '{}';
                    scMeta = JSON.parse(metaStr);
                }
                catch (e) { }
                return {
                    id: sc.id,
                    name: sc.title,
                    color: scMeta.color || '#3b82f6',
                };
            }) || [];
            return reply.code(200).send({
                success: true,
                data: {
                    category: {
                        id: categoryWithUser.id,
                        name: categoryWithUser.title,
                        description: metadata.description || null,
                        color: metadata.color || '#3b82f6',
                        parent_id: categoryWithUser.parent_id,
                        document_count: docCount || 0,
                        subcategories: enrichedSubcategories,
                        author_id: categoryWithUser.author_id,
                        created_at: categoryWithUser.created_at,
                        updated_at: categoryWithUser.updated_at,
                        users: categoryWithUser.users,
                    },
                },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in GET /api/categories/:id');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * POST /api/categories
     * Create a new category
     */
    fastify.post('/api/categories', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const body = createCategoryBodySchema.parse(request.body);
            const { name, description, parent_id, color } = body;
            // Verify parent category exists if provided
            if (parent_id) {
                const { data: parentCategory, error: parentError } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .select('id')
                    .eq('id', parent_id)
                    .eq('tenant_id', tenant.id)
                    .like('content', '__CATEGORY__%')
                    .single();
                if (parentError || !parentCategory) {
                    return reply.code(400).send({
                        error: { code: 'INVALID_PARENT', message: 'Parent category not found', details: {} },
                    });
                }
            }
            // Create category as document with special content marker
            const metadata = JSON.stringify({ description, color: color || '#3b82f6' });
            const { data: category, error: createError } = await supabase_1.supabaseAdmin
                .from('documents')
                .insert({
                tenant_id: tenant.id,
                author_id: user.id,
                title: name,
                content: `__CATEGORY__${metadata}`,
                parent_id: parent_id || null,
                is_public: false,
                status: 'draft',
            })
                .select(`
            id,
            title,
            content,
            parent_id,
            author_id,
            created_at,
            updated_at
          `)
                .single();
            if (createError) {
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
                        name: category.title,
                        description: description || null,
                        color: color || '#3b82f6',
                        parent_id: category.parent_id,
                        document_count: 0,
                        subcategory_count: 0,
                        author_id: category.author_id,
                        created_at: category.created_at,
                        updated_at: category.updated_at,
                    },
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/categories');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * PATCH /api/categories/:id
     * Update a category's name, description, or color
     */
    fastify.patch('/api/categories/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const { id } = request.params;
            if (!zod_1.z.string().uuid().safeParse(id).success) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
                });
            }
            const body = updateCategoryBodySchema.parse(request.body);
            // Fetch existing category
            const { data: existingCategory, error: fetchError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, title, content, author_id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .like('content', '__CATEGORY__%')
                .single();
            if (fetchError || !existingCategory) {
                return reply.code(404).send({
                    error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
                });
            }
            // Parse existing metadata
            let metadata = {};
            try {
                const metaStr = existingCategory.content?.replace('__CATEGORY__', '') || '{}';
                metadata = JSON.parse(metaStr);
            }
            catch (e) { }
            // Update metadata
            if (body.description !== undefined)
                metadata.description = body.description;
            if (body.color !== undefined)
                metadata.color = body.color;
            const updateData = {
                content: `__CATEGORY__${JSON.stringify(metadata)}`,
            };
            if (body.name !== undefined)
                updateData.title = body.name;
            const { data: updatedCategory, error: updateError } = await supabase_1.supabaseAdmin
                .from('documents')
                .update(updateData)
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .select(`
            id,
            title,
            content,
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
                        id: updatedCategory.id,
                        name: updatedCategory.title,
                        description: metadata.description || null,
                        color: metadata.color || '#3b82f6',
                        parent_id: updatedCategory.parent_id,
                        author_id: updatedCategory.author_id,
                        created_at: updatedCategory.created_at,
                        updated_at: updatedCategory.updated_at,
                    },
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in PATCH /api/categories/:id');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * DELETE /api/categories/:id
     * Delete a category (must be empty - no documents or subcategories)
     */
    fastify.delete('/api/categories/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            if (!zod_1.z.string().uuid().safeParse(id).success) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid category ID format', details: {} },
                });
            }
            // Verify category exists
            const { data: category, error: fetchError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, author_id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .like('content', '__CATEGORY__%')
                .single();
            if (fetchError || !category) {
                return reply.code(404).send({
                    error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found', details: {} },
                });
            }
            // Check if category is empty
            const { count: childCount } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('parent_id', id);
            if (childCount && childCount > 0) {
                return reply.code(400).send({
                    error: { code: 'CATEGORY_NOT_EMPTY', message: 'Cannot delete category with documents or subcategories', details: {} },
                });
            }
            // Delete category
            const { error: deleteError } = await supabase_1.supabaseAdmin
                .from('documents')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenant.id);
            if (deleteError) {
                fastify.log.error({ error: deleteError }, 'Failed to delete category');
                return reply.code(500).send({
                    error: { code: 'DELETE_FAILED', message: 'Failed to delete category', details: {} },
                });
            }
            fastify.log.info({ categoryId: id, tenantId: tenant.id, userId: user.id }, 'Category deleted');
            return reply.code(200).send({
                success: true,
                data: { message: 'Category deleted successfully', categoryId: id },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in DELETE /api/categories/:id');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
}
//# sourceMappingURL=categories-old.js.map
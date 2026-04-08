import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { canWriteContent } from '../lib/roles';

/**
 * Zod schema for GET /api/collections query parameters
 */
const listCollectionsQuerySchema = z.object({
  visibility: z.enum(['public', 'team', 'private']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Zod schema for POST /api/collections request body
 */
const createCollectionBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  cover_image_url: z.string().url().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  visibility: z.enum(['public', 'team', 'private']).default('private'),
});

/**
 * Zod schema for PATCH /api/collections/:id request body
 */
const updateCollectionBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  visibility: z.enum(['public', 'team', 'private']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Zod schema for adding documents to a collection
 */
const addDocumentsBodySchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Zod schema for removing a document from a collection
 */
const removeDocumentParamsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

/**
 * Collections routes for curating documents into groups with access control
 */
export default async function collectionRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/collections
   * Lists all collections the user can view
   */
  fastify.get(
    '/api/collections',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const query = listCollectionsQuerySchema.parse(request.query);
        const { visibility, page, limit } = query;
        const offset = (page - 1) * limit;

        let dbQuery = supabaseAdmin
          .from('collections')
          .select(`
            id,
            name,
            description,
            cover_image_url,
            color,
            visibility,
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
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by visibility
        if (visibility) {
          dbQuery = dbQuery.eq('visibility', visibility);
        } else {
          // Show all collections user can access:
          // - public collections (all org members)
          // - team collections (all org members)
          // - user's own collections (any visibility)
          // - private collections where user is a member
          dbQuery = dbQuery.or(`visibility.eq.public,visibility.eq.team,author_id.eq.${user.id}`);
          
          // Additionally, get collection IDs where user is a member
          const { data: memberCollections } = await supabaseAdmin
            .from('collection_members')
            .select('collection_id')
            .eq('user_id', user.id);
          
          if (memberCollections && memberCollections.length > 0) {
            const memberCollectionIds = memberCollections.map(mc => mc.collection_id);
            dbQuery = dbQuery.in('id', memberCollectionIds);
          }
        }

        const { data: collections, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch collections');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch collections', details: { supabaseError: error.message, code: error.code } },
          });
        }

        // Get document counts for each collection
        const collectionIds = collections?.map(c => c.id) || [];
        let documentCounts: Record<string, number> = {};

        if (collectionIds.length > 0) {
          const { data: counts } = await supabaseAdmin
            .from('collection_documents')
            .select('collection_id')
            .in('collection_id', collectionIds);

          if (counts) {
            counts.forEach(c => {
              documentCounts[c.collection_id] = (documentCounts[c.collection_id] || 0) + 1;
            });
          }
        }

        const enrichedCollections = collections?.map(collection => ({
          ...collection,
          document_count: documentCounts[collection.id] || 0,
        })) || [];

        const totalPages = count ? Math.ceil(count / limit) : 0;

        return reply.code(200).send({
          success: true,
          data: {
            collections: enrichedCollections,
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
        fastify.log.error({ error }, 'Unexpected error in GET /api/collections');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/collections/:id
   * Get a single collection with its documents
   */
  fastify.get(
    '/api/collections/:id',
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
            error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format', details: {} },
          });
        }

        // Fetch collection
        const { data: collection, error } = await supabaseAdmin
          .from('collections')
          .select(`
            id,
            name,
            description,
            cover_image_url,
            color,
            visibility,
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

        if (error || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        // Check access:
        // - Public collections: all tenant members can access
        // - Team collections: all tenant members can access  
        // - Private collections: only author and invited members can access
        const hasAccess = 
          collection.visibility !== 'private' || 
          collection.author_id === user.id ||
          await checkCollectionMembership(id, user.id);

        if (!hasAccess) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You do not have access to this collection', details: {} },
          });
        }

        // Get documents in collection
        const { data: collectionDocs } = await supabaseAdmin
          .from('collection_documents')
          .select(`
            id,
            document_id,
            sort_order,
            added_at,
            documents:document_id (
              id,
              title,
              status,
              created_at,
              updated_at
            )
          `)
          .eq('collection_id', id)
          .order('sort_order', { ascending: true });

        const documents = collectionDocs?.map(cd => ({
          ...cd.documents,
          sort_order: cd.sort_order,
          added_at: cd.added_at,
        })) || [];

        return reply.code(200).send({
          success: true,
          data: {
            collection: {
              ...collection,
              document_count: documents.length,
              documents,
            },
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/collections/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/collections
   * Create a new collection
   */
  fastify.post(
    '/api/collections',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to create collections', details: {} },
          });
        }

        const body = createCollectionBodySchema.parse(request.body);

        const { data: collection, error: createError } = await supabaseAdmin
          .from('collections')
          .insert({
            tenant_id: tenant.id,
            author_id: user.id,
            name: body.name,
            description: body.description || null,
            cover_image_url: body.cover_image_url || null,
            color: body.color || '#6366f1',
            visibility: body.visibility,
          })
          .select(`
            id,
            name,
            description,
            cover_image_url,
            color,
            visibility,
            author_id,
            sort_order,
            created_at,
            updated_at
          `)
          .single();

        if (createError) {
          fastify.log.error({ error: createError }, 'Failed to create collection');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to create collection', details: {} },
          });
        }

        fastify.log.info({ collectionId: collection.id, tenantId: tenant.id, userId: user.id }, 'Collection created');

        return reply.code(201).send({
          success: true,
          data: {
            collection: {
              ...collection,
              document_count: 0,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/collections');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * PATCH /api/collections/:id
   * Update a collection
   */
  fastify.patch(
    '/api/collections/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to update collections', details: {} },
          });
        }

        const body = updateCollectionBodySchema.parse(request.body);

        // Verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !existing) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (existing.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You can only update your own collections', details: {} },
          });
        }

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('collections')
          .update(body)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select(`
            id,
            name,
            description,
            cover_image_url,
            color,
            visibility,
            author_id,
            sort_order,
            created_at,
            updated_at
          `)
          .single();

        if (updateError) {
          fastify.log.error({ error: updateError }, 'Failed to update collection');
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to update collection', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { collection: updated },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/collections/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/collections/:id
   * Delete a collection
   */
  fastify.delete(
    '/api/collections/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to delete collections', details: {} },
          });
        }

        // Verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !existing) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (existing.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You can only delete your own collections', details: {} },
          });
        }

        // Delete collection (cascade will handle collection_documents)
        const { error: deleteError } = await supabaseAdmin
          .from('collections')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (deleteError) {
          fastify.log.error({ error: deleteError }, 'Failed to delete collection');
          return reply.code(500).send({
            error: { code: 'DELETE_FAILED', message: 'Failed to delete collection', details: {} },
          });
        }

        fastify.log.info({ collectionId: id, tenantId: tenant.id, userId: user.id }, 'Collection deleted');

        return reply.code(200).send({
          success: true,
          data: { message: 'Collection deleted successfully', collectionId: id },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/collections/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/collections/:id/documents
   * Add documents to a collection
   */
  fastify.post(
    '/api/collections/:id/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to modify collection documents', details: {} },
          });
        }

        const body = addDocumentsBodySchema.parse(request.body);

        // Verify ownership
        const { data: collection, error: fetchError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (collection.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You can only add documents to your own collections', details: {} },
          });
        }

        // Verify documents exist and belong to tenant
        const { data: documents } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('tenant_id', tenant.id)
          .in('id', body.document_ids);

        const validDocIds = documents?.map(d => d.id) || [];

        if (validDocIds.length === 0) {
          return reply.code(400).send({
            error: { code: 'NO_VALID_DOCUMENTS', message: 'No valid documents found', details: {} },
          });
        }

        // Get current max sort_order
        const { data: maxOrder } = await supabaseAdmin
          .from('collection_documents')
          .select('sort_order')
          .eq('collection_id', id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .single();

        let sortOrder = (maxOrder?.sort_order || 0) + 1;

        // Add documents to collection
        const insertData = validDocIds.map(docId => ({
          collection_id: id,
          document_id: docId,
          added_by: user.id,
          sort_order: sortOrder++,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('collection_documents')
          .upsert(insertData, { onConflict: 'collection_id,document_id' });

        if (insertError) {
          fastify.log.error({ error: insertError }, 'Failed to add documents to collection');
          return reply.code(500).send({
            error: { code: 'ADD_FAILED', message: 'Failed to add documents to collection', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: {
            message: `Added ${validDocIds.length} document(s) to collection`,
            added_count: validDocIds.length,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/collections/:id/documents');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/collections/:id/documents/:documentId
   * Remove a document from a collection
   */
  fastify.delete(
    '/api/collections/:id/documents/:documentId',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const params = removeDocumentParamsSchema.parse(request.params);

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to modify collection documents', details: {} },
          });
        }

        // Verify ownership
        const { data: collection, error: fetchError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (collection.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You can only remove documents from your own collections', details: {} },
          });
        }

        const { error: deleteError } = await supabaseAdmin
          .from('collection_documents')
          .delete()
          .eq('collection_id', params.id)
          .eq('document_id', params.documentId);

        if (deleteError) {
          fastify.log.error({ error: deleteError }, 'Failed to remove document from collection');
          return reply.code(500).send({
            error: { code: 'REMOVE_FAILED', message: 'Failed to remove document from collection', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Document removed from collection',
            collectionId: params.id,
            documentId: params.documentId,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/collections/:id/documents/:documentId');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/collections/:id/members
   * Get all members of a collection
   */
  fastify.get(
    '/api/collections/:id/members',
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
            error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format', details: {} },
          });
        }

        // Verify collection exists and user has access
        const { data: collection, error: collectionError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id, visibility')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (collectionError || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        // Only author and members can view members list
        const hasAccess = 
          collection.visibility !== 'private' || 
          collection.author_id === user.id ||
          await checkCollectionMembership(id, user.id);

        if (!hasAccess) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'You do not have access to this collection', details: {} },
          });
        }

        // Get members with user details
        const { data: members, error } = await supabaseAdmin
          .from('collection_members')
          .select(`
            id,
            role,
            added_at,
            invited_by,
            users!user_id (
              id,
              email,
              full_name
            )
          `)
          .eq('collection_id', id)
          .order('added_at', { ascending: true });

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch collection members');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch members', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { members: members || [] },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/collections/:id/members');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/collections/:id/members
   * Add a member to a collection
   */
  fastify.post(
    '/api/collections/:id/members',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to manage collection members', details: {} },
          });
        }

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format', details: {} },
          });
        }

        const bodySchema = z.object({
          user_id: z.string().uuid(),
          role: z.enum(['viewer', 'editor']).default('viewer'),
        });

        const body = bodySchema.parse(request.body);

        // Verify collection exists and user is the author
        const { data: collection, error: collectionError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (collectionError || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (collection.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'Only the collection author can add members', details: {} },
          });
        }

        // Verify the user to invite exists and belongs to the same tenant
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', body.user_id)
          .eq('tenant_id', tenant.id)
          .single();

        if (userError || !targetUser) {
          return reply.code(400).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found in this organization', details: {} },
          });
        }

        // Cannot invite the author (they already have access)
        if (body.user_id === collection.author_id) {
          return reply.code(400).send({
            error: { code: 'CANNOT_INVITE_AUTHOR', message: 'Collection author already has full access', details: {} },
          });
        }

        // Add member
        const { data: member, error: insertError } = await supabaseAdmin
          .from('collection_members')
          .insert({
            collection_id: id,
            user_id: body.user_id,
            role: body.role,
            invited_by: user.id,
          })
          .select(`
            id,
            role,
            added_at,
            invited_by,
            users!user_id (
              id,
              email,
              full_name
            )
          `)
          .single();

        if (insertError) {
          // Handle duplicate key error
          if (insertError.code === '23505') {
            return reply.code(409).send({
              error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this collection', details: {} },
            });
          }

          fastify.log.error({ error: insertError }, 'Failed to add collection member');
          return reply.code(500).send({
            error: { code: 'ADD_FAILED', message: 'Failed to add member', details: {} },
          });
        }

        return reply.code(201).send({
          success: true,
          data: { member },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/collections/:id/members');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/collections/:id/members/:memberId
   * Remove a member from a collection
   */
  fastify.delete(
    '/api/collections/:id/members/:memberId',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id, memberId } = request.params as { id: string; memberId: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Viewers do not have permission to manage collection members', details: {} },
          });
        }

        if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(memberId).success) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format', details: {} },
          });
        }

        // Verify collection exists and user is the author
        const { data: collection, error: collectionError } = await supabaseAdmin
          .from('collections')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (collectionError || !collection) {
          return reply.code(404).send({
            error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found', details: {} },
          });
        }

        if (collection.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'ACCESS_DENIED', message: 'Only the collection author can remove members', details: {} },
          });
        }

        // Remove member
        const { error: deleteError } = await supabaseAdmin
          .from('collection_members')
          .delete()
          .eq('id', memberId)
          .eq('collection_id', id);

        if (deleteError) {
          fastify.log.error({ error: deleteError }, 'Failed to remove collection member');
          return reply.code(500).send({
            error: { code: 'REMOVE_FAILED', message: 'Failed to remove member', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { message: 'Member removed successfully' },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/collections/:id/members/:memberId');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );
}

/**
 * Check if a user is a member of a collection
 */
async function checkCollectionMembership(
  collectionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('collection_members')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

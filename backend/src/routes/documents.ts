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
 * Zod schema for GET /api/documents/:id path parameters
 */
const getDocumentParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for POST /api/documents request body
 */
const createDocumentBodySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  is_public: z.boolean().default(false),
});

/**
 * Zod schema for PATCH /api/documents/:id request body
 */
const updateDocumentBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(10485760).optional(), // Max 10MB content
  yjs_state: z.string().optional(), // Base64 encoded binary state
  is_public: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Zod schema for PATCH /api/documents/:id path parameters
 */
const updateDocumentParamsSchema = z.object({
  id: z.string().uuid(),
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

  /**
   * GET /api/documents/:id
   * Retrieves a single document by ID
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - Document must belong to user's tenant
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Validates UUID format with Zod
   * - Returns 404 if document not found or belongs to different tenant
   * - Returns 403 if user doesn't have access to document's tenant
   */
  fastify.get(
    '/api/documents/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = getDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Fetch document with tenant isolation
        const { data: document, error } = await supabaseAdmin
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
          `)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - document not found or wrong tenant
            fastify.log.warn(
              { documentId: id, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied'
            );
            return reply.code(404).send({
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'Document not found',
                details: {},
              },
            });
          }

          fastify.log.error(
            { error, documentId: id, tenantId: tenant.id, userId: user.id },
            'Failed to fetch document'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        fastify.log.info(
          { documentId: id, tenantId: tenant.id, userId: user.id },
          'Document fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            document,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID format',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/:id');
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
   * POST /api/documents
   * Creates a new document with status='draft' and records lineage event
   * 
   * Request Body:
   * - title (required): Document title (1-500 characters)
   * - content (optional): Markdown content
   * - parent_id (optional): Parent document UUID for folder structure
   * - is_public (optional): Whether document is publicly accessible (default: false)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * 
   * Security:
   * - Sets tenant_id from tenant context
   * - Sets author_id from authenticated user
   * - Validates all input with Zod schema
   * - Creates immutable lineage event for audit trail
   * - Enforces tenant isolation
   */
  fastify.post(
    '/api/documents',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate request body
        const body = createDocumentBodySchema.parse(request.body);
        const { title, content, parent_id, is_public } = body;

        // Verify parent_id belongs to same tenant if provided
        if (parent_id) {
          const { data: parentDoc, error: parentError } = await supabaseAdmin
            .from('documents')
            .select('id')
            .eq('id', parent_id)
            .eq('tenant_id', tenant.id)
            .single();

          if (parentError || !parentDoc) {
            fastify.log.warn(
              { parentId: parent_id, tenantId: tenant.id, userId: user.id },
              'Parent document not found or belongs to different tenant'
            );
            return reply.code(400).send({
              error: {
                code: 'INVALID_PARENT',
                message: 'Parent document not found or access denied',
                details: {},
              },
            });
          }
        }

        // Create document with status='draft'
        const { data: document, error: createError } = await supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: tenant.id,
            author_id: user.id,
            title,
            content: content || '',
            parent_id: parent_id || null,
            is_public,
            status: 'draft',
          })
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
            updated_at
          `)
          .single();

        if (createError) {
          fastify.log.error(
            { error: createError, tenantId: tenant.id, userId: user.id },
            'Failed to create document'
          );
          return reply.code(500).send({
            error: {
              code: 'CREATE_FAILED',
              message: 'Failed to create document',
              details: {},
            },
          });
        }

        // Create lineage event for document creation
        const { error: lineageError } = await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: document.id,
            event_type: 'created',
            actor_id: user.id,
            metadata: {
              title,
              has_parent: !!parent_id,
              is_public,
            },
          });

        if (lineageError) {
          fastify.log.error(
            { error: lineageError, documentId: document.id, userId: user.id },
            'Failed to create lineage event'
          );
        }

        fastify.log.info(
          { documentId: document.id, tenantId: tenant.id, userId: user.id, title },
          'Document created successfully'
        );

        return reply.code(201).send({
          success: true,
          data: {
            document,
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

        fastify.log.error({ error }, 'Unexpected error in POST /api/documents');
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
   * PATCH /api/documents/:id
   * Updates an existing document's content, yjs_state, title, or is_public fields
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Request Body (at least one field required):
   * - title (optional): Updated document title (1-500 characters)
   * - content (optional): Updated markdown content (max 10MB)
   * - yjs_state (optional): Base64-encoded Y.js binary state for real-time collaboration
   * - is_public (optional): Whether document is publicly accessible
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must be the document author (ownership verification)
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Verifies document ownership (only author can update)
   * - Validates content size to prevent resource exhaustion
   * - Validates all input with Zod schema
   * - Creates immutable lineage event for audit trail
   * - Automatically updates updated_at timestamp
   */
  fastify.patch(
    '/api/documents/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = updateDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Validate request body
        const body = updateDocumentBodySchema.parse(request.body);
        const { title, content, yjs_state, is_public } = body;

        // Fetch document to verify ownership and tenant
        const { data: existingDoc, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id, title, content')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            fastify.log.warn(
              { documentId: id, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied'
            );
            return reply.code(404).send({
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'Document not found',
                details: {},
              },
            });
          }

          fastify.log.error(
            { error: fetchError, documentId: id, tenantId: tenant.id, userId: user.id },
            'Failed to fetch document for update'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        // Verify ownership - only author can update
        if (existingDoc.author_id !== user.id) {
          fastify.log.warn(
            { documentId: id, authorId: existingDoc.author_id, userId: user.id },
            'User attempted to update document they do not own'
          );
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only the document author can update this document',
              details: {},
            },
          });
        }

        // Build update object with only provided fields
        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (is_public !== undefined) updateData.is_public = is_public;
        
        // Handle yjs_state - convert base64 to buffer for BYTEA storage
        if (yjs_state !== undefined) {
          try {
            const buffer = Buffer.from(yjs_state, 'base64');
            updateData.yjs_state = buffer;
          } catch (decodeError) {
            fastify.log.warn(
              { documentId: id, userId: user.id },
              'Invalid base64 encoding for yjs_state'
            );
            return reply.code(400).send({
              error: {
                code: 'INVALID_YJS_STATE',
                message: 'yjs_state must be valid base64-encoded data',
                details: {},
              },
            });
          }
        }

        // Update document
        const { data: updatedDoc, error: updateError } = await supabaseAdmin
          .from('documents')
          .update(updateData)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
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
            updated_at
          `)
          .single();

        if (updateError) {
          fastify.log.error(
            { error: updateError, documentId: id, tenantId: tenant.id, userId: user.id },
            'Failed to update document'
          );
          return reply.code(500).send({
            error: {
              code: 'UPDATE_FAILED',
              message: 'Failed to update document',
              details: {},
            },
          });
        }

        // Create lineage event for document edit
        const lineageMetadata: any = {
          fields_updated: Object.keys(updateData),
        };
        
        // Track what changed for audit purposes
        if (title !== undefined && title !== existingDoc.title) {
          lineageMetadata.title_changed = true;
        }
        if (content !== undefined && content !== existingDoc.content) {
          lineageMetadata.content_changed = true;
        }
        if (yjs_state !== undefined) {
          lineageMetadata.yjs_state_updated = true;
        }

        const { error: lineageError } = await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: updatedDoc.id,
            event_type: 'edited',
            actor_id: user.id,
            metadata: lineageMetadata,
          });

        if (lineageError) {
          fastify.log.error(
            { error: lineageError, documentId: updatedDoc.id, userId: user.id },
            'Failed to create lineage event for document update'
          );
        }

        fastify.log.info(
          { 
            documentId: updatedDoc.id, 
            tenantId: tenant.id, 
            userId: user.id,
            fieldsUpdated: Object.keys(updateData),
          },
          'Document updated successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            document: updatedDoc,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in PATCH /api/documents/:id');
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

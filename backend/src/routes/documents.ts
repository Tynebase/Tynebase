import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { dispatchJob } from '../utils/dispatchJob';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

/**
 * Rewrites Supabase signed URLs in document content to use the public asset proxy.
 * This allows cross-tenant users to view images in public documents.
 * 
 * Matches URLs like:
 * - https://xxx.supabase.co/storage/v1/object/sign/tenant-documents/tenant-{id}/documents/{docId}/{filename}?token=...
 * 
 * Rewrites to:
 * - /api/documents/{docId}/assets/public/{filename}
 */
function rewriteAssetUrlsForPublicAccess(content: string, documentId: string, apiBaseUrl: string): string {
  if (!content) return content;
  
  // Match Supabase signed URLs for tenant-documents bucket
  // Pattern: https://xxx.supabase.co/storage/v1/object/sign/tenant-documents/tenant-{tenantId}/documents/{docId}/{filename}?token=...
  const supabaseUrlPattern = /https?:\/\/[^"'\s]+\.supabase\.co\/storage\/v1\/object\/sign\/tenant-documents\/tenant-[^/]+\/documents\/([^/]+)\/([^"'\s?]+)[^"'\s]*/g;
  
  return content.replace(supabaseUrlPattern, (match, docIdFromUrl, filename) => {
    // Only rewrite URLs for this document
    if (docIdFromUrl === documentId) {
      return `${apiBaseUrl}/api/documents/${documentId}/assets/public/${filename}`;
    }
    return match;
  });
}

/**
 * Rewrites Supabase signed URLs to the authenticated /serve/ proxy.
 * Used for same-tenant (editor) access so images never expire and
 * the browser never loads directly from Supabase (avoids Cloudflare cookie issues).
 */
function rewriteAssetUrlsForServe(content: string, documentId: string, apiBaseUrl: string): string {
  if (!content) return content;
  
  const supabaseUrlPattern = /https?:\/\/[^"'\s]+\.supabase\.co\/storage\/v1\/object\/sign\/tenant-documents\/tenant-[^/]+\/documents\/([^/]+)\/([^"'\s?]+)[^"'\s]*/g;
  
  return content.replace(supabaseUrlPattern, (match, docIdFromUrl, filename) => {
    if (docIdFromUrl === documentId) {
      return `${apiBaseUrl}/api/documents/${documentId}/assets/serve/${filename}`;
    }
    return match;
  });
}

/**
 * Zod schema for GET /api/documents query parameters
 */
const listDocumentsQuerySchema = z.object({
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published']).optional(),
  tag_id: z.string().uuid().optional(),
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
  category_id: z.string().uuid().nullable().optional(),
  is_public: z.boolean().default(false), // Deprecated, use visibility
  visibility: z.enum(['private', 'team', 'public']).default('team'),
});

/**
 * Zod schema for PATCH /api/documents/:id request body
 */
const updateDocumentBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(10485760).optional(), // Max 10MB content
  yjs_state: z.string().optional(), // Base64 encoded binary state
  is_public: z.boolean().optional(), // Deprecated, use visibility
  visibility: z.enum(['private', 'team', 'public']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  category_id: z.string().uuid().nullable().optional(), // Category/folder ID
  draft_content: z.string().max(10485760).optional(), // Draft content for published docs
  draft_title: z.string().min(1).max(500).optional(), // Draft title
  save_as_draft: z.boolean().optional(), // Flag to indicate saving to draft vs publishing
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
 * Zod schema for DELETE /api/documents/:id path parameters
 */
const deleteDocumentParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for POST /api/documents/:id/publish path parameters
 */
const publishDocumentParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for GET /api/documents/:id/normalized path parameters
 */
const getNormalizedParamsSchema = z.object({
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
        const { category_id, status, tag_id, page, limit } = query;

        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Build query with tenant isolation
        // Exclude categories (documents with __CATEGORY__ prefix in content)
        let dbQuery = supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            category_id,
            visibility,
            status,
            author_id,
            published_at,
            created_at,
            updated_at,
            ai_score,
            view_count,
            users:author_id (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .not('content', 'like', '__CATEGORY__%')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Apply optional filters
        if (category_id !== undefined) {
          dbQuery = dbQuery.eq('category_id', category_id);
        }

        if (status !== undefined) {
          dbQuery = dbQuery.eq('status', status);
        }

        // Apply tag filter by filtering to documents that have the specified tag
        if (tag_id !== undefined) {
          // First, get all document IDs that have this tag
          const { data: taggedDocs } = await supabaseAdmin
            .from('document_tags')
            .select('document_id')
            .eq('tag_id', tag_id);
          
          const taggedDocIds = taggedDocs?.map(td => td.document_id) || [];
          
          if (taggedDocIds.length > 0) {
            dbQuery = dbQuery.in('id', taggedDocIds);
          } else {
            // No documents have this tag, return empty result
            return reply.code(200).send({
              success: true,
              data: {
                documents: [],
                pagination: {
                  page,
                  limit,
                  total: 0,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPrevPage: false,
                },
              },
            });
          }
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

        // Fetch collection relationships for all documents
        const documentIds = documents?.map(d => d.id) || [];
        let documentCollections: Record<string, Array<{ id: string; name: string; color: string }>> = {};
        let documentTags: Record<string, Array<{ id: string; name: string; description: string | null }>> = {};

        if (documentIds.length > 0) {
          const { data: collectionDocs } = await supabaseAdmin
            .from('collection_documents')
            .select(`
              document_id,
              collections:collection_id (
                id,
                name,
                color
              )
            `)
            .in('document_id', documentIds);

          if (collectionDocs) {
            collectionDocs.forEach((cd: any) => {
              if (cd.collections) {
                if (!documentCollections[cd.document_id]) {
                  documentCollections[cd.document_id] = [];
                }
                documentCollections[cd.document_id].push({
                  id: cd.collections.id,
                  name: cd.collections.name,
                  color: cd.collections.color,
                });
              }
            });
          }

          // Fetch tag relationships for all documents
          const { data: tagDocs } = await supabaseAdmin
            .from('document_tags')
            .select(`
              document_id,
              tags:tag_id (
                id,
                name,
                description
              )
            `)
            .in('document_id', documentIds);

          if (tagDocs) {
            tagDocs.forEach((td: any) => {
              if (td.tags) {
                if (!documentTags[td.document_id]) {
                  documentTags[td.document_id] = [];
                }
                documentTags[td.document_id].push({
                  id: td.tags.id,
                  name: td.tags.name,
                  description: td.tags.description,
                });
              }
            });
          }
        }

        // Enrich documents with collection and tag info
        const enrichedDocuments = documents?.map(doc => ({
          ...doc,
          collections: documentCollections[doc.id] || [],
          tags: documentTags[doc.id] || [],
        })) || [];

        // Calculate pagination metadata
        const totalPages = count ? Math.ceil(count / limit) : 0;
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            count: documents?.length || 0,
            filters: { category_id, status },
            page,
          },
          'Documents fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            documents: enrichedDocuments,
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

        // First try to fetch document from user's tenant (full access with drafts)
        let { data: document, error } = await supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            draft_content,
            draft_title,
            has_draft,
            draft_updated_at,
            parent_id,
            category_id,
            tenant_id,
            visibility,
            status,
            author_id,
            published_at,
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

        // If not found in user's tenant, check if it's a public document from another tenant
        if (error && error.code === 'PGRST116') {
          const { data: publicDoc, error: publicError } = await supabaseAdmin
            .from('documents')
            .select(`
              id,
              title,
              content,
              parent_id,
              category_id,
              tenant_id,
              visibility,
              status,
              author_id,
              published_at,
              created_at,
              updated_at,
              users:author_id (
                id,
                email,
                full_name
              )
            `)
            .eq('id', id)
            .eq('visibility', 'public')
            .eq('status', 'published')
            .single();

          if (!publicError && publicDoc) {
            // Found a public document from another tenant - return it (read-only, no draft fields)
            document = {
              ...publicDoc,
              draft_content: null,
              draft_title: null,
              has_draft: false,
              draft_updated_at: null,
            } as typeof document;
            error = null;
            fastify.log.info(
              { documentId: id, tenantId: publicDoc.tenant_id, requestingTenantId: tenant.id, userId: user.id },
              'Cross-tenant public document accessed'
            );
          }
        }

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - document not found or not accessible
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

        // Determine if this is a cross-tenant access (read-only)
        const isCrossTenant = document!.tenant_id !== tenant.id;
        
        fastify.log.info(
          { documentId: id, tenantId: tenant.id, userId: user.id, isCrossTenant },
          'Document fetched successfully'
        );

        // Increment view count unless skipped (fire and forget - don't block response)
        const skipViewIncrement = (request.query as any)?.skip_view_increment === 'true';
        if (!skipViewIncrement) {
          try {
            await supabaseAdmin.rpc('increment_document_view_count', { doc_id: id });
          } catch (err) {
            fastify.log.warn({ error: err, documentId: id }, 'Failed to increment view count');
          }
        }

        // Always rewrite Supabase signed URLs in document content to use our proxy.
        // - Cross-tenant / public docs → /assets/public/ (no auth needed)
        // - Same-tenant docs → /assets/serve/ (auth required, for editor)
        let responseDocument = document;
        const isPublicDocument = document?.visibility === 'public' && document?.status === 'published';
        if (document) {
          const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';
          if (isCrossTenant || isPublicDocument) {
            responseDocument = {
              ...document,
              content: rewriteAssetUrlsForPublicAccess(document.content || '', id, apiBaseUrl),
            };
          } else {
            responseDocument = {
              ...document,
              content: rewriteAssetUrlsForServe(document.content || '', id, apiBaseUrl),
            };
          }
        }

        return reply.code(200).send({
          success: true,
          data: {
            document: responseDocument,
            // Flag to indicate cross-tenant access (read-only mode)
            is_read_only: isCrossTenant,
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

        // Viewers cannot create documents (super admins bypass all role restrictions)
        if (user.role === 'viewer' && !user.is_super_admin) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Viewers do not have permission to create documents',
              details: {},
            },
          });
        }

        // Validate request body
        const body = createDocumentBodySchema.parse(request.body);
        const { title, content, category_id, visibility } = body;

        // Verify category_id belongs to same tenant if provided
        if (category_id) {
          const { data: category, error: categoryError } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('id', category_id)
            .eq('tenant_id', tenant.id)
            .single();

          if (categoryError || !category) {
            fastify.log.warn(
              { categoryId: category_id, tenantId: tenant.id, userId: user.id },
              'Category not found or belongs to different tenant'
            );
            return reply.code(400).send({
              error: {
                code: 'INVALID_CATEGORY',
                message: 'Category not found or access denied',
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
            category_id: category_id || null,
            visibility,
            status: 'draft',
          })
          .select(`
            id,
            title,
            content,
            category_id,
            visibility,
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
              has_category: !!category_id,
              visibility,
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

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'document.created',
          actionType: 'document',
          targetName: title,
          ipAddress: getClientIp(request),
          metadata: { document_id: document.id },
        });

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
        const { title, content, yjs_state, visibility, status, category_id, draft_content, draft_title, save_as_draft } = body;

        // Fetch document to verify ownership and tenant - include draft fields
        const { data: existingDoc, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id, title, content, status, has_draft, draft_content, draft_title')
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

        // Role-based access control for document updates
        // - Super admins: bypass all restrictions
        // - Admins/Editors: can edit any document in the tenant
        // - Members: can only edit their own documents
        // - Viewers: cannot edit any document
        if (!user.is_super_admin) {
          if (user.role === 'viewer') {
            return reply.code(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Viewers do not have permission to edit documents',
                details: {},
              },
            });
          }

          if (user.role === 'member' && existingDoc.author_id !== user.id) {
            fastify.log.warn(
              { documentId: id, authorId: existingDoc.author_id, userId: user.id },
              'Member attempted to update document they do not own'
            );
            return reply.code(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Members can only edit their own documents',
                details: {},
              },
            });
          }
        }

        // Build update object with only provided fields
        // Handle draft workflow: if save_as_draft is true and document is published, save to draft fields
        const updateData: any = {};
        const isPublished = existingDoc.status === 'published';
        const isDraftSave = save_as_draft === true;
        
        // Track if we're updating draft or published content
        let draftContentUpdated = false;
        let publishedContentUpdated = false;
        
        if (isPublished && isDraftSave) {
          // Saving draft changes to a published document
          if (content !== undefined) {
            updateData.draft_content = content;
            updateData.has_draft = true;
            updateData.draft_updated_at = new Date().toISOString();
            draftContentUpdated = true;
          }
          if (title !== undefined) {
            updateData.draft_title = title;
            updateData.has_draft = true;
            updateData.draft_updated_at = new Date().toISOString();
          }
          // Also update yjs_state for collaborative editing
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
        } else {
          // Normal update (draft document or direct published update)
          if (title !== undefined) {
            updateData.title = title;
            publishedContentUpdated = true;
          }
          if (content !== undefined) {
            updateData.content = content;
            publishedContentUpdated = true;
          }
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
        }
        
        // Handle draft content and title directly if provided
        if (draft_content !== undefined) {
          updateData.draft_content = draft_content;
          updateData.has_draft = true;
          updateData.draft_updated_at = new Date().toISOString();
          draftContentUpdated = true;
        }
        if (draft_title !== undefined) {
          updateData.draft_title = draft_title;
          updateData.has_draft = true;
          updateData.draft_updated_at = new Date().toISOString();
        }
        
        // Other fields that can always be updated
        if (visibility !== undefined) updateData.visibility = visibility;
        if (status !== undefined) updateData.status = status;
        if (category_id !== undefined) updateData.category_id = category_id;

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
            draft_content,
            draft_title,
            has_draft,
            draft_updated_at,
            parent_id,
            category_id,
            visibility,
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
        if (draftContentUpdated) {
          lineageMetadata.draft_content_saved = true;
        }
        if (publishedContentUpdated) {
          lineageMetadata.published_content_updated = true;
        }
        if (title !== undefined && title !== existingDoc.title) {
          lineageMetadata.title_changed = true;
        }
        if (content !== undefined && content !== existingDoc.content) {
          lineageMetadata.content_changed = true;
        }
        if (yjs_state !== undefined) {
          lineageMetadata.yjs_state_updated = true;
        }
        if (isPublished && isDraftSave) {
          lineageMetadata.saved_as_draft = true;
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

        // Dispatch rag_index job ONLY when document status changes to 'published'
        const statusChangedToPublished = status === 'published' && existingDoc.status !== 'published';
        if (statusChangedToPublished) {
          try {
            // Check for existing pending or processing rag_index jobs for this document
            const { data: existingJobs, error: jobCheckError } = await supabaseAdmin
              .from('job_queue')
              .select('id, status')
              .eq('tenant_id', tenant.id)
              .eq('type', 'rag_index')
              .in('status', ['pending', 'processing'])
              .eq('payload->>document_id', updatedDoc.id);

            if (jobCheckError) {
              fastify.log.error(
                { error: jobCheckError, documentId: updatedDoc.id },
                'Failed to check for existing rag_index jobs'
              );
            } else if (existingJobs && existingJobs.length > 0) {
              fastify.log.info(
                { documentId: updatedDoc.id, existingJobId: existingJobs[0].id },
                'Skipping rag_index job dispatch - job already pending/processing'
              );
            } else {
              // No duplicate job found, dispatch new rag_index job
              const job = await dispatchJob({
                tenantId: tenant.id,
                type: 'rag_index',
                payload: { document_id: updatedDoc.id }
              });

              fastify.log.info(
                { documentId: updatedDoc.id, jobId: job.id, tenantId: tenant.id },
                'RAG index job dispatched for document update'
              );
            }
          } catch (dispatchError) {
            // Log error but don't fail the document update
            fastify.log.error(
              { error: dispatchError, documentId: updatedDoc.id },
              'Failed to dispatch rag_index job - document saved but indexing may be delayed'
            );
          }
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

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'document.updated',
          actionType: 'document',
          targetName: updatedDoc.title,
          ipAddress: getClientIp(request),
          metadata: { document_id: updatedDoc.id, fields_updated: Object.keys(updateData) },
        });

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

  /**
   * DELETE /api/documents/:id
   * Deletes a document and cascades to embeddings and lineage
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must be the document author (ownership verification)
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Verifies document ownership (only author can delete)
   * - Validates UUID format with Zod
   * - Cascade deletes embeddings and lineage via database constraints
   * - Returns 404 if document not found or belongs to different tenant
   * - Returns 403 if user is not the document author
   * 
   * Database Behavior:
   * - Hard delete (no soft delete/deleted_at column)
   * - ON DELETE CASCADE removes related embeddings automatically
   * - ON DELETE CASCADE removes related lineage events automatically
   */
  fastify.delete(
    '/api/documents/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = deleteDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Fetch document to verify ownership and tenant
        const { data: existingDoc, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id, title')
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
            'Failed to fetch document for deletion'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        // Role-based access control for document deletion
        // - Super admins: bypass all restrictions (platform-level access)
        // - Admins/Editors: can delete any document in the tenant
        // - Members: can only delete their own documents
        // - Viewers: cannot delete any document
        if (!user.is_super_admin) {
          if (user.role === 'viewer') {
            return reply.code(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Viewers do not have permission to delete documents',
                details: {},
              },
            });
          }

          if (user.role === 'member' && existingDoc.author_id !== user.id) {
            fastify.log.warn(
              { documentId: id, authorId: existingDoc.author_id, userId: user.id },
              'Member attempted to delete document they do not own'
            );
            return reply.code(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Members can only delete their own documents',
                details: {},
              },
            });
          }
        }

        // Delete document (cascade deletes embeddings and lineage)
        const { error: deleteError } = await supabaseAdmin
          .from('documents')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (deleteError) {
          fastify.log.error(
            { error: deleteError, documentId: id, tenantId: tenant.id, userId: user.id },
            'Failed to delete document'
          );
          return reply.code(500).send({
            error: {
              code: 'DELETE_FAILED',
              message: 'Failed to delete document',
              details: {},
            },
          });
        }

        fastify.log.info(
          { 
            documentId: id, 
            tenantId: tenant.id, 
            userId: user.id,
            title: existingDoc.title,
          },
          'Document deleted successfully'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'document.deleted',
          actionType: 'document',
          targetName: existingDoc.title,
          ipAddress: getClientIp(request),
          metadata: { document_id: id },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Document deleted successfully',
            documentId: id,
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

        fastify.log.error({ error }, 'Unexpected error in DELETE /api/documents/:id');
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
   * POST /api/documents/:id/publish
   * Publishes a document by changing status to 'published' and setting published_at timestamp
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' or 'editor' role to publish
   * - Document must belong to user's tenant
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Validates user role has publish permission (admin or editor)
   * - Validates UUID format with Zod
   * - Creates immutable lineage event for audit trail
   * - Returns 404 if document not found or belongs to different tenant
   * - Returns 403 if user doesn't have publish permission
   * - Returns 400 if document is already published
   * 
   * Behavior:
   * - Changes document status from 'draft' to 'published'
   * - Sets published_at to current timestamp
   * - Creates 'published' lineage event with actor_id
   * - Updates updated_at timestamp automatically via trigger
   */
  fastify.post(
    '/api/documents/:id/publish',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = publishDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Check user has publish permission (admin, editor, or super admin)
        if (!user.is_super_admin && user.role !== 'admin' && user.role !== 'editor') {
          fastify.log.warn(
            { documentId: id, userId: user.id, userRole: user.role, tenantId: tenant.id },
            'User attempted to publish document without permission'
          );
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admin and editor roles can publish documents',
              details: {},
            },
          });
        }

        // Fetch document to verify it exists and belongs to tenant - include draft fields
        const { data: existingDoc, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id, status, title, tenant_id, category_id, has_draft, draft_content, draft_title')
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
            'Failed to fetch document for publishing'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        // Check if document is already published
        // If published with draft changes, we allow re-publishing (publishing the draft)
        const hasDraftChanges = existingDoc.has_draft && (existingDoc.draft_content || existingDoc.draft_title);
        
        if (existingDoc.status === 'published' && !hasDraftChanges) {
          fastify.log.warn(
            { documentId: id, tenantId: tenant.id, userId: user.id },
            'Attempted to publish already published document with no draft changes'
          );
          return reply.code(400).send({
            error: {
              code: 'ALREADY_PUBLISHED',
              message: 'Document is already published with no pending draft changes',
              details: {},
            },
          });
        }

        // Auto-create "Default" category if document has no category
        let categoryId = existingDoc.category_id;
        if (!categoryId) {
          // Check if "Default" category already exists for this tenant
          const { data: defaultCategory } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('name', 'Default')
            .single();

          if (defaultCategory) {
            categoryId = defaultCategory.id;
          } else {
            // Create "Default" category
            const { data: newCategory, error: createCategoryError } = await supabaseAdmin
              .from('categories')
              .insert({
                name: 'Default',
                description: 'Default category for published documents',
                color: '#6B7280',
                tenant_id: tenant.id,
                author_id: user.id,
              })
              .select('id')
              .single();

            if (createCategoryError) {
              fastify.log.error(
                { error: createCategoryError, tenantId: tenant.id },
                'Failed to create default category'
              );
            } else {
              categoryId = newCategory.id;
              fastify.log.info(
                { categoryId: newCategory.id, tenantId: tenant.id },
                'Created default category for published document'
              );
            }
          }
        }

        // Update document status to published and set published_at
        // If there are draft changes, copy them to the published fields
        const isRepublishingWithDraft = existingDoc.status === 'published' && hasDraftChanges;
        
        const updateData: { 
          status: string; 
          published_at: string; 
          category_id?: string;
          title?: string;
          content?: string;
          has_draft?: boolean;
          draft_content?: string | null;
          draft_title?: string | null;
          draft_updated_at?: string | null;
        } = {
          status: 'published',
          published_at: new Date().toISOString(),
        };
        
        // If republishing with draft changes, copy draft to published
        if (isRepublishingWithDraft) {
          if (existingDoc.draft_title) {
            updateData.title = existingDoc.draft_title;
          }
          if (existingDoc.draft_content) {
            updateData.content = existingDoc.draft_content;
          }
          // Clear draft fields after publishing
          updateData.has_draft = false;
          updateData.draft_content = null;
          updateData.draft_title = null;
          updateData.draft_updated_at = null;
        }
        
        if (categoryId && categoryId !== existingDoc.category_id) {
          updateData.category_id = categoryId;
        }

        const { data: publishedDoc, error: updateError } = await supabaseAdmin
          .from('documents')
          .update(updateData)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select(`
            id,
            title,
            content,
            draft_content,
            draft_title,
            has_draft,
            draft_updated_at,
            parent_id,
            category_id,
            visibility,
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
            'Failed to publish document'
          );
          return reply.code(500).send({
            error: {
              code: 'PUBLISH_FAILED',
              message: 'Failed to publish document',
              details: {},
            },
          });
        }

        // Create lineage event for document publication
        const { error: lineageError } = await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: publishedDoc.id,
            event_type: 'published',
            actor_id: user.id,
            metadata: {
              title: existingDoc.title,
              published_by_role: user.role,
            },
          });

        if (lineageError) {
          fastify.log.error(
            { error: lineageError, documentId: publishedDoc.id, userId: user.id },
            'Failed to create lineage event for document publication'
          );
        }

        // Dispatch rag_index job for the published document
        try {
          // Check for existing pending or processing rag_index jobs for this document
          const { data: existingJobs, error: jobCheckError } = await supabaseAdmin
            .from('job_queue')
            .select('id, status')
            .eq('tenant_id', tenant.id)
            .eq('type', 'rag_index')
            .in('status', ['pending', 'processing'])
            .eq('payload->>document_id', publishedDoc.id);

          if (jobCheckError) {
            fastify.log.error(
              { error: jobCheckError, documentId: publishedDoc.id },
              'Failed to check for existing rag_index jobs'
            );
          } else if (existingJobs && existingJobs.length > 0) {
            fastify.log.info(
              { documentId: publishedDoc.id, existingJobId: existingJobs[0].id },
              'Skipping rag_index job dispatch - job already pending/processing'
            );
          } else {
            // No duplicate job found, dispatch new rag_index job
            const job = await dispatchJob({
              tenantId: tenant.id,
              type: 'rag_index',
              payload: { document_id: publishedDoc.id }
            });

            fastify.log.info(
              { documentId: publishedDoc.id, jobId: job.id, tenantId: tenant.id },
              'RAG index job dispatched for published document'
            );
          }
        } catch (dispatchError) {
          // Log error but don't fail the publish operation
          fastify.log.error(
            { error: dispatchError, documentId: publishedDoc.id },
            'Failed to dispatch rag_index job - document published but indexing may be delayed'
          );
        }

        fastify.log.info(
          { 
            documentId: publishedDoc.id, 
            tenantId: tenant.id, 
            userId: user.id,
            userRole: user.role,
            title: existingDoc.title,
          },
          'Document published successfully'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'document.published',
          actionType: 'document',
          targetName: existingDoc.title,
          ipAddress: getClientIp(request),
          metadata: { document_id: publishedDoc.id },
        });

        return reply.code(200).send({
          success: true,
          data: {
            document: publishedDoc,
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

        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/publish');
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
   * POST /api/documents/:id/discard-draft
   * Discards draft changes for a published document
   * Clears draft_content, draft_title, and has_draft fields
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must be the document author
   * - Document must belong to user's tenant
   * - Document must have has_draft = true
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Validates user is document author
   * - Returns 404 if document not found or belongs to different tenant
   * - Returns 403 if user doesn't own document
   * - Returns 400 if document has no draft to discard
   */
  fastify.post(
    '/api/documents/:id/discard-draft',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = publishDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Fetch document to verify ownership and draft status
        const { data: existingDoc, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id, status, title, tenant_id, author_id, has_draft, draft_content, draft_title')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            return reply.code(404).send({
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'Document not found',
                details: {},
              },
            });
          }
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        // Verify ownership - only author can discard draft
        if (existingDoc.author_id !== user.id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only the document author can discard draft changes',
              details: {},
            },
          });
        }

        // Check if document has draft to discard
        if (!existingDoc.has_draft) {
          return reply.code(400).send({
            error: {
              code: 'NO_DRAFT',
              message: 'Document has no draft changes to discard',
              details: {},
            },
          });
        }

        // Clear draft fields
        const { data: updatedDoc, error: updateError } = await supabaseAdmin
          .from('documents')
          .update({
            has_draft: false,
            draft_content: null,
            draft_title: null,
            draft_updated_at: null,
          })
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select(`
            id,
            title,
            content,
            draft_content,
            draft_title,
            has_draft,
            draft_updated_at,
            parent_id,
            category_id,
            visibility,
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
            'Failed to discard draft'
          );
          return reply.code(500).send({
            error: {
              code: 'DISCARD_FAILED',
              message: 'Failed to discard draft changes',
              details: {},
            },
          });
        }

        // Create lineage event
        const { error: lineageError } = await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: id,
            event_type: 'draft_discarded',
            actor_id: user.id,
            metadata: {
              had_draft_title: !!existingDoc.draft_title,
              had_draft_content: !!existingDoc.draft_content,
            },
          });

        if (lineageError) {
          fastify.log.error(
            { error: lineageError, documentId: id, userId: user.id },
            'Failed to create lineage event for draft discard'
          );
        }

        fastify.log.info(
          { documentId: id, tenantId: tenant.id, userId: user.id },
          'Draft discarded successfully'
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
              message: 'Invalid document ID format',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/discard-draft');
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
   * GET /api/documents/:id/normalized
   * Retrieves the normalized markdown content for a document
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
   * 
   * Response:
   * - Returns the normalized markdown content from documents.content field
   * - Content is plain text/markdown format
   */
  fastify.get(
    '/api/documents/:id/normalized',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const params = getNormalizedParamsSchema.parse(request.params);
        const { id } = params;

        // Fetch document content with tenant isolation
        const { data: document, error } = await supabaseAdmin
          .from('documents')
          .select('id, content')
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
            'Failed to fetch normalized content'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document content',
              details: {},
            },
          });
        }

        fastify.log.info(
          { documentId: id, tenantId: tenant.id, userId: user.id },
          'Normalized content fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            id: document.id,
            content: document.content || '',
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

        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/:id/normalized');
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
   * GET /api/documents/:id/versions
   * Retrieves version history for a document
   */
  fastify.get(
    '/api/documents/:id/versions',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const params = getDocumentParamsSchema.parse(request.params);
        const { id } = params;

        // Verify document exists and belongs to tenant
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found',
              details: {},
            },
          });
        }

        // Fetch versions (without join to avoid foreign key name issues)
        const { data: versions, error: versionsError } = await supabaseAdmin
          .from('document_versions')
          .select('id, version_number, title, content, created_by, created_at')
          .eq('document_id', id)
          .eq('tenant_id', tenant.id)
          .order('version_number', { ascending: false });

        if (versionsError) {
          fastify.log.error({ error: versionsError }, 'Failed to fetch document versions');
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch versions',
              details: {},
            },
          });
        }

        // Fetch user emails separately for each version
        const userIds = [...new Set((versions || []).map((v: any) => v.created_by).filter(Boolean))];
        let userMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, email')
            .in('id', userIds);
          
          if (users) {
            userMap = users.reduce((acc: Record<string, string>, u: any) => {
              acc[u.id] = u.email;
              return acc;
            }, {});
          }
        }

        // Map versions to include user_email
        const mappedVersions = (versions || []).map((v: any) => ({
          id: v.id,
          version_number: v.version_number,
          title: v.title,
          content: v.content,
          created_by: v.created_by,
          created_at: v.created_at,
          user_email: userMap[v.created_by] || null,
        }));

        fastify.log.info(
          { documentId: id, versionCount: mappedVersions.length },
          'Document versions fetched'
        );

        return reply.code(200).send({
          success: true,
          versions: mappedVersions,
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

        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/:id/versions');
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
   * POST /api/documents/:id/versions/:versionId/restore
   * Restores a document to a specific version
   */
  fastify.post(
    '/api/documents/:id/versions/:versionId/restore',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id, versionId } = request.params as { id: string; versionId: string };

        // Verify document exists and user owns it
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found',
              details: {},
            },
          });
        }

        if (document.author_id !== user.id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only the document author can restore versions',
              details: {},
            },
          });
        }

        // Fetch the version to restore
        const { data: version, error: versionError } = await supabaseAdmin
          .from('document_versions')
          .select('title, content, yjs_state')
          .eq('id', versionId)
          .eq('document_id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (versionError || !version) {
          return reply.code(404).send({
            error: {
              code: 'VERSION_NOT_FOUND',
              message: 'Version not found',
              details: {},
            },
          });
        }

        // Update document with version content
        const { error: updateError } = await supabaseAdmin
          .from('documents')
          .update({
            title: version.title,
            content: version.content,
            yjs_state: version.yjs_state,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          fastify.log.error({ error: updateError }, 'Failed to restore document version');
          return reply.code(500).send({
            error: {
              code: 'RESTORE_FAILED',
              message: 'Failed to restore version',
              details: {},
            },
          });
        }

        // Create lineage event
        await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: id,
            event_type: 'restored',
            actor_id: user.id,
            metadata: { restored_version_id: versionId },
          });

        fastify.log.info(
          { documentId: id, versionId, userId: user.id },
          'Document version restored'
        );

        return reply.code(200).send({
          success: true,
          message: 'Version restored successfully',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/versions/:versionId/restore');
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

  // ============================================================================
  // DOCUMENT VIDEO DETECTION & INGESTION
  // ============================================================================

  const videoIngestionBodySchema = z.object({
    generate_transcript: z.boolean().default(true),
    generate_summary: z.boolean().default(false),
    generate_article: z.boolean().default(false),
    ai_model: z.enum(['deepseek', 'gemini', 'claude']).default('deepseek'),
  });

  /**
   * GET /api/documents/:id/videos
   * Detects embedded videos (YouTube and uploaded) in a document
   * Returns list of videos with estimated credit cost
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/api/documents/:id/videos',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
        membershipGuard,
      ],
    },
    async (request, reply) => {
      try {
        const { id } = getDocumentParamsSchema.parse(request.params);
        const tenant = (request as any).tenant;

        // Fetch document content
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, content')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found',
              details: {},
            },
          });
        }

        const content = document.content || '';
        const videos: Array<{
          url: string;
          type: 'youtube' | 'uploaded';
          storagePath?: string;
          estimatedDurationMinutes: number;
        }> = [];

        // Detect YouTube embeds (data-youtube-video attribute or youtube.com URLs)
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
        let match;
        while ((match = youtubeRegex.exec(content)) !== null) {
          const videoId = match[1];
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          if (!videos.find(v => v.url === url)) {
            videos.push({
              url,
              type: 'youtube',
              estimatedDurationMinutes: 10, // Default estimate for YouTube
            });
          }
        }

        // Detect uploaded videos (video tags with src pointing to storage)
        const videoSrcRegex = /(?:src|href)=["']([^"']*(?:\.mp4|\.webm|\.mov|video)[^"']*)/gi;
        while ((match = videoSrcRegex.exec(content)) !== null) {
          const url = match[1];
          if (!videos.find(v => v.url === url) && !url.includes('youtube')) {
            videos.push({
              url,
              type: 'uploaded',
              estimatedDurationMinutes: 5, // Default estimate for uploaded videos
            });
          }
        }

        // Calculate total estimated credits
        // Base: 10 credits per video (Gemini pipeline)
        const GEMINI_BASE_CREDITS = 10;
        const totalEstimatedCredits = videos.length * GEMINI_BASE_CREDITS;

        return reply.code(200).send({
          success: true,
          data: {
            documentId: id,
            videos,
            totalEstimatedCredits,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error detecting document videos');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to detect videos',
            details: {},
          },
        });
      }
    }
  );

  /**
   * POST /api/documents/:id/videos/ingest
   * Ingests all embedded videos in a document
   * Creates transcription jobs and deducts credits
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof videoIngestionBodySchema>;
  }>(
    '/api/documents/:id/videos/ingest',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
        membershipGuard,
      ],
    },
    async (request, reply) => {
      try {
        const { id } = getDocumentParamsSchema.parse(request.params);
        const options = videoIngestionBodySchema.parse(request.body || {});
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Fetch document content
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, content, title')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found',
              details: {},
            },
          });
        }

        const content = document.content || '';
        const videos: Array<{
          url: string;
          type: 'youtube' | 'uploaded';
        }> = [];

        // Detect YouTube embeds
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
        let match;
        while ((match = youtubeRegex.exec(content)) !== null) {
          const videoId = match[1];
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          if (!videos.find(v => v.url === url)) {
            videos.push({ url, type: 'youtube' });
          }
        }

        // Detect uploaded videos
        const videoSrcRegex = /(?:src|href)=["']([^"']*(?:\.mp4|\.webm|\.mov|video)[^"']*)/gi;
        while ((match = videoSrcRegex.exec(content)) !== null) {
          const url = match[1];
          if (!videos.find(v => v.url === url) && !url.includes('youtube')) {
            videos.push({ url, type: 'uploaded' });
          }
        }

        if (videos.length === 0) {
          return reply.code(400).send({
            error: {
              code: 'NO_VIDEOS_FOUND',
              message: 'No embedded videos found in document',
              details: {},
            },
          });
        }

        // Check credit limits (all transcription uses Gemini)
        const BASE_CREDITS = 10;
        let creditsPerVideo = BASE_CREDITS;
        
        // Add model costs for summary/article
        const modelCosts: Record<string, number> = {
          'deepseek': 1,
          'gemini': 2,
          'claude': 5,
        };
        const modelCost = modelCosts[options.ai_model] || 1;
        
        if (options.generate_summary) creditsPerVideo += modelCost;
        if (options.generate_article) creditsPerVideo += modelCost;
        
        const totalCredits = videos.length * creditsPerVideo;

        // Check user's credit balance
        const { data: creditData } = await supabaseAdmin
          .from('tenant_credits')
          .select('credits_remaining')
          .eq('tenant_id', tenant.id)
          .single();

        const creditsRemaining = creditData?.credits_remaining || 0;
        if (creditsRemaining < totalCredits) {
          return reply.code(402).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: `Insufficient credits. Required: ${totalCredits}, Available: ${creditsRemaining}`,
              details: { required: totalCredits, available: creditsRemaining },
            },
          });
        }

        // Create jobs for each video
        const jobs: Array<{
          job_id: string;
          video_url: string;
          status: 'queued';
          estimated_credits: number;
        }> = [];

        for (const video of videos) {
          const jobPayload = video.type === 'youtube'
            ? {
                youtube_url: video.url,
                user_id: user.id,
                output_options: {
                  generate_transcript: options.generate_transcript,
                  generate_summary: options.generate_summary,
                  generate_article: options.generate_article,
                  ai_model: options.ai_model,
                },
              }
            : {
                url: video.url,
                user_id: user.id,
                output_options: {
                  generate_transcript: options.generate_transcript,
                  generate_summary: options.generate_summary,
                  generate_article: options.generate_article,
                  ai_model: options.ai_model,
                },
              };

          const job = await dispatchJob({
            tenantId: tenant.id,
            type: 'video_ingest',
            payload: jobPayload,
          });

          jobs.push({
            job_id: job.id,
            video_url: video.url,
            status: 'queued',
            estimated_credits: creditsPerVideo,
          });
        }

        // Create lineage event
        await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: id,
            event_type: 'video_ingestion_started',
            actor_id: user.id,
            metadata: {
              video_count: videos.length,
              total_credits: totalCredits,
              job_ids: jobs.map(j => j.job_id),
              options,
            },
          });

        fastify.log.info(
          { documentId: id, videoCount: videos.length, totalCredits, userId: user.id },
          'Document video ingestion started'
        );

        return reply.code(200).send({
          success: true,
          data: {
            documentId: id,
            jobs,
            totalCredits,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error ingesting document videos');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to start video ingestion',
            details: {},
          },
        });
      }
    }
  );

  /**
   * GET /api/public/documents - List public documents (no auth required)
   * Returns documents with visibility='public' and status='published'
   * Supports filtering by tenant_id, category_id, tag_id, and search query
   */
  fastify.get(
    '/api/public/documents',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const querySchema = z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          tenant_id: z.string().uuid().optional(),
          category_id: z.string().uuid().optional(),
          tag_id: z.string().uuid().optional(),
          search: z.string().max(200).optional(),
        });

        const query = querySchema.parse(request.query);
        const offset = (query.page - 1) * query.limit;

        // Build the base query for public + published documents
        let dbQuery = supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            category_id,
            tenant_id,
            visibility,
            status,
            author_id,
            published_at,
            created_at,
            updated_at,
            view_count,
            users:author_id (
              id,
              full_name,
              avatar_url
            ),
            categories:category_id (
              id,
              name,
              color
            ),
            tenants:tenant_id (
              id,
              name,
              subdomain
            )
          `, { count: 'exact' })
          .eq('visibility', 'public')
          .eq('status', 'published')
          .not('content', 'like', '__CATEGORY__%')
          .order('created_at', { ascending: false });

        // Apply optional filters
        if (query.tenant_id) {
          dbQuery = dbQuery.eq('tenant_id', query.tenant_id);
        }
        if (query.category_id) {
          dbQuery = dbQuery.eq('category_id', query.category_id);
        }
        if (query.search) {
          dbQuery = dbQuery.ilike('title', `%${query.search}%`);
        }

        // If tag_id filter, first get tagged document IDs
        if (query.tag_id) {
          const { data: taggedDocs } = await supabaseAdmin
            .from('document_tags')
            .select('document_id')
            .eq('tag_id', query.tag_id);

          const taggedDocIds = taggedDocs?.map(td => td.document_id) || [];
          if (taggedDocIds.length === 0) {
            return reply.code(200).send({
              success: true,
              data: {
                documents: [],
                pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
                filters: { tenants: [], categories: [], tags: [] },
              },
            });
          }
          dbQuery = dbQuery.in('id', taggedDocIds);
        }

        // Apply pagination
        dbQuery = dbQuery.range(offset, offset + query.limit - 1);

        const { data: documents, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch public documents');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch public documents', details: {} },
          });
        }

        const totalPages = count ? Math.ceil(count / query.limit) : 0;

        // Rewrite asset URLs for public access
        const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';
        const documentsWithRewrittenUrls = (documents || []).map((doc: any) => ({
          ...doc,
          content: rewriteAssetUrlsForPublicAccess(doc.content || '', doc.id, apiBaseUrl),
        }));

        // Fetch tags for all returned documents
        const docIds = (documents || []).map((d: any) => d.id);
        let documentTags: Record<string, Array<{ id: string; name: string; description: string | null }>> = {};
        if (docIds.length > 0) {
          const { data: tagDocs } = await supabaseAdmin
            .from('document_tags')
            .select(`
              document_id,
              tags:tag_id (
                id,
                name,
                description
              )
            `)
            .in('document_id', docIds);

          if (tagDocs) {
            for (const td of tagDocs as any[]) {
              if (!documentTags[td.document_id]) {
                documentTags[td.document_id] = [];
              }
              if (td.tags) {
                documentTags[td.document_id].push(td.tags);
              }
            }
          }
        }

        // Attach tags to documents
        const finalDocuments = documentsWithRewrittenUrls.map((doc: any) => ({
          ...doc,
          tags: documentTags[doc.id] || [],
        }));

        // Fetch available filter options (tenants, categories, tags that have public docs)
        // Tenants that have public documents
        const { data: tenantOptions } = await supabaseAdmin
          .from('documents')
          .select('tenant_id, tenants:tenant_id (id, name, subdomain)')
          .eq('visibility', 'public')
          .eq('status', 'published')
          .not('content', 'like', '__CATEGORY__%');

        const uniqueTenants = new Map<string, { id: string; name: string; subdomain: string }>();
        if (tenantOptions) {
          for (const d of tenantOptions as any[]) {
            if (d.tenants && !uniqueTenants.has(d.tenant_id)) {
              uniqueTenants.set(d.tenant_id, d.tenants);
            }
          }
        }

        // Categories that appear in public documents
        const { data: categoryOptions } = await supabaseAdmin
          .from('documents')
          .select('category_id, categories:category_id (id, name, color)')
          .eq('visibility', 'public')
          .eq('status', 'published')
          .not('category_id', 'is', null)
          .not('content', 'like', '__CATEGORY__%');

        const uniqueCategories = new Map<string, { id: string; name: string; color: string }>();
        if (categoryOptions) {
          for (const d of categoryOptions as any[]) {
            if (d.categories && d.category_id && !uniqueCategories.has(d.category_id)) {
              uniqueCategories.set(d.category_id, d.categories);
            }
          }
        }

        // Tags that appear on public documents
        const { data: publicDocIds } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('visibility', 'public')
          .eq('status', 'published')
          .not('content', 'like', '__CATEGORY__%');

        let uniqueTags = new Map<string, { id: string; name: string; description: string | null }>();
        if (publicDocIds && publicDocIds.length > 0) {
          const { data: tagOptions } = await supabaseAdmin
            .from('document_tags')
            .select('tag_id, tags:tag_id (id, name, description)')
            .in('document_id', publicDocIds.map((d: any) => d.id));

          if (tagOptions) {
            for (const t of tagOptions as any[]) {
              if (t.tags && !uniqueTags.has(t.tag_id)) {
                uniqueTags.set(t.tag_id, t.tags);
              }
            }
          }
        }

        return reply.code(200).send({
          success: true,
          data: {
            documents: finalDocuments,
            pagination: {
              page: query.page,
              limit: query.limit,
              total: count || 0,
              totalPages,
              hasNextPage: query.page < totalPages,
              hasPrevPage: query.page > 1,
            },
            filters: {
              tenants: Array.from(uniqueTenants.values()),
              categories: Array.from(uniqueCategories.values()),
              tags: Array.from(uniqueTags.values()),
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/public/documents');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/public/documents/:id - Get a public document (no auth required)
   * Only returns documents with visibility='public' and status='published'
   */
  fastify.get(
    '/api/public/documents/:id',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'INVALID_ID', message: 'Invalid document ID format', details: {} },
          });
        }

        const { data: document, error } = await supabaseAdmin
          .from('documents')
          .select(`
            id, title, content, created_at, updated_at, view_count,
            users:author_id (id, full_name, avatar_url),
            categories:category_id (id, name, color)
          `)
          .eq('id', id)
          .eq('visibility', 'public')
          .eq('status', 'published')
          .single();

        if (error || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found or not public', details: {} },
          });
        }

        // Increment view count
        await supabaseAdmin
          .from('documents')
          .update({ view_count: (document.view_count || 0) + 1 })
          .eq('id', id);

        return reply.code(200).send({ document });
      } catch (error) {
        fastify.log.error({ error }, 'Error fetching public document');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );
}

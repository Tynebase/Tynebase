import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import crypto from 'crypto';

/**
 * Rewrites Supabase signed URLs in document content to use the public asset proxy.
 * This allows cross-tenant users to view images in public documents.
 */
function rewriteAssetUrlsForPublicAccess(content: string, documentId: string, apiBaseUrl: string): string {
  if (!content) return content;
  
  const supabaseUrlPattern = /https?:\/\/[^"'\s]+\.supabase\.co\/storage\/v1\/object\/sign\/tenant-documents\/tenant-[^/]+\/documents\/([^/]+)\/([^"'\s?]+)[^"'\s]*/g;
  
  return content.replace(supabaseUrlPattern, (match, docIdFromUrl, filename) => {
    if (docIdFromUrl === documentId) {
      return `${apiBaseUrl}/api/documents/${documentId}/assets/public/${filename}`;
    }
    return match;
  });
}

const documentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const shareIdParamsSchema = z.object({
  id: z.string().uuid(),
  sid: z.string().uuid(),
});

const shareTokenParamsSchema = z.object({
  token: z.string().min(1),
});

const createShareLinkBodySchema = z.object({
  permission: z.enum(['view', 'edit']).default('view'),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

const createUserShareBodySchema = z.object({
  user_id: z.string().uuid(),
  permission: z.enum(['view', 'edit']).default('view'),
});

/**
 * Document sharing routes
 * Handles share links and user-specific document shares
 */
export default async function documentShareRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/documents/:id/shares
   * List all shares for a document (owner only)
   */
  fastify.get(
    '/api/documents/:id/shares',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const params = documentIdParamsSchema.parse(request.params);

        // Verify document exists and user owns it
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found', details: {} },
          });
        }

        if (document.author_id !== user.id && user.role !== 'admin') {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only document owner can view shares', details: {} },
          });
        }

        // Fetch shares
        const { data: shares, error } = await supabaseAdmin
          .from('document_shares')
          .select(`
            id,
            document_id,
            shared_with,
            permission,
            share_token,
            expires_at,
            created_by,
            created_at,
            shared_user:shared_with (
              id,
              email,
              full_name
            )
          `)
          .eq('document_id', params.id)
          .order('created_at', { ascending: false });

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch document shares');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch shares', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { shares: shares || [] },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/:id/shares');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/documents/:id/share-link
   * Generate a share link token for a document
   */
  fastify.post(
    '/api/documents/:id/share-link',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const params = documentIdParamsSchema.parse(request.params);
        const body = createShareLinkBodySchema.parse(request.body || {});

        // Verify document exists and user owns it
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id, title')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found', details: {} },
          });
        }

        if (document.author_id !== user.id && user.role !== 'admin') {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only document owner can create share links', details: {} },
          });
        }

        // Generate unique share token
        const shareToken = crypto.randomBytes(32).toString('hex');

        // Calculate expiration if specified
        let expiresAt: string | null = null;
        if (body.expires_in_days) {
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + body.expires_in_days);
          expiresAt = expDate.toISOString();
        }

        // Create share record
        const { data: share, error } = await supabaseAdmin
          .from('document_shares')
          .insert({
            tenant_id: tenant.id,
            document_id: params.id,
            shared_with: null,
            permission: body.permission,
            share_token: shareToken,
            expires_at: expiresAt,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          fastify.log.error({ error }, 'Failed to create share link');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to create share link', details: {} },
          });
        }

        fastify.log.info(
          { documentId: params.id, shareId: share.id, userId: user.id },
          'Share link created'
        );

        return reply.code(201).send({
          success: true,
          data: {
            share,
            share_url: `/share/${shareToken}`,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/share-link');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/documents/:id/share
   * Share document with a specific user
   */
  fastify.post(
    '/api/documents/:id/share',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const params = documentIdParamsSchema.parse(request.params);
        const body = createUserShareBodySchema.parse(request.body);

        // Verify document exists and user owns it
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id, title')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found', details: {} },
          });
        }

        if (document.author_id !== user.id && user.role !== 'admin') {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only document owner can share documents', details: {} },
          });
        }

        // Verify target user exists and is in the same tenant
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name')
          .eq('id', body.user_id)
          .eq('tenant_id', tenant.id)
          .single();

        if (userError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'Target user not found in your organization', details: {} },
          });
        }

        // Check if share already exists
        const { data: existingShare } = await supabaseAdmin
          .from('document_shares')
          .select('id')
          .eq('document_id', params.id)
          .eq('shared_with', body.user_id)
          .single();

        if (existingShare) {
          // Update existing share
          const { data: share, error } = await supabaseAdmin
            .from('document_shares')
            .update({ permission: body.permission })
            .eq('id', existingShare.id)
            .select()
            .single();

          if (error) {
            fastify.log.error({ error }, 'Failed to update share');
            return reply.code(500).send({
              error: { code: 'UPDATE_FAILED', message: 'Failed to update share', details: {} },
            });
          }

          return reply.code(200).send({
            success: true,
            data: { share, updated: true },
          });
        }

        // Create new share
        const { data: share, error } = await supabaseAdmin
          .from('document_shares')
          .insert({
            tenant_id: tenant.id,
            document_id: params.id,
            shared_with: body.user_id,
            permission: body.permission,
            share_token: null,
            expires_at: null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          fastify.log.error({ error }, 'Failed to create share');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to share document', details: {} },
          });
        }

        fastify.log.info(
          { documentId: params.id, shareId: share.id, sharedWith: body.user_id, userId: user.id },
          'Document shared with user'
        );

        return reply.code(201).send({
          success: true,
          data: { share },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/share');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/documents/:id/shares/:sid
   * Revoke a share
   */
  fastify.delete(
    '/api/documents/:id/shares/:sid',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const params = shareIdParamsSchema.parse(request.params);

        // Verify document exists and user owns it
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, author_id, tenant_id')
          .eq('id', params.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found', details: {} },
          });
        }

        if (document.author_id !== user.id && user.role !== 'admin') {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only document owner can revoke shares', details: {} },
          });
        }

        // Delete share
        const { error } = await supabaseAdmin
          .from('document_shares')
          .delete()
          .eq('id', params.sid)
          .eq('document_id', params.id);

        if (error) {
          fastify.log.error({ error }, 'Failed to delete share');
          return reply.code(500).send({
            error: { code: 'DELETE_FAILED', message: 'Failed to revoke share', details: {} },
          });
        }

        fastify.log.info(
          { documentId: params.id, shareId: params.sid, userId: user.id },
          'Share revoked'
        );

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/documents/:id/shares/:sid');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/share/:token
   * Resolve share token and redirect to document (public endpoint)
   * Rate limited to prevent abuse
   */
  fastify.get(
    '/api/share/:token',
    {
      preHandler: [rateLimitMiddleware],
    },
    async (request, reply) => {
      try {
        const params = shareTokenParamsSchema.parse(request.params);

        // Find share by token
        const { data: share, error } = await supabaseAdmin
          .from('document_shares')
          .select(`
            id,
            document_id,
            permission,
            expires_at,
            documents:document_id (
              id,
              title,
              content,
              visibility,
              status,
              author_id,
              tenant_id,
              users:author_id (
                id,
                email,
                full_name
              )
            )
          `)
          .eq('share_token', params.token)
          .single();

        if (error || !share) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Share link not found or expired', details: {} },
          });
        }

        // Check expiration
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
          return reply.code(410).send({
            error: { code: 'EXPIRED', message: 'This share link has expired', details: {} },
          });
        }

        // Rewrite asset URLs so images work via persistent proxy (not expiring signed URLs)
        const doc = share.documents as any;
        let rewrittenDoc = doc;
        if (doc?.content && doc?.id) {
          const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';
          rewrittenDoc = {
            ...doc,
            content: rewriteAssetUrlsForPublicAccess(doc.content, doc.id, apiBaseUrl),
          };
        }

        return reply.code(200).send({
          success: true,
          data: {
            document: rewrittenDoc,
            permission: share.permission,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid share token', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/share/:token');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/documents/shared
   * List public documents (visibility = 'public') for community shared documents
   */
  fastify.get(
    '/api/documents/shared',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const querySchema = z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          category_id: z.string().uuid().optional(),
        });

        const query = querySchema.parse(request.query);
        const offset = (query.page - 1) * query.limit;

        // Fetch ALL public documents from ALL tenants (community-wide)
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
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('visibility', 'public')
          .eq('status', 'published')
          .not('content', 'like', '__CATEGORY__%')
          .order('created_at', { ascending: false })
          .range(offset, offset + query.limit - 1);

        if (query.category_id) {
          dbQuery = dbQuery.eq('category_id', query.category_id);
        }

        const { data: documents, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch shared documents');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch shared documents', details: {} },
          });
        }

        const totalPages = count ? Math.ceil(count / query.limit) : 0;

        // Rewrite asset URLs for all public documents to use the public proxy
        const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';
        const documentsWithRewrittenUrls = (documents || []).map((doc: any) => ({
          ...doc,
          content: rewriteAssetUrlsForPublicAccess(doc.content || '', doc.id, apiBaseUrl),
        }));

        return reply.code(200).send({
          success: true,
          data: {
            documents: documentsWithRewrittenUrls,
            pagination: {
              page: query.page,
              limit: query.limit,
              total: count || 0,
              totalPages,
              hasNextPage: query.page < totalPages,
              hasPrevPage: query.page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/shared');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/templates/shared
   * List public templates for community shared templates
   */
  fastify.get(
    '/api/templates/shared',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;

        const querySchema = z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        });

        const query = querySchema.parse(request.query);
        const offset = (query.page - 1) * query.limit;

        // Fetch public templates from the tenant
        const { data: templates, error, count } = await supabaseAdmin
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
            users:created_by (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .range(offset, offset + query.limit - 1);

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch shared templates');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch shared templates', details: {} },
          });
        }

        const totalPages = count ? Math.ceil(count / query.limit) : 0;

        return reply.code(200).send({
          success: true,
          data: {
            templates: templates || [],
            pagination: {
              page: query.page,
              limit: query.limit,
              total: count || 0,
              totalPages,
              hasNextPage: query.page < totalPages,
              hasPrevPage: query.page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/templates/shared');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );
}
